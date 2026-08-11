import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PrivacyPolicyModal, { POLICY_VERSION } from './PrivacyPolicyModal';
import { useLanguage } from './i18n';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export default function Register() {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'PATIENT' });
  const [policyOpened, setPolicyOpened] = useState(false);
  const [policyVisible, setPolicyVisible] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!policyOpened || !accepted) return setMessage({ ok: false, text: language === 'vi' ? 'Hãy mở, đọc và đồng ý chính sách trước.' : 'Please open, read and accept the policy first.' });
    setLoading(true); setMessage(null);
    try {
      const response = await fetch(`${API_URL}/users`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, preferredLanguage: language, consentAccepted: true, consentPolicyVersion: POLICY_VERSION }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Registration failed');
      navigate('/login', { replace: true });
    } catch (error) { setMessage({ ok: false, text: error instanceof Error ? error.message : 'Registration failed' }); }
    finally { setLoading(false); }
  }

  return <main className="min-h-screen bg-slate-950 px-4 py-20 text-slate-900">
    <form onSubmit={submit} className="mx-auto max-w-xl space-y-5 rounded-[2rem] bg-white p-7 shadow-2xl sm:p-10">
      <div><p className="text-xs font-bold uppercase tracking-[.2em] text-sky-700">OS TeleHealth</p><h1 className="mt-2 text-3xl font-black">{t('registerTitle')}</h1></div>
      <label className="block text-sm font-semibold">{t('fullName')}<input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
      <label className="block text-sm font-semibold">{t('email')}<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
      <label className="block text-sm font-semibold">{t('password')}<input required minLength={8} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
      <label className="block text-sm font-semibold">{t('role')}<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"><option value="PATIENT">{t('patient')}</option><option value="DOCTOR">{t('doctor')}</option></select></label>
      <button type="button" onClick={() => { setPolicyOpened(true); setPolicyVisible(true); }} className="text-sm font-bold text-sky-700 underline">{t('readPolicy')}</button>
      <label className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm"><input type="checkbox" disabled={!policyOpened} checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1" /><span>{t('privacyAgreement')}</span></label>
      {message && <p className="rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{message.text}</p>}
      <button disabled={loading || !accepted} className="w-full rounded-2xl bg-slate-950 px-5 py-3 font-bold text-white disabled:opacity-40">{loading ? t('registering') : t('register')}</button>
      <Link to="/login" className="block text-center text-sm font-semibold text-slate-600">{t('backLogin')}</Link>
    </form>
    <PrivacyPolicyModal open={policyVisible} onClose={() => setPolicyVisible(false)} />
  </main>;
}
