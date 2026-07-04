import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  CalendarDays,
  Heart,
  Send,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Video,
  Zap,
} from 'lucide-react';

interface Doctor {
  id: number;
  name: string;
  specialty: string;
}

interface Message {
  sender: 'patient' | 'doctor';
  text: string;
  time: string;
}

interface ApiDoctorProfile {
  specialty?: string;
  experienceYears?: number;
  bio?: string | null;
}

interface ApiDoctorUser {
  id: number;
  email: string;
  fullName: string;
  role: string;
  doctorProfile?: ApiDoctorProfile | null;
}

interface ApiWrapper<T> {
  message?: string;
  data: T;
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

function Clinic() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const docId = searchParams.get('doc');

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [heartRate, setHeartRate] = useState(84);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fallback: Doctor = { id: 1, name: 'BS. Trực tuyến', specialty: 'Đa khoa' };

    if (!docId) {
      setDoctor(fallback);
      return;
    }

    fetch(`${API_URL}/doctors/${docId}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Doctor not found');
        }
        return response.json();
      })
      .then((payload: ApiWrapper<ApiDoctorUser> | ApiDoctorUser) => {
        const doctor = Array.isArray(payload) ? payload[0] : 'data' in payload ? payload.data : payload;

        setDoctor({
          id: doctor.id,
          name: doctor.fullName,
          specialty: doctor.doctorProfile?.specialty ?? 'Đa khoa',
        });
      })
      .catch(() => setDoctor(fallback));
  }, [docId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setHeartRate((previous) => {
        const next = previous + (Math.random() > 0.5 ? 1 : -1);
        return next >= 80 && next <= 88 ? next : previous;
      });
    }, 2500);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (event: React.FormEvent) => {
    event.preventDefault();

    if (!chatInput.trim()) {
      return;
    }

    setMessages((previous) => [
      ...previous,
      {
        sender: 'patient',
        text: chatInput.trim(),
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setChatInput('');
  };

  return (
    <div className="min-h-screen text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.12),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#edf5ff_50%,_#f8fafc_100%)]" />

      <header className="sticky top-0 z-50 border-b border-white/60 bg-white/80 backdrop-blur-xl shadow-[0_8px_32px_rgba(15,23,42,0.04)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-sky-200 hover:text-sky-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Về trang chủ
            </button>
            <div className="hidden items-center gap-3 sm:flex">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-sky-600 via-cyan-500 to-emerald-500 text-xs font-black tracking-[0.2em] text-white shadow-lg shadow-sky-500/20">
                OS
              </div>
              <div>
                <p className="text-sm font-extrabold text-slate-950">Phòng khám trực tuyến</p>
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
                  Workspace tư vấn live
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 sm:inline-flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Đang trực tuyến
            </div>
            <div className="rounded-full border border-sky-100 bg-sky-50 px-3 py-2 text-sm font-bold text-sky-700">
              Mã cuộc hẹn #{docId ?? '1'}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1.6fr_0.95fr] lg:px-8">
        <section className="space-y-6">
          <div className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/15">
                  <Video className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Phòng video</p>
                  <h1 className="text-lg font-black tracking-tight text-slate-950">
                    {doctor?.name ?? 'Đang tải bác sĩ...'}
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700">
                <ShieldCheck className="h-4 w-4" />
                Kết nối bảo mật
              </div>
            </div>

            <div className="relative aspect-video overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.25),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)]">
              <div className="absolute left-5 top-5 z-10 rounded-full border border-white/10 bg-slate-950/60 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
                Bác sĩ: <span className="text-sky-300">{doctor?.name ?? '...'}</span>
              </div>

              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center text-white">
                <div className="grid h-20 w-20 place-items-center rounded-[1.75rem] border border-white/10 bg-white/10 text-4xl shadow-2xl shadow-sky-950/20 backdrop-blur">
                  🩺
                </div>
                <div className="max-w-xl space-y-2">
                  <p className="text-2xl font-black tracking-tight sm:text-3xl">
                    Đang thiết lập phiên tư vấn an toàn
                  </p>
                  <p className="text-sm leading-7 text-slate-300">
                    Video, chat và dữ liệu theo dõi được trình bày như một workspace thực tế, thay vì chỉ là một
                    mô phỏng đơn giản.
                  </p>
                </div>
              </div>

              <div className="absolute bottom-5 right-5 w-44 rounded-3xl border border-white/10 bg-white/10 p-4 text-white backdrop-blur-xl shadow-2xl shadow-slate-950/20">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-100/80">Bạn</p>
                  <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/80">
                    Camera
                  </span>
                </div>
                <div className="mt-4 grid h-24 place-items-center rounded-2xl bg-black/20 text-center">
                  <div>
                    <div className="text-3xl">👤</div>
                    <p className="mt-2 text-xs font-semibold text-slate-200">Bệnh nhân</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Nhịp tim</p>
                  <p className="mt-2 text-4xl font-black tracking-tight text-slate-950 tabular-nums">
                    {heartRate}
                    <span className="ml-2 text-sm font-semibold text-slate-400">bpm</span>
                  </p>
                </div>
                <div className="grid h-16 w-16 place-items-center rounded-3xl bg-rose-50 text-rose-500">
                  <Heart className="h-7 w-7 fill-current" />
                </div>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                Chỉ số sinh tồn đang được mô phỏng theo thời gian thực để tạo cảm giác theo dõi y tế sống động hơn.
              </p>
            </div>

            <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">SpO2</p>
                  <p className="mt-2 text-4xl font-black tracking-tight text-slate-950">
                    100<span className="ml-2 text-sm font-semibold text-slate-400">%</span>
                  </p>
                </div>
                <div className="grid h-16 w-16 place-items-center rounded-3xl bg-cyan-50 text-cyan-500">
                  <Zap className="h-7 w-7" />
                </div>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                Giao diện số liệu được làm thành những khối riêng để giảm rối mắt và tăng độ cao cấp cho màn hình.
              </p>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-sky-700">AI monitoring</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                  Giám sát sinh tồn và kết nối khám bệnh
                </h2>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500">
                <Sparkles className="h-4 w-4 text-sky-600" />
                Cập nhật gần nhất: 1 giây trước
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.75rem] border border-slate-100 bg-gradient-to-br from-white to-rose-50 p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-500">Nhịp tim hiện tại</p>
                <div className="mt-4 flex items-end gap-2">
                  <span className="text-5xl font-black tracking-tight text-slate-950 tabular-nums">{heartRate}</span>
                  <span className="pb-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">bpm</span>
                </div>
                <div className="mt-4 flex h-12 items-end gap-1">
                  {[32, 56, 40, 72, 48, 84, 60, 76].map((height, index) => (
                    <div
                      key={`${height}-${index}`}
                      className="flex-1 rounded-full bg-rose-300/70"
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-slate-100 bg-gradient-to-br from-white to-cyan-50 p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-600">Phân tích nền</p>
                <div className="mt-4 flex items-end gap-2">
                  <span className="text-5xl font-black tracking-tight text-slate-950">100</span>
                  <span className="pb-2 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-600">% SpO2</span>
                </div>
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {['A', 'B', 'C', 'D'].map((item, index) => (
                    <div
                      key={item}
                      className="rounded-2xl bg-cyan-100/70 text-center text-xs font-black text-cyan-700"
                      style={{ paddingBlock: `${18 + index * 4}px` }}
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-sky-100 bg-sky-50 p-4 text-sm leading-7 text-slate-600">
              <div className="flex items-center gap-2 font-semibold text-sky-700">
                <Sparkles className="h-4 w-4" />
                Mô tả phiên tư vấn
              </div>
              <p className="mt-2">
                Hệ thống đang theo dõi các chỉ số cơ bản, ghi nhận nội dung trao đổi và giữ nhịp giao diện nhẹ,
                sạch, dễ nhìn hơn cho người bệnh.
              </p>
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-sky-700">Bác sĩ</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                  {doctor?.name ?? 'Đang tải...'}
                </h2>
                <p className="mt-2 text-sm text-slate-500">{doctor?.specialty ?? 'Chuyên khoa'}</p>
              </div>
              <div className="grid h-14 w-14 place-items-center rounded-3xl bg-slate-950 text-white">
                <Stethoscope className="h-6 w-6" />
              </div>
            </div>

            <div className="mt-5 grid gap-3 text-sm text-slate-600">
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="flex items-center gap-2 font-semibold text-slate-500">
                  <CalendarDays className="h-4 w-4 text-sky-600" />
                  Mã cuộc hẹn
                </span>
                <span className="font-bold text-slate-950">#{docId ?? '1'}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="flex items-center gap-2 font-semibold text-slate-500">
                  <Activity className="h-4 w-4 text-emerald-600" />
                  Trạng thái
                </span>
                <span className="font-bold text-emerald-600">Sẵn sàng</span>
              </div>
            </div>
          </div>

          <div className="flex h-[560px] flex-col overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Chat</p>
                <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">Trao đổi trực tuyến</h3>
              </div>
              <div className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-sky-700">
                Real-time
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50/60 p-4">
              {messages.length === 0 ? (
                <div className="mx-auto flex h-full max-w-[220px] flex-col items-center justify-center text-center">
                  <div className="grid h-14 w-14 place-items-center rounded-3xl bg-white text-sky-600 shadow-sm">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <h4 className="mt-4 text-sm font-bold text-slate-950">Chưa có tin nhắn</h4>
                  <p className="mt-2 text-xs leading-6 text-slate-500">
                    Bắt đầu câu hỏi đầu tiên để phiên khám trông giống một workspace thực tế hơn.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {messages.map((message, index) => (
                    <div key={`${message.time}-${index}`} className="flex flex-col items-end gap-1">
                      <div className="max-w-[85%] rounded-3xl rounded-tr-md bg-gradient-to-r from-sky-600 to-cyan-600 px-4 py-3 text-sm font-medium text-white shadow-sm">
                        {message.text}
                      </div>
                      <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        {message.time}
                      </span>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              )}
            </div>

            <form onSubmit={handleSend} className="border-t border-slate-100 bg-white p-4">
              <div className="flex items-center gap-2 rounded-3xl border border-slate-200 bg-slate-50 px-3 py-2.5 focus-within:border-sky-300 focus-within:bg-white">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder="Nhập nội dung gửi bác sĩ..."
                  className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        </aside>
      </main>
    </div>
  );
}

export default Clinic;
