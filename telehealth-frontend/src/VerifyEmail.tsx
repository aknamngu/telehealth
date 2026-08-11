import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, MailCheck, RefreshCw } from 'lucide-react';
import { useLanguage } from './i18n';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

type LocationState = { email?: string; devOtp?: string } | null;

export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const state = location.state as LocationState;
  const vi = language === 'vi';
  const [email, setEmail] = useState(state?.email ?? '');
  const [code, setCode] = useState(state?.devOtp ?? '');
  const [devOtp, setDevOtp] = useState(state?.devOtp ?? '');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function verify(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`${API_URL}/auth/email/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? (vi ? 'Không thể xác minh OTP.' : 'Unable to verify OTP.'));
      setMessage({ ok: true, text: vi ? 'Email đã xác minh. Đang chuyển đến đăng nhập…' : 'Email verified. Redirecting to sign in…' });
      window.setTimeout(() => navigate('/login', { replace: true, state: { email } }), 700);
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : (vi ? 'Có lỗi xảy ra.' : 'Something went wrong.') });
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`${API_URL}/auth/email/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? (vi ? 'Không thể gửi lại OTP.' : 'Unable to resend OTP.'));
      if (payload.devOtp) {
        setDevOtp(payload.devOtp);
        setCode(payload.devOtp);
      }
      setMessage({ ok: true, text: payload.message });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : (vi ? 'Có lỗi xảy ra.' : 'Something went wrong.') });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,_rgba(14,165,233,.2),_transparent_35%),#020617] px-4 py-16">
      <section className="w-full max-w-lg rounded-[2rem] bg-white p-7 shadow-2xl sm:p-10">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-sky-100 text-sky-700"><MailCheck className="h-7 w-7" /></div>
        <h1 className="mt-6 text-3xl font-black text-slate-950">{vi ? 'Xác minh email' : 'Verify your email'}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{vi ? 'Nhập mã OTP 6 số. Mã có hiệu lực trong 5 phút.' : 'Enter the 6-digit OTP. It is valid for 5 minutes.'}</p>

        {devOtp && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-bold">{vi ? 'Chế độ demo local' : 'Local demo mode'}</p>
            <p className="mt-1">{vi ? 'Chưa cấu hình SMTP nên mã thử là:' : 'SMTP is not configured, so your demo code is:'} <strong className="text-lg tracking-[.2em]">{devOtp}</strong></p>
          </div>
        )}

        <form onSubmit={verify} className="mt-6 space-y-4">
          <label className="block text-sm font-semibold text-slate-700">Email
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-sky-400" />
          </label>
          <label className="block text-sm font-semibold text-slate-700">{vi ? 'Mã OTP' : 'OTP code'}
            <input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-2xl font-black tracking-[.3em] outline-none focus:border-sky-400" placeholder="000000" />
          </label>
          {message && <p className={`rounded-2xl p-3 text-sm font-semibold ${message.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{message.text}</p>}
          <button disabled={loading || code.length !== 6} className="w-full rounded-2xl bg-slate-950 px-5 py-3.5 font-bold text-white disabled:opacity-40">{loading ? (vi ? 'Đang xử lý…' : 'Processing…') : (vi ? 'Xác minh email' : 'Verify email')}</button>
        </form>

        <div className="mt-5 flex items-center justify-between gap-3 text-sm font-semibold">
          <button type="button" onClick={() => navigate('/login')} className="inline-flex items-center gap-1 text-slate-600"><ArrowLeft className="h-4 w-4" />{vi ? 'Về đăng nhập' : 'Back to sign in'}</button>
          <button type="button" disabled={loading || !email} onClick={resend} className="inline-flex items-center gap-1 text-sky-700 disabled:opacity-40"><RefreshCw className="h-4 w-4" />{vi ? 'Gửi lại mã' : 'Resend code'}</button>
        </div>
      </section>
    </main>
  );
}
