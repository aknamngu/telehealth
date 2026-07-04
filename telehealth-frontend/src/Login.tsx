import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Sparkles, Stethoscope } from 'lucide-react';
import { getAuthToken, setAuthSession } from './auth';

type LoginResponse = {
  message?: string;
  access_token: string;
  user: {
    id: number;
    email: string;
    fullName: string;
    role: 'ADMIN' | 'PATIENT' | 'DOCTOR';
    createdAt: string;
  };
};

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@telehealth.vn');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (getAuthToken()) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const payload = (await response.json()) as LoginResponse | { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? 'Không thể đăng nhập');
      }

      const data = payload as LoginResponse;
      setAuthSession(data.access_token, data.user);
      navigate('/dashboard', { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Không thể đăng nhập');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.16),_transparent_26%),linear-gradient(180deg,_#08111f_0%,_#0f172a_55%,_#f8fafc_100%)] text-white">
      <div className="mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
        <section className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100 backdrop-blur">
            <Sparkles className="h-4 w-4" />
            Secure telehealth access
          </div>
          <div className="space-y-4">
            <h1 className="max-w-2xl text-4xl font-black tracking-tight sm:text-6xl">
              Đăng nhập để vào dashboard theo đúng vai trò của bạn
            </h1>
            <p className="max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
              Mỗi tài khoản sẽ nhìn thấy dữ liệu riêng theo quyền hạn của mình. Admin xem tổng quan,
              bệnh nhân xem hồ sơ cá nhân, bác sĩ xem lịch và tương tác khám chữa.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ['Admin', 'Tổng quan hệ thống'],
              ['Bác sĩ', 'Lịch khám và bệnh nhân'],
              ['Bệnh nhân', 'Đơn thuốc và chỉ số sức khỏe'],
            ].map(([title, description]) => (
              <div key={title} className="rounded-3xl border border-white/10 bg-white/8 p-4 backdrop-blur">
                <p className="text-sm font-bold text-white">{title}</p>
                <p className="mt-1 text-sm text-slate-300">{description}</p>
              </div>
            ))}
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/8 p-6 backdrop-blur">
            <div className="flex items-center gap-3 text-sm font-semibold text-cyan-100">
              <ShieldCheck className="h-5 w-5" />
              Tài khoản mẫu để test nhanh
            </div>
            <div className="mt-4 grid gap-3 text-sm text-slate-200 sm:grid-cols-3">
              <div className="rounded-2xl bg-black/20 p-3">
                <p className="font-semibold text-white">Admin</p>
                <p>admin@telehealth.vn</p>
                <p>admin123</p>
              </div>
              <div className="rounded-2xl bg-black/20 p-3">
                <p className="font-semibold text-white">Doctor</p>
                <p>son.dang@example.com</p>
                <p>password123</p>
              </div>
              <div className="rounded-2xl bg-black/20 p-3">
                <p className="font-semibold text-white">Patient</p>
                <p>patient.an@example.com</p>
                <p>password123</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[2.25rem] border border-white/10 bg-white p-6 text-slate-900 shadow-[0_30px_80px_rgba(15,23,42,0.25)] sm:p-8">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-sky-600 via-cyan-500 to-emerald-500 text-white shadow-lg shadow-sky-500/25">
              <Stethoscope className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-sky-700">OS Telehealth</p>
              <p className="text-sm text-slate-500">Đăng nhập an toàn</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-700">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:bg-white"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-700">Mật khẩu</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:bg-white"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </label>

            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Đang đăng nhập...' : 'Vào dashboard'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-4 text-sm font-semibold text-slate-600 transition hover:text-sky-700"
          >
            Quay về trang chủ
          </button>
        </section>
      </div>
    </div>
  );
}

export default Login;
