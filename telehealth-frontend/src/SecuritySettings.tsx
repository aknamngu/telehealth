import { useEffect, useState } from 'react';
import { ArrowLeft, KeyRound, ShieldCheck, ShieldOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getAuthToken } from './auth';
import { useLanguage } from './i18n';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

type Status = { email: string; emailVerified: boolean; twoFactorEnabled: boolean; setupPending: boolean };
type Setup = { qrDataUrl: string; manualKey: string };

export default function SecuritySettings() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const vi = language === 'vi';
  const [status, setStatus] = useState<Status | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const request = async (path: string, init?: RequestInit) => {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}`, ...(init?.headers ?? {}) },
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? (vi ? 'Không thể xử lý yêu cầu.' : 'Unable to process request.'));
    return payload;
  };

  async function loadStatus() {
    try { const payload = await request('/auth/2fa/status'); setStatus(payload.data); }
    catch (error) { setMessage({ ok: false, text: error instanceof Error ? error.message : 'Error' }); }
  }

  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/auth/2fa/status`, {
      headers: { Authorization: `Bearer ${getAuthToken()}` },
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message ?? 'Unable to load security status.');
        if (active) setStatus(payload.data);
      })
      .catch((error) => {
        if (active) setMessage({ ok: false, text: error instanceof Error ? error.message : 'Error' });
      });
    return () => { active = false; };
  }, []);

  async function beginSetup() {
    setLoading(true); setMessage(null);
    try { const payload = await request('/auth/2fa/setup', { method: 'POST' }); setSetup(payload.data); }
    catch (error) { setMessage({ ok: false, text: error instanceof Error ? error.message : 'Error' }); }
    finally { setLoading(false); }
  }

  async function enable() {
    setLoading(true); setMessage(null);
    try {
      const payload = await request('/auth/2fa/enable', { method: 'POST', body: JSON.stringify({ code }) });
      setMessage({ ok: true, text: payload.message }); setSetup(null); setCode(''); await loadStatus();
    } catch (error) { setMessage({ ok: false, text: error instanceof Error ? error.message : 'Error' }); }
    finally { setLoading(false); }
  }

  async function disable() {
    setLoading(true); setMessage(null);
    try {
      const payload = await request('/auth/2fa/disable', { method: 'POST', body: JSON.stringify({ password, code }) });
      setMessage({ ok: true, text: payload.message }); setCode(''); setPassword(''); await loadStatus();
    } catch (error) { setMessage({ ok: false, text: error instanceof Error ? error.message : 'Error' }); }
    finally { setLoading(false); }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900">
      <section className="mx-auto max-w-2xl rounded-[2rem] bg-white p-7 shadow-xl sm:p-10">
        <button onClick={() => navigate('/dashboard')} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600"><ArrowLeft className="h-4 w-4" />{vi ? 'Về bảng điều khiển' : 'Back to dashboard'}</button>
        <div className="mt-8 flex items-start gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-sky-100 text-sky-700"><ShieldCheck className="h-7 w-7" /></div>
          <div><h1 className="text-3xl font-black">{vi ? 'Bảo mật tài khoản' : 'Account security'}</h1><p className="mt-2 text-sm text-slate-600">{vi ? 'Bảo vệ đăng nhập bằng Google Authenticator hoặc ứng dụng TOTP tương thích.' : 'Protect sign-in with Google Authenticator or any compatible TOTP app.'}</p></div>
        </div>

        <div className="mt-8 rounded-3xl border border-slate-200 p-5">
          <div className="flex items-center justify-between gap-4"><div><p className="font-bold">{vi ? 'Xác thực hai lớp (2FA)' : 'Two-factor authentication (2FA)'}</p><p className="mt-1 text-sm text-slate-500">{status?.email ?? '…'}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${status?.twoFactorEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{status?.twoFactorEnabled ? (vi ? 'Đang bật' : 'Enabled') : (vi ? 'Đang tắt' : 'Disabled')}</span></div>

          {!status?.twoFactorEnabled && !setup && <button disabled={loading || !status} onClick={beginSetup} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 font-bold text-white disabled:opacity-40"><KeyRound className="h-4 w-4" />{vi ? 'Thiết lập Google Authenticator' : 'Set up Google Authenticator'}</button>}

          {setup && <div className="mt-6 space-y-4 border-t border-slate-100 pt-6">
            <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-600"><li>{vi ? 'Mở Google Authenticator và quét mã QR.' : 'Open Google Authenticator and scan the QR code.'}</li><li>{vi ? 'Nhập mã 6 số đang hiển thị để xác nhận.' : 'Enter the current 6-digit code to confirm.'}</li></ol>
            <img src={setup.qrDataUrl} alt="Google Authenticator QR" className="mx-auto h-56 w-56 rounded-2xl border border-slate-200" />
            <div className="rounded-2xl bg-slate-50 p-3 text-center text-xs text-slate-600">{vi ? 'Khóa nhập tay' : 'Manual key'}<strong className="mt-1 block break-all font-mono text-sm tracking-wider text-slate-900">{setup.manualKey}</strong></div>
            <input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-center text-xl font-black tracking-[.3em]" />
            <button disabled={loading || code.length !== 6} onClick={enable} className="w-full rounded-2xl bg-emerald-600 px-5 py-3 font-bold text-white disabled:opacity-40">{vi ? 'Xác nhận và bật 2FA' : 'Confirm and enable 2FA'}</button>
          </div>}

          {status?.twoFactorEnabled && <div className="mt-6 space-y-4 border-t border-slate-100 pt-6">
            <p className="text-sm text-slate-600">{vi ? 'Để tắt 2FA, nhập mật khẩu và mã hiện tại trong ứng dụng.' : 'To disable 2FA, enter your password and the current app code.'}</p>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={vi ? 'Mật khẩu hiện tại' : 'Current password'} className="w-full rounded-2xl border border-slate-200 px-4 py-3" />
            <input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-center text-xl font-black tracking-[.3em]" />
            <button disabled={loading || !password || code.length !== 6} onClick={disable} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 font-bold text-rose-700 disabled:opacity-40"><ShieldOff className="h-4 w-4" />{vi ? 'Tắt xác thực hai lớp' : 'Disable two-factor authentication'}</button>
          </div>}
        </div>
        {message && <p className={`mt-5 rounded-2xl p-4 text-sm font-semibold ${message.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{message.text}</p>}
      </section>
    </main>
  );
}
