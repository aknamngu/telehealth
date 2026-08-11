import { ShieldCheck, X } from 'lucide-react';
import { useLanguage } from './i18n';

export const POLICY_VERSION = '2026-08-11';

export default function PrivacyPolicyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[10001] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="privacy-title">
      <section className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 p-6">
          <div className="flex gap-3"><ShieldCheck className="mt-1 h-6 w-6 text-emerald-600" /><div><h2 id="privacy-title" className="text-xl font-black text-slate-950">{t('policyTitle')}</h2><p className="text-sm text-slate-500">{t('policyIntro')}</p></div></div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label={t('close')}><X className="h-5 w-5" /></button>
        </header>
        <div className="max-h-[55vh] space-y-4 overflow-y-auto p-6 text-sm leading-7 text-slate-700">
          <p>{t('policyBody')}</p>
          <h3 className="font-bold text-slate-950">1. Dữ liệu được xử lý / Data processed</h3><p>Thông tin tài khoản, lịch hẹn, hồ sơ y tế, đơn thuốc, tin nhắn và nhật ký kỹ thuật của phiên tư vấn.</p>
          <h3 className="font-bold text-slate-950">2. Mục đích / Purpose</h3><p>Cung cấp tư vấn từ xa, đảm bảo an toàn người bệnh, thanh toán, hỗ trợ và kiểm tra truy cập.</p>
          <h3 className="font-bold text-slate-950">3. Quyền của người dùng / Your rights</h3><p>Người dùng có thể yêu cầu xem, sửa, giới hạn xử lý hoặc xóa dữ liệu theo quy định và thời hạn lưu trữ y tế.</p>
        </div>
        <footer className="border-t border-slate-100 p-5 text-right"><button type="button" onClick={onClose} className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white">{t('close')}</button></footer>
      </section>
    </div>
  );
}
