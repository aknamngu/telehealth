import { useEffect, useMemo, useState } from 'react';
import { Bluetooth, Heart, Save, TestTube2, Zap } from 'lucide-react';
import { getAuthToken } from './auth';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
type Source = 'MANUAL' | 'BLUETOOTH' | 'SIMULATED';

interface Props {
  appointmentId: string;
  language: 'vi' | 'en';
}

interface Reading {
  id: number;
  heartRate?: number | null;
  oxygenSaturation?: number | null;
  systolicPressure?: number | null;
  diastolicPressure?: number | null;
  source: Source;
  deviceName?: string | null;
  measuredAt: string;
}

const sourceLabel: Record<Source, { vi: string; en: string }> = {
  MANUAL: { vi: 'Nhập tay', en: 'Manual' },
  BLUETOOTH: { vi: 'Bluetooth', en: 'Bluetooth' },
  SIMULATED: { vi: 'Mô phỏng demo', en: 'Demo simulation' },
};

function parseHeartRate(data: DataView) {
  const flags = data.getUint8(0);
  return (flags & 1) === 1 ? data.getUint16(1, true) : data.getUint8(1);
}

export default function VitalSignsPanel({ appointmentId, language }: Props) {
  const vi = language === 'vi';
  const [heartRate, setHeartRate] = useState('');
  const [spo2, setSpo2] = useState('');
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [source, setSource] = useState<Source>('MANUAL');
  const [deviceName, setDeviceName] = useState('');
  const [latest, setLatest] = useState<Reading | null>(null);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const token = getAuthToken();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token ?? ''}` }), [token]);

  useEffect(() => {
    if (!token || !appointmentId) return;
    fetch(`${API_URL}/vital-signs/appointment/${appointmentId}`, { headers })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((payload) => {
        const rows: Reading[] = payload.data ?? [];
        const row = rows.at(-1);
        if (row) {
          setLatest(row);
          if (row.heartRate != null) setHeartRate(String(row.heartRate));
          if (row.oxygenSaturation != null) setSpo2(String(row.oxygenSaturation));
          if (row.systolicPressure != null) setSystolic(String(row.systolicPressure));
          if (row.diastolicPressure != null) setDiastolic(String(row.diastolicPressure));
        }
      })
      .catch(() => undefined);
  }, [appointmentId, headers, token]);

  const save = async (forcedSource = source) => {
    if (!token) return setStatus(vi ? 'Vui lòng đăng nhập.' : 'Please sign in.');
    const body = {
      appointmentId: Number(appointmentId),
      heartRate: heartRate === '' ? undefined : Number(heartRate),
      oxygenSaturation: spo2 === '' ? undefined : Number(spo2),
      systolicPressure: systolic === '' ? undefined : Number(systolic),
      diastolicPressure: diastolic === '' ? undefined : Number(diastolic),
      source: forcedSource,
      deviceName: deviceName || undefined,
      notes: forcedSource === 'SIMULATED' ? 'Dữ liệu mô phỏng phục vụ demo, không dùng chẩn đoán.' : undefined,
    };
    setSaving(true);
    setStatus('');
    try {
      const response = await fetch(`${API_URL}/vital-signs`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? 'Save failed');
      setLatest(payload.data);
      setStatus(payload.message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : (vi ? 'Không thể lưu chỉ số.' : 'Could not save readings.'));
    } finally {
      setSaving(false);
    }
  };

  const simulate = async () => {
    setHeartRate(String(78 + Math.floor(Math.random() * 12)));
    setSpo2(String(96 + Math.floor(Math.random() * 4)));
    setSystolic(String(112 + Math.floor(Math.random() * 15)));
    setDiastolic(String(72 + Math.floor(Math.random() * 10)));
    setSource('SIMULATED');
    setDeviceName('Demo simulator');
    setStatus(vi
      ? 'Đã tạo bộ số mô phỏng. Bấm Lưu để ghi DB với nhãn MÔ PHỎNG.'
      : 'Simulation generated. Save it to DB with a SIMULATED label.');
  };

  const connectBluetooth = async () => {
    const bluetooth = (navigator as Navigator & { bluetooth?: any }).bluetooth;
    if (!bluetooth) {
      setStatus(vi
        ? 'Trình duyệt này không hỗ trợ Web Bluetooth. Hãy dùng Chrome/Edge máy tính hoặc nhập tay.'
        : 'Web Bluetooth is unavailable. Use desktop Chrome/Edge or enter readings manually.');
      return;
    }

    try {
      setStatus(vi ? 'Đang chọn thiết bị…' : 'Selecting a device…');
      const device = await bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['heart_rate', 'blood_pressure', 'pulse_oximeter'],
      });
      setDeviceName(device.name || 'Bluetooth device');
      const server = await device.gatt?.connect();
      if (!server) throw new Error(vi ? 'Không kết nối được GATT.' : 'Could not connect to GATT.');

      setSource('BLUETOOTH');
      try {
        const service = await server.getPrimaryService('heart_rate');
        const characteristic = await service.getCharacteristic('heart_rate_measurement');
        const apply = (value: DataView) => setHeartRate(String(parseHeartRate(value)));
        if (characteristic.value) apply(characteristic.value);
        await characteristic.startNotifications();
        characteristic.addEventListener('characteristicvaluechanged', (event: Event) => {
          const value = (event.target as any).value as DataView | undefined;
          if (value) apply(value);
        });
        setStatus(vi
          ? 'Đã kết nối và đang đọc nhịp tim Bluetooth. Nhấn Lưu khi số ổn định.'
          : 'Connected and reading Bluetooth heart rate. Save when stable.');
      } catch {
        setStatus(vi
          ? 'Đã kết nối thiết bị, nhưng thiết bị không mở chuẩn Heart Rate cho web. Nhập số từ màn hình máy rồi lưu với tên thiết bị.'
          : 'Device connected, but it does not expose the standard Heart Rate service. Enter its displayed readings and save with the device name.');
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : (vi ? 'Đã hủy hoặc kết nối thất bại.' : 'Cancelled or connection failed.'));
    }
  };

  const displayedSource = latest?.source ?? source;
  const inputClass = 'w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-sky-400';

  return (
    <section className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-sky-700">
            {vi ? 'FR26 · Chỉ số sinh tồn' : 'FR26 · Vital signs'}
          </p>
          <h3 className="mt-2 text-xl font-black text-slate-950">
            {vi ? 'Nhập tay, Bluetooth hoặc mô phỏng có nhãn' : 'Manual, Bluetooth, or labelled simulation'}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {vi
              ? 'Không suy đoán SpO₂ từ webcam. Mọi bản ghi đều lưu nguồn đo trong MySQL.'
              : 'SpO₂ is not guessed from a webcam. Every record stores its source in MySQL.'}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-black ${
          displayedSource === 'BLUETOOTH' ? 'bg-blue-100 text-blue-700' :
          displayedSource === 'SIMULATED' ? 'bg-amber-100 text-amber-800' :
          'bg-emerald-100 text-emerald-700'
        }`}>
          {sourceLabel[displayedSource][language]}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-bold text-slate-600">{vi ? 'Nhịp tim (bpm)' : 'Heart rate (bpm)'}
          <input className={`${inputClass} mt-2`} inputMode="decimal" value={heartRate} onChange={(e) => { setHeartRate(e.target.value); setSource('MANUAL'); }} />
        </label>
        <label className="text-xs font-bold text-slate-600">SpO₂ (%)
          <input className={`${inputClass} mt-2`} inputMode="decimal" value={spo2} onChange={(e) => { setSpo2(e.target.value); setSource('MANUAL'); }} />
        </label>
        <label className="text-xs font-bold text-slate-600">{vi ? 'Tâm thu (mmHg)' : 'Systolic (mmHg)'}
          <input className={`${inputClass} mt-2`} inputMode="decimal" value={systolic} onChange={(e) => { setSystolic(e.target.value); setSource('MANUAL'); }} />
        </label>
        <label className="text-xs font-bold text-slate-600">{vi ? 'Tâm trương (mmHg)' : 'Diastolic (mmHg)'}
          <input className={`${inputClass} mt-2`} inputMode="decimal" value={diastolic} onChange={(e) => { setDiastolic(e.target.value); setSource('MANUAL'); }} />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={connectBluetooth} className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">
          <Bluetooth className="h-4 w-4" /> {vi ? 'Kết nối Bluetooth' : 'Connect Bluetooth'}
        </button>
        <button type="button" onClick={simulate} className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2.5 text-sm font-bold text-amber-900 hover:bg-amber-200">
          <TestTube2 className="h-4 w-4" /> {vi ? 'Tạo số demo' : 'Generate demo'}
        </button>
        <button type="button" disabled={saving} onClick={() => save()} className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
          <Save className="h-4 w-4" /> {saving ? (vi ? 'Đang lưu…' : 'Saving…') : (vi ? 'Lưu vào DB' : 'Save to DB')}
        </button>
      </div>

      {(heartRate || spo2 || systolic || diastolic) && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-rose-50 p-4"><Heart className="h-5 w-5 text-rose-500" /><b className="mt-2 block text-2xl">{heartRate || '—'} bpm</b></div>
          <div className="rounded-2xl bg-cyan-50 p-4"><Zap className="h-5 w-5 text-cyan-500" /><b className="mt-2 block text-2xl">{spo2 || '—'}%</b></div>
          <div className="rounded-2xl bg-blue-50 p-4"><b className="block text-xs text-blue-700">{vi ? 'HUYẾT ÁP' : 'BLOOD PRESSURE'}</b><b className="mt-2 block text-2xl">{systolic || '—'}/{diastolic || '—'}</b></div>
        </div>
      )}

      {deviceName && <p className="mt-3 text-xs text-slate-500">{vi ? 'Thiết bị' : 'Device'}: <b>{deviceName}</b></p>}
      {status && <p className="mt-3 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">{status}</p>}
      <p className="mt-3 text-xs leading-5 text-slate-400">
        {vi
          ? 'Demo học thuật, không phải thiết bị y tế. Máy Omron có thể cần ứng dụng Omron Connect hoặc giao thức riêng; khi đó hãy nhập tay số máy hiển thị.'
          : 'Academic demo, not a medical device. Omron devices may require Omron Connect or a proprietary protocol; enter the displayed reading manually in that case.'}
      </p>
    </section>
  );
}
