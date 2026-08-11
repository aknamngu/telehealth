/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getAuthToken } from './auth';

export type Language = 'vi' | 'en';

const messages = {
  vi: {
    language: 'Ngôn ngữ', vietnamese: 'Tiếng Việt', english: 'English',
    loginTitle: 'Đăng nhập để vào dashboard theo đúng vai trò của bạn',
    loginDescription: 'Mỗi tài khoản chỉ nhìn thấy dữ liệu theo quyền hạn của mình.',
    email: 'Email', password: 'Mật khẩu', login: 'Vào dashboard', loggingIn: 'Đang đăng nhập...',
    backHome: 'Quay về trang chủ', createAccount: 'Tạo tài khoản', sampleAccounts: 'Tài khoản mẫu để test nhanh',
    registerTitle: 'Đăng ký TeleHealth', fullName: 'Họ và tên', role: 'Vai trò', patient: 'Bệnh nhân', doctor: 'Bác sĩ',
    privacyAgreement: 'Tôi đã đọc và đồng ý Chính sách bảo mật và Điều khoản tư vấn trực tuyến.',
    readPolicy: 'Đọc chính sách', register: 'Đăng ký', registering: 'Đang tạo tài khoản...', backLogin: 'Đã có tài khoản? Đăng nhập',
    policyTitle: 'Chính sách bảo mật dữ liệu y tế', policyIntro: 'Phiên bản 2026-08-11',
    policyBody: 'TeleHealth chỉ thu thập dữ liệu cần thiết để cung cấp dịch vụ khám từ xa. Hồ sơ y tế, nội dung trao đổi và dữ liệu phiên tư vấn được giới hạn cho người dùng liên quan và nhân sự được phân quyền. Bạn có quyền yêu cầu xem, sửa hoặc xóa dữ liệu theo quy định áp dụng. Video chỉ được ghi khi có sự đồng ý riêng. Khi đồng ý, hệ thống lưu thời điểm, phiên bản chính sách và buổi tư vấn tương ứng để phục vụ kiểm tra.',
    close: 'Đóng', consultationConsentTitle: 'Xác nhận trước buổi tư vấn',
    consultationConsentText: 'Trước khi kết nối, bạn phải đọc và đồng ý việc xử lý dữ liệu y tế cho đúng buổi tư vấn này.',
    acceptConsultation: 'Tôi đã đọc và đồng ý cho buổi tư vấn này', continueClinic: 'Đồng ý và vào phòng tư vấn', saving: 'Đang ghi nhận...',
  },
  en: {
    language: 'Language', vietnamese: 'Tiếng Việt', english: 'English',
    loginTitle: 'Sign in to your role-based dashboard',
    loginDescription: 'Each account can only access data permitted for its role.',
    email: 'Email', password: 'Password', login: 'Open dashboard', loggingIn: 'Signing in...',
    backHome: 'Back to home', createAccount: 'Create account', sampleAccounts: 'Sample accounts for quick testing',
    registerTitle: 'Create a TeleHealth account', fullName: 'Full name', role: 'Role', patient: 'Patient', doctor: 'Doctor',
    privacyAgreement: 'I have read and agree to the Privacy Policy and Online Consultation Terms.',
    readPolicy: 'Read policy', register: 'Create account', registering: 'Creating account...', backLogin: 'Already registered? Sign in',
    policyTitle: 'Health Data Privacy Policy', policyIntro: 'Version 2026-08-11',
    policyBody: 'TeleHealth only collects data required to provide remote healthcare. Medical records, messages and consultation data are restricted to the participants and authorized personnel. You may request access, correction or deletion where applicable. Video is recorded only with separate consent. When you consent, the system stores the time, policy version and related consultation for audit purposes.',
    close: 'Close', consultationConsentTitle: 'Confirmation before consultation',
    consultationConsentText: 'Before connecting, you must read and agree to health-data processing for this specific consultation.',
    acceptConsultation: 'I have read and agree for this consultation', continueClinic: 'Agree and enter consultation', saving: 'Saving consent...',
  },
} as const;

type MessageKey = keyof typeof messages.vi;
type LanguageContextValue = { language: Language; setLanguage: (language: Language) => void; t: (key: MessageKey) => string };

const LanguageContext = createContext<LanguageContextValue | null>(null);
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => localStorage.getItem('telehealth_language') === 'en' ? 'en' : 'vi');

  useEffect(() => {
    document.documentElement.lang = language;
    localStorage.setItem('telehealth_language', language);
  }, [language]);

  const setLanguage = (next: Language) => {
    setLanguageState(next);
    const token = getAuthToken();
    if (token) {
      void fetch(`${API_URL}/users/preferences/language`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ preferredLanguage: next }),
      });
    }
  };

  const value = useMemo(() => ({ language, setLanguage, t: (key: MessageKey) => messages[language][key] }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLanguage must be used inside LanguageProvider');
  return value;
}
