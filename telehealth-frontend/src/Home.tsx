import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  ChevronRight,
  Clock3,
  HeartPulse,
  Hospital,
  Mail,
  MapPin,
  Microscope,
  PhoneCall,
  PlayCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Video,
  X,
  CalendarDays,
  CreditCard,
  Wallet,
  Banknote,
} from 'lucide-react';
import { getAuthToken, getAuthUser, type AuthUser } from './auth';
import { useLanguage } from './i18n';

interface Doctor {
  id: number;
  name: string;
  specialty: string;
  bio: string;
  yearsExp: number;
  rating: number;
  patientCount: number;
  isOnline: boolean;
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

interface BookingForm {
  doctorId: number;
  doctorName: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  symptoms: string;
  paymentMethod: string;
}

const servicesVi = [
  {
    icon: Video,
    title: 'Khám bệnh online',
    description: 'Hỗ trợ tư vấn từ xa với quy trình đặt lịch, video call và theo dõi sau khám rõ ràng.',
    price: 'Từ 120.000đ',
  },
  {
    icon: Microscope,
    title: 'Xét nghiệm tại nhà',
    description: 'Đặt lịch lấy mẫu linh hoạt, trả kết quả an toàn và đồng bộ ngay trên hệ thống.',
    price: 'Linh hoạt theo gói',
  },
  {
    icon: HeartPulse,
    title: 'Giao thuốc tận nơi',
    description: 'Kê đơn, nhắc thuốc và giao nhận nhanh cho người bệnh cần chăm sóc liên tục.',
    price: 'Theo đơn thuốc',
  },
];

const processStepsVi = [
  {
    title: 'Đặt lịch nhanh',
    description: 'Chọn chuyên khoa, chọn bác sĩ và khung giờ phù hợp chỉ trong vài thao tác.',
  },
  {
    title: 'Tư vấn trực tuyến',
    description: 'Nhận cuộc gọi video bảo mật với thông tin bệnh án và ghi chú rõ ràng.',
  },
  {
    title: 'Theo dõi liên tục',
    description: 'Nhận dặn dò, nhắc tái khám và các chỉ số theo dõi ngay sau phiên khám.',
  },
];

const socialStoriesVi = [
  {
    title: 'Phòng dịch học đường',
    description: 'Hỗ trợ các trường học xây dựng quy trình sàng lọc, tư vấn và ứng phó y tế an toàn.',
  },
  {
    title: 'Hội thảo sức khỏe cộng đồng',
    description: 'Tổ chức các chương trình giáo dục y tế giúp gia đình tiếp cận kiến thức thực tế hơn.',
  },
  {
    title: 'Tele-triage và e-consult',
    description: 'Rút ngắn thời gian tiếp cận bác sĩ, ưu tiên phân luồng các ca cần hỗ trợ sớm.',
  },
];

const partnerLogosVi = [
  'Bệnh viện đối tác',
  'Phòng xét nghiệm',
  'Trường học',
  'Cơ quan y tế',
  'Nhà thuốc',
  'Doanh nghiệp',
];

const servicesEn = [
  { icon: Video, title: 'Online consultation', description: 'Remote consultations with a clear booking, video call, and follow-up process.', price: 'From VND 120,000' },
  { icon: Microscope, title: 'At-home testing', description: 'Flexible sample collection, secure results, and seamless synchronization in one system.', price: 'Flexible packages' },
  { icon: HeartPulse, title: 'Medicine delivery', description: 'Prescriptions, medication reminders, and fast delivery for continuous patient care.', price: 'By prescription' },
];

const processStepsEn = [
  { title: 'Book quickly', description: 'Choose a specialty, doctor, and suitable time slot in just a few steps.' },
  { title: 'Consult online', description: 'Join a secure video call with medical records and clear consultation notes.' },
  { title: 'Continuous follow-up', description: 'Receive instructions, follow-up reminders, and health indicators after each consultation.' },
];

const socialStoriesEn = [
  { title: 'School health protection', description: 'Help schools build safe screening, consultation, and medical response workflows.' },
  { title: 'Community health workshops', description: 'Organize health education programs that give families practical knowledge.' },
  { title: 'Tele-triage and e-consult', description: 'Shorten access time and prioritize cases that require early medical support.' },
];

const partnerLogosEn = ['Partner hospitals', 'Laboratories', 'Schools', 'Health agencies', 'Pharmacies', 'Businesses'];

const PAYMENT_METHODS = [
  { id: 'WALLET', label: 'Ví ảo OS Telehealth', icon: Wallet, color: 'text-sky-600 bg-sky-50 border-sky-200' },
  { id: 'MOMO', label: 'MoMo', icon: Wallet, color: 'text-pink-600 bg-pink-50 border-pink-200' },
  { id: 'VNPAY', label: 'VNPay', icon: CreditCard, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { id: 'ZALOPAY', label: 'ZaloPay', icon: Banknote, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
];

// TIME_SLOTS removed

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

function formatDoctorName(name?: string) {
  if (!name) return '---';
  const trimmed = name.trim();
  if (/^(BS|ThS|TS|PGS|GS)\b/i.test(trimmed)) {
    return trimmed;
  }
  return `BS. ${trimmed}`;
}

const specialtyEn: Record<string, string> = {
  'Tim mạch & Cấp cứu AI': 'Cardiology & AI Emergency Care',
  'Nội tổng quát & Telehealth': 'General Medicine & Telehealth',
  'Nhi khoa & Dinh dưỡng': 'Pediatrics & Nutrition',
  'Da liễu & Khám từ xa': 'Dermatology & Telemedicine',
  'Đa khoa': 'General Medicine',
};

const doctorBioEn: Record<string, string> = {
  'Chuyên sâu về tim mạch, teletriage và giám sát sinh tồn theo thời gian thực.':
    'Specialized in cardiology, tele-triage, and real-time vital-sign monitoring.',
  'Phát triển quy trình chăm sóc từ xa, hồ sơ điện tử và điều trị đa bệnh lý.':
    'Developing remote-care workflows, electronic health records, and multi-condition treatment.',
  'Tối ưu chăm sóc trẻ em, tư vấn dinh dưỡng và theo dõi phát triển hằng tuần.':
    'Optimizing pediatric care, nutrition counseling, and weekly development monitoring.',
  'Xử lý các ca bệnh da liễu, đọc ảnh lâm sàng và hỗ trợ kê đơn chính xác.':
    'Managing dermatology cases, reviewing clinical images, and supporting accurate prescribing.',
};

function localizeDbText(value: string, translations: Record<string, string>, language: string) {
  if (language !== 'en') return value;
  return translations[value.trim()] ?? value;
}

function Home() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const tx = (vi: string, en: string) => language === 'vi' ? vi : en;
  const services = language === 'vi' ? servicesVi : servicesEn;
  const processSteps = language === 'vi' ? processStepsVi : processStepsEn;
  const socialStories = language === 'vi' ? socialStoriesVi : socialStoriesEn;
  const partnerLogos = language === 'vi' ? partnerLogosVi : partnerLogosEn;
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('');

  // Booking modal
  const [bookingModal, setBookingModal] = useState<BookingForm | null>(null);
  const [bookingStep, setBookingStep] = useState<1 | 2 | 3>(1); // 1=info, 2=payment, 3=success
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [bookingFieldErrors, setBookingFieldErrors] = useState<{ slot?: string; symptoms?: string }>({});
  const modalRef = useRef<HTMLDivElement>(null);
  const [availableSlots, setAvailableSlots] = useState<{startTime: string, endTime: string}[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  // SOS Emergency Modal
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [selectedEmergencyType, setSelectedEmergencyType] = useState('Đau thắt ngực / Khó thở');

  const authUser = getAuthUser() as AuthUser | null;

  async function handleEmergencySubmit() {
    if (!authUser || authUser.role !== 'PATIENT') {
      navigate('/login');
      return;
    }
    const token = getAuthToken();
    try {
      const response = await fetch(`${API_URL}/appointments/emergency`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ emergencyType: selectedEmergencyType }),
      });
      if (!response.ok) {
        throw new Error(tx('Lỗi khi tạo ca cấp cứu', 'Could not create the emergency case'));
      }
      const data = await response.json();
      const apptId = data.data.appointmentId;
      setShowEmergencyModal(false);
      navigate(`/clinic?appointmentId=${apptId}&isEmergency=true`);
    } catch (err) {
      console.error(err);
      alert(tx('Hệ thống gặp sự cố khi tạo ca cấp cứu. Hãy thử lại hoặc gọi số khẩn cấp quốc gia!', 'The emergency system encountered an error. Please try again or call your national emergency number.'));
    }
  }

  useEffect(() => {
    fetch(`${API_URL}/doctors`)
      .then((response) => response.json())
      .then((payload: ApiWrapper<ApiDoctorUser[]> | ApiDoctorUser[]) => {
        const records = Array.isArray(payload) ? payload : payload.data;
        const normalizedDoctors = records.map((doctor: any) => ({
          id: doctor.id,
          name: doctor.fullName,
          specialty: doctor.doctorProfile?.specialty ?? 'Đa khoa',
          bio: doctor.doctorProfile?.bio ?? '',
          yearsExp: doctor.doctorProfile?.experienceYears ?? 0,
          rating: doctor.rating ?? 5.0,
          patientCount: doctor.patientCount ?? 0,
          isOnline: false,
        }));
        setDoctors(normalizedDoctors);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Close modal on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        closeBookingModal();
      }
    }
    if (bookingModal) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [bookingModal]);

  // Tải danh sách giờ rảnh của bác sĩ
  useEffect(() => {
    if (bookingModal?.doctorId && bookingModal?.appointmentDate) {
      setLoadingSlots(true);
      const token = getAuthToken();
      fetch(`${API_URL}/doctors/${bookingModal.doctorId}/schedules?date=${bookingModal.appointmentDate}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      })
        .then(res => res.json())
        .then(data => {
          if (data.data) {
            // Lọc ra những khung giờ chưa bị đặt (isBooked = false)
            const unbooked = data.data.filter((s: any) => !s.isBooked);
            setAvailableSlots(unbooked);
          } else {
            setAvailableSlots([]);
          }
        })
        .catch(() => setAvailableSlots([]))
        .finally(() => setLoadingSlots(false));
    }
  }, [bookingModal?.doctorId, bookingModal?.appointmentDate]);

  // Unique specialties for filter
  const specialties = Array.from(new Set(doctors.map((d) => d.specialty))).filter(Boolean);

  const filteredDoctors = doctors.filter((d) => {
    const matchName = d.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchSpec = selectedSpecialty ? d.specialty === selectedSpecialty : true;
    return matchName && matchSpec;
  });

  async function openBookingModal(doctor: Doctor) {
    const token = getAuthToken();
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/wallet/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setWalletBalance(data.data.balance);
      }
    } catch (e) {
      console.error('Lỗi tải ví', e);
    }

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate() + 1).padStart(2, '0');
    setBookingModal({
      doctorId: doctor.id,
      doctorName: doctor.name,
      appointmentDate: `${yyyy}-${mm}-${dd}`,
      startTime: '',
      endTime: '',
      symptoms: '',
      paymentMethod: 'WALLET',
    });
    setBookingStep(1);
    setBookingError('');
    setBookingFieldErrors({});
    setAvailableSlots([]);
    document.body.style.overflow = 'hidden';
  }

  function closeBookingModal() {
    setBookingModal(null);
    setBookingStep(1);
    setBookingError('');
    setBookingFieldErrors({});
    setAvailableSlots([]);
    document.body.style.overflow = '';
  }

  function continueToPayment() {
    if (!bookingModal) return;

    const selectedSlotIsAvailable = availableSlots.some(
      (slot) =>
        slot.startTime === bookingModal.startTime &&
        slot.endTime === bookingModal.endTime,
    );
    const errors: { slot?: string; symptoms?: string } = {};

    if (!selectedSlotIsAvailable) {
      errors.slot = tx('Vui lòng chọn một khung giờ còn trống.', 'Please select an available time slot.');
    }
    if (!bookingModal.symptoms.trim()) {
      errors.symptoms = tx('Vui lòng mô tả triệu chứng trước khi tiếp tục.', 'Please describe your symptoms before continuing.');
    }

    setBookingFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setBookingError(tx('Vui lòng điền đầy đủ thông tin bắt buộc.', 'Please complete all required information.'));
      return;
    }

    setBookingModal({ ...bookingModal, symptoms: bookingModal.symptoms.trim() });
    setBookingError('');
    setBookingStep(2);
  }



  async function submitBooking() {
    if (!bookingModal) return;
    const token = getAuthToken();
    if (!token) { navigate('/login'); return; }

    const authUser = getAuthUser() as AuthUser | null;
    if (!authUser) { navigate('/login'); return; }

    if (!bookingModal.startTime || !bookingModal.endTime || !bookingModal.symptoms.trim()) {
      setBookingStep(1);
      setBookingFieldErrors({
        ...(!bookingModal.startTime || !bookingModal.endTime
          ? { slot: tx('Vui lòng chọn một khung giờ còn trống.', 'Please select an available time slot.') }
          : {}),
        ...(!bookingModal.symptoms.trim()
          ? { symptoms: tx('Vui lòng mô tả triệu chứng trước khi tiếp tục.', 'Please describe your symptoms before continuing.') }
          : {}),
      });
      setBookingError(tx('Vui lòng điền đầy đủ thông tin bắt buộc.', 'Please complete all required information.'));
      return;
    }

    setBookingLoading(true);
    setBookingError('');

    try {
      const res = await fetch(`${API_URL}/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          patientId: authUser.id,
          doctorId: bookingModal.doctorId,
          appointmentDate: bookingModal.appointmentDate,
          startTime: bookingModal.startTime,
          endTime: bookingModal.endTime,
          symptoms: bookingModal.symptoms.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? tx('Đặt lịch thất bại', 'Booking failed'));

      setBookingStep(3);
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : tx('Đặt lịch thất bại', 'Booking failed'));
    } finally {
      setBookingLoading(false);
    }
  }

  return (
    <div className="min-h-screen overflow-hidden text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.12),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#eef6ff_45%,_#f8fafc_100%)]" />

      {/* ─── BOOKING MODAL ─── */}
      {bookingModal && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm">
          <div
            ref={modalRef}
            className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"
            style={{ maxHeight: '90vh', overflowY: 'auto' }}
          >
            {/* Modal header */}
            <div className="bg-gradient-to-r from-sky-600 to-cyan-500 px-6 py-5 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-100">{tx('Đặt lịch khám', 'Book an appointment')}</p>
                  <h2 className="mt-1 text-xl font-black">{formatDoctorName(bookingModal.doctorName)}</h2>
                </div>
                <button
                  onClick={closeBookingModal}
                  className="grid h-9 w-9 place-items-center rounded-full bg-white/15 transition hover:bg-white/25"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Progress steps */}
              {bookingStep < 3 && (
                <div className="mt-4 flex items-center gap-2">
                  {[tx('Thông tin lịch', 'Appointment'), tx('Thanh toán', 'Payment')].map((label, i) => (
                    <div key={label} className="flex items-center gap-2">
                      <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black transition ${bookingStep > i + 1 ? 'bg-white text-sky-700' : bookingStep === i + 1 ? 'bg-white text-sky-700' : 'bg-white/20 text-white/60'}`}>
                        {i + 1}
                      </div>
                      <span className={`text-xs font-semibold ${bookingStep === i + 1 ? 'text-white' : 'text-white/60'}`}>{label}</span>
                      {i < 1 && <div className="h-px w-8 bg-white/30" />}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── STEP 1: Thông tin ── */}
            {bookingStep === 1 && (
              <div className="space-y-4 p-6">
                {/* Ngày */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                    <CalendarDays className="mr-1.5 inline h-3.5 w-3.5" />{tx('Ngày khám', 'Appointment date')}
                  </label>
                  <input
                    id="booking-date"
                    type="date"
                    value={bookingModal.appointmentDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => {
                      setBookingModal({
                        ...bookingModal,
                        appointmentDate: e.target.value,
                        startTime: '',
                        endTime: '',
                      });
                      setAvailableSlots([]);
                      setBookingFieldErrors((current) => ({ ...current, slot: undefined }));
                      setBookingError('');
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                  />
                </div>

                {/* Giờ */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                      <Clock3 className="mr-1.5 inline h-3.5 w-3.5" />{tx('Khung giờ trống', 'Available times')}
                    </label>
                    {loadingSlots && <span className="text-[10px] font-bold text-sky-600 animate-pulse">{tx('Đang tải...', 'Loading...')}</span>}
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {!loadingSlots && availableSlots.length === 0 && (
                      <div className="col-span-full py-4 text-center text-sm font-semibold text-slate-500 bg-slate-50 rounded-xl border border-slate-100">
                        {tx('Không có lịch rảnh nào trong ngày này.', 'No available times on this date.')}
                      </div>
                    )}
                    {availableSlots.map((slot) => (
                      <button
                        key={slot.startTime}
                        type="button"
                        onClick={() => {
                          setBookingModal({ ...bookingModal, startTime: slot.startTime, endTime: slot.endTime });
                          setBookingFieldErrors((current) => ({ ...current, slot: undefined }));
                          setBookingError('');
                        }}
                        className={`rounded-xl border px-2 py-2 text-xs font-bold transition ${bookingModal.startTime === slot.startTime ? 'border-sky-500 bg-sky-500 text-white shadow-md shadow-sky-500/30' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-sky-300 hover:bg-sky-50'}`}
                      >
                        {slot.startTime} - {slot.endTime}
                      </button>
                    ))}
                  </div>
                  {bookingModal.startTime && (
                     <p className="mt-2 text-xs text-slate-400">{tx('Đã chọn ca', 'Selected')}: {bookingModal.startTime} — {tx('Kết thúc', 'Ends')}: {bookingModal.endTime}</p>
                  )}
                  {bookingFieldErrors.slot && (
                    <p className="mt-2 text-xs font-semibold text-rose-600">{bookingFieldErrors.slot}</p>
                  )}
                </div>

                {/* Triệu chứng */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                    {tx('Mô tả triệu chứng', 'Describe symptoms')} <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    id="booking-symptoms"
                    rows={3}
                    placeholder={tx('Ví dụ: đau đầu, sốt nhẹ, ho khan 3 ngày...', 'Example: headache, mild fever, dry cough for 3 days...')}
                    value={bookingModal.symptoms}
                    required
                    aria-invalid={Boolean(bookingFieldErrors.symptoms)}
                    onChange={(e) => {
                      setBookingModal({ ...bookingModal, symptoms: e.target.value });
                      setBookingFieldErrors((current) => ({ ...current, symptoms: undefined }));
                      setBookingError('');
                    }}
                    className={`w-full resize-none rounded-2xl border bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 ${bookingFieldErrors.symptoms ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-100' : 'border-slate-200 focus:border-sky-400 focus:ring-sky-100'}`}
                  />
                  {bookingFieldErrors.symptoms && (
                    <p className="mt-2 text-xs font-semibold text-rose-600">{bookingFieldErrors.symptoms}</p>
                  )}
                </div>

                {bookingError && (
                  <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">{bookingError}</p>
                )}

                <button
                  id="booking-next-btn"
                  type="button"
                  onClick={continueToPayment}
                  disabled={loadingSlots}
                  className="w-full rounded-full bg-gradient-to-r from-sky-600 to-cyan-500 py-3.5 text-sm font-black text-white shadow-lg shadow-sky-600/30 transition hover:from-sky-700 hover:to-cyan-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {tx('Tiếp tục chọn thanh toán →', 'Continue to payment →')}
                </button>
              </div>
            )}

            {/* ── STEP 2: Thanh toán ── */}
            {bookingStep === 2 && (
              <div className="space-y-5 p-6">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{tx('Tóm tắt lịch hẹn', 'Appointment summary')}</p>
                  <p className="mt-2 font-bold text-slate-900">{formatDoctorName(bookingModal.doctorName)}</p>
                  <p className="text-sm text-slate-600">{new Date(bookingModal.appointmentDate).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })} · {bookingModal.startTime}–{bookingModal.endTime}</p>
                  {bookingModal.symptoms && (
                    <p className="mt-1 text-xs italic text-slate-500">"{bookingModal.symptoms}"</p>
                  )}
                </div>

                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{tx('Phương thức thanh toán', 'Payment method')}</p>
                  <div className="space-y-2">
                    {PAYMENT_METHODS.map((pm) => {
                      const Icon = pm.icon;
                      return (
                        <button
                          key={pm.id}
                          id={`payment-${pm.id.toLowerCase()}`}
                          type="button"
                          onClick={() => setBookingModal({ ...bookingModal, paymentMethod: pm.id })}
                          className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-sm font-semibold transition ${bookingModal.paymentMethod === pm.id ? pm.color + ' ring-2 ring-offset-1 ring-current' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                        >
                          <Icon className="h-5 w-5 shrink-0" />
                          {pm.id === 'WALLET' ? tx('Ví ảo OS Telehealth', 'OS Telehealth Wallet') : pm.label}
                          {bookingModal.paymentMethod === pm.id && (
                            <span className="ml-auto text-xs font-black">✓ {tx('Đã chọn', 'Selected')}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {bookingModal.paymentMethod === 'WALLET' ? (
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    💡 {tx('Phí tư vấn', 'The consultation fee of')} <strong>100.000đ</strong> {tx('sẽ được trừ vào Ví ảo OS Telehealth của bạn.', 'will be deducted from your OS Telehealth Wallet.')}
                    {walletBalance !== null && (
                      <div className="mt-2 text-xs">
                        {tx('Số dư ví hiện tại', 'Current wallet balance')}: <strong>{walletBalance.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')} VNĐ</strong>
                        {walletBalance < 100000 && <span className="text-rose-600 block mt-1">⚠️ {tx('Số dư không đủ để thanh toán. Vui lòng chọn phương thức khác hoặc nạp thêm.', 'Insufficient balance. Please choose another method or add funds.')}</span>}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-700">
                    💡 {tx('Phí tư vấn', 'The consultation fee of')} <strong>100.000đ</strong> {tx('sẽ được thanh toán qua', 'will be paid via')} <strong>{PAYMENT_METHODS.find(p => p.id === bookingModal.paymentMethod)?.label}</strong>.
                  </div>
                )}

                {bookingError && (
                  <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">{bookingError}</p>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setBookingStep(1)}
                    className="flex-1 rounded-full border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    {tx('← Quay lại', '← Back')}
                  </button>
                  <button
                    id="booking-confirm-btn"
                    onClick={submitBooking}
                    disabled={bookingLoading || (bookingModal.paymentMethod === 'WALLET' && walletBalance !== null && walletBalance < 100000)}
                    className="flex-[2] rounded-full bg-gradient-to-r from-sky-600 to-cyan-500 py-3 text-sm font-black text-white shadow-lg shadow-sky-600/30 transition hover:from-sky-700 hover:to-cyan-600 active:scale-95 disabled:opacity-60"
                  >
                    {bookingLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        {tx('Đang đặt lịch...', 'Booking...')}
                      </span>
                    ) : tx('✅ Xác nhận đặt lịch', '✅ Confirm booking')}
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 3: Thành công ── */}
            {bookingStep === 3 && (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <div className="grid h-20 w-20 place-items-center rounded-full bg-emerald-100 text-5xl">
                  🎉
                </div>
                <h3 className="mt-4 text-2xl font-black text-slate-900">{tx('Đặt lịch thành công!', 'Booking successful!')}</h3>
                <p className="mt-2 text-sm text-slate-600">
                  {tx('Lịch hẹn với', 'Your appointment with')} <strong>{formatDoctorName(bookingModal.doctorName)}</strong>{' '}
                  {tx('ngày', 'on')} <strong>{new Date(bookingModal.appointmentDate).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US')}</strong>{' '}
                  {tx('lúc', 'at')} <strong>{bookingModal.startTime}</strong> {tx('đã được ghi nhận.', 'has been recorded.')}
                </p>
                <p className="mt-2 text-sm text-slate-500">{tx('Bác sĩ sẽ xác nhận lịch hẹn trong thời gian sớm nhất.', 'The doctor will confirm your appointment shortly.')}</p>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={closeBookingModal}
                    className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    {tx('Đóng', 'Close')}
                  </button>
                  <button
                    onClick={() => { closeBookingModal(); navigate('/dashboard'); }}
                    className="rounded-full bg-gradient-to-r from-sky-600 to-cyan-500 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-sky-500/30 transition hover:from-sky-700"
                  >
                    {tx('Xem lịch của tôi →', 'View my appointments →')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── HEADER ─── */}
      <header className="sticky top-0 z-50 border-b border-white/60 bg-white/78 backdrop-blur-xl shadow-[0_8px_32px_rgba(15,23,42,0.04)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <button onClick={() => navigate('/')} className="flex items-center gap-3 text-left">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-sky-600 via-cyan-500 to-emerald-500 text-xs font-black tracking-[0.2em] text-white shadow-lg shadow-sky-500/25">
              OS
            </div>
            <div>
              <p className="text-sm font-extrabold tracking-tight text-slate-900">OS Telehealth</p>
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">
                {tx('Khám từ xa uy tín', 'Trusted telehealth care')}
              </p>
            </div>
          </button>

          <nav className="hidden items-center gap-7 lg:flex">
            {[
              { label: tx('Dịch vụ', 'Services'), href: '#services' },
              { label: tx('Quy trình', 'Process'), href: '#process' },
              { label: tx('Bác sĩ', 'Doctors'), href: '#doctors' },
              { label: tx('Tác động xã hội', 'Social impact'), href: '#social' },
              { label: tx('Đối tác', 'Partners'), href: '#partners' },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm font-semibold text-slate-600 transition-colors hover:text-sky-700"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(getAuthToken() ? '/dashboard' : '/login')}
              className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-sky-200 hover:text-sky-700 lg:inline-flex"
            >
              Dashboard
              <BadgeCheck className="h-4 w-4" />
            </button>
            <a
              href="tel:0886805115"
              className="hidden items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:border-sky-200 hover:bg-sky-100 sm:inline-flex"
            >
              <PhoneCall className="h-4 w-4" />
              0886 805 115
            </a>
            <a
              href="#doctors"
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              {tx('Đặt lịch ngay', 'Book now')}
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative mx-auto max-w-7xl px-4 pb-14 pt-10 sm:px-6 lg:px-8 lg:pb-20 lg:pt-16">
          <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-white/80 px-4 py-2 text-xs font-semibold text-sky-700 shadow-sm shadow-sky-100/60 backdrop-blur">
                <Sparkles className="h-4 w-4" />
                {tx('Kênh khám bệnh từ xa uy tín cho gia đình Việt', 'Trusted telehealth care for every family')}
              </div>

              <div className="space-y-5">
                <h1 className="max-w-3xl text-4xl font-black leading-[1.02] tracking-tight text-slate-950 sm:text-5xl lg:text-7xl">
                  {tx('Chăm sóc sức khỏe hiện đại, ', 'Modern healthcare, ')}
                  <span className="bg-gradient-to-r from-sky-700 via-cyan-600 to-emerald-600 bg-clip-text text-transparent">
                    {tx('đẹp và dễ dùng', 'beautiful and easy to use')}
                  </span>
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                  {tx(
                    'OS Telehealth kết nối người bệnh với bác sĩ, xét nghiệm tại nhà, giao thuốc và theo dõi sức khỏe trong một trải nghiệm thống nhất.',
                    'OS Telehealth connects patients with doctors, at-home testing, medicine delivery, and health monitoring in one seamless experience.',
                  )}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <a
                  href="#doctors"
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-slate-700"
                >
                  {tx('Đặt lịch khám ngay', 'Book an appointment')}
                  <ChevronRight className="h-4 w-4" />
                </a>
                <a
                  href="#services"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-sky-200 hover:text-sky-700"
                >
                  {tx('Khám phá dịch vụ', 'Explore services')}
                  <PlayCircle className="h-4 w-4" />
                </a>
                <button
                  onClick={() => navigate(getAuthToken() ? '/dashboard' : '/login')}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-6 py-3.5 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100"
                >
                  {tx('Xem dashboard', 'View dashboard')}
                  <BadgeCheck className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { value: '24/7', label: tx('Hỗ trợ đặt lịch', 'Booking support') },
                  { value: '15+', label: tx('Năm kinh nghiệm', 'Years of experience') },
                  { value: 'VND', label: tx('Thanh toán linh hoạt', 'Flexible payment') },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-3xl border border-white/80 bg-white/75 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)] backdrop-blur"
                  >
                    <p className="text-2xl font-black tracking-tight text-slate-950">{stat.value}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -left-6 top-12 h-32 w-32 rounded-full bg-sky-400/20 blur-3xl" />
              <div className="absolute -right-6 bottom-8 h-32 w-32 rounded-full bg-emerald-400/20 blur-3xl" />

              <div className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/85 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
                      {tx('Trung tâm điều phối', 'Care coordination center')}
                    </p>
                    <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                      {tx('Trải nghiệm y tế đồng bộ', 'A connected care experience')}
                    </h2>
                  </div>
                  <div className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    {tx('Trực tuyến', 'Online')}
                  </div>
                </div>

                <div className="mt-6 grid gap-4">
                  <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-sky-900 p-5 text-white shadow-lg shadow-slate-950/20">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-200/80">
                          {tx('Tư vấn trực tuyến', 'Online consultation')}
                        </p>
                        <p className="mt-2 text-xl font-bold">{tx('Video call, chat, hồ sơ và tái khám', 'Video calls, chat, records, and follow-ups')}</p>
                      </div>
                      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10 text-white">
                        <Video className="h-6 w-6" />
                      </div>
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                      {[
                        [tx('Bảo mật', 'Security'), 'end-to-end'],
                        [tx('Phản hồi', 'Response'), tx('< 15 phút', '< 15 minutes')],
                        [tx('Nhắc hẹn', 'Reminders'), tx('tự động', 'automatic')],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-2xl bg-white/8 px-3 py-4">
                          <p className="text-[11px] uppercase tracking-[0.2em] text-sky-200/70">{label}</p>
                          <p className="mt-1 text-sm font-bold">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    {services.map((service) => {
                      const Icon = service.icon;
                      return (
                        <div
                          key={service.title}
                          className="rounded-3xl border border-slate-100 bg-slate-50/70 p-4 shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-lg"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-sky-700 shadow-sm">
                              <Icon className="h-5 w-5" />
                            </div>
                            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-600">
                              {service.price}
                            </span>
                          </div>
                          <p className="mt-3 text-sm font-bold text-slate-900">{service.title}</p>
                          <p className="mt-2 text-xs leading-6 text-slate-500">{service.description}</p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-sky-50 text-sky-700">
                        <PhoneCall className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {tx('Hỗ trợ tư vấn', 'Consultation support')}
                        </p>
                        <p className="text-base font-bold text-slate-950">Hotline 0886 805 115</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust badges */}
        <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { icon: ShieldCheck, label: tx('An toàn dữ liệu', 'Data safety'), value: tx('Bảo mật nhiều lớp', 'Multi-layer security') },
              { icon: Users, label: tx('Cộng đồng', 'Community'), value: tx('Phục vụ gia đình Việt', 'Care for every family') },
              { icon: Clock3, label: tx('Tốc độ', 'Speed'), value: tx('Quy trình tinh gọn', 'Streamlined process') },
              { icon: Hospital, label: tx('Hệ sinh thái', 'Ecosystem'), value: tx('Khám, xét nghiệm, thuốc', 'Care, testing, medicine') },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="flex items-center gap-4 rounded-3xl border border-white/80 bg-white/80 p-4 shadow-[0_12px_40px_rgba(15,23,42,0.06)] backdrop-blur"
                >
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-50 text-sky-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                    <p className="mt-1 text-sm font-bold text-slate-950">{item.value}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Services */}
        <section id="services" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-2xl space-y-3">
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-sky-700">{tx('Dịch vụ', 'Services')}</p>
            <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              {tx('Hệ dịch vụ y tế toàn diện, hiển thị rõ ràng và dễ thao tác', 'Comprehensive healthcare services, clear and easy to use')}
            </h2>
            <p className="text-slate-600">
              {tx(
                'Ba dịch vụ cốt lõi được trình bày rõ ràng để bạn dễ tìm hiểu và thao tác.',
                'Three core services are presented clearly so you can explore and take action with ease.',
              )}
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {services.map((service) => {
              const Icon = service.icon;
              return (
                <article
                  key={service.title}
                  className="group rounded-[2rem] border border-slate-100 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:shadow-[0_28px_80px_rgba(15,23,42,0.12)]"
                >
                  <div className="flex items-center justify-between">
                    <div className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/15">
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                      {service.price}
                    </span>
                  </div>
                  <h3 className="mt-6 text-xl font-bold text-slate-950">{service.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{service.description}</p>
                  <a
                    href="#doctors"
                    className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-sky-700 transition group-hover:text-sky-800"
                  >
                    {tx('Xem bác sĩ phù hợp', 'Find a suitable doctor')}
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </article>
              );
            })}
          </div>
        </section>

        {/* Process */}
        <section id="process" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[2rem] border border-slate-100 bg-slate-950 p-8 text-white shadow-[0_28px_90px_rgba(15,23,42,0.2)]">
              <p className="text-sm font-bold uppercase tracking-[0.3em] text-sky-300">{tx('Quy trình', 'Process')}</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight">{tx('Ba bước là vào được phòng khám', 'Three steps to enter the clinic')}</h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">
                {tx('Trải nghiệm ngắn gọn, ít rào cản và phù hợp cả với người dùng lần đầu.', 'A simple experience with fewer barriers, even for first-time users.')}
              </p>
              <div className="mt-8 space-y-4">
                {processSteps.map((step, index) => (
                  <div key={step.title} className="flex gap-4 rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-slate-950 font-black">
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="font-bold text-white">{step.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-300">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[2rem] border border-slate-100 bg-white p-7 shadow-[0_20px_60px_rgba(15,23,42,0.06)] md:col-span-2">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.24em] text-sky-700">{tx('Ứng dụng', 'Application')}</p>
                    <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{tx('Một điểm chạm cho mọi nhu cầu', 'One touchpoint for every need')}</h3>
                  </div>
                  <div className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">
                    {tx('Tối ưu cho mobile', 'Mobile optimized')}
                  </div>
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  {[
                    tx('Đặt lịch và nhắc lịch tự động', 'Automatic booking and reminders'),
                    tx('Nhận đơn thuốc và kết quả xét nghiệm', 'Receive prescriptions and test results'),
                    tx('Theo dõi tái khám và lịch sử tư vấn', 'Track follow-ups and consultation history'),
                  ].map((item) => (
                    <div key={item} className="rounded-3xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                      <BadgeCheck className="mb-3 h-5 w-5 text-emerald-600" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                <p className="text-sm font-bold uppercase tracking-[0.24em] text-sky-700">{tx('Liên hệ', 'Contact')}</p>
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  <div className="flex items-center gap-3"><PhoneCall className="h-4 w-4 text-sky-700" />0886 805 115</div>
                  <div className="flex items-center gap-3"><Mail className="h-4 w-4 text-sky-700" />info@ostelehealth.com</div>
                  <div className="flex items-center gap-3"><MapPin className="h-4 w-4 text-sky-700" />TP. Hồ Chí Minh</div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-slate-100 bg-gradient-to-br from-sky-500 to-emerald-500 p-6 text-white shadow-[0_20px_60px_rgba(14,165,233,0.2)]">
                <p className="text-sm font-bold uppercase tracking-[0.24em] text-white/80">{tx('Thanh toán', 'Payment')}</p>
                <p className="mt-4 text-2xl font-black">MoMo · VNPay · ZaloPay</p>
                <p className="mt-3 text-sm leading-6 text-white/85">
                  {tx('Chọn phương thức thanh toán phù hợp ngay trong bước đặt lịch.', 'Choose your preferred payment method during booking.')}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── DOCTORS SECTION ─── */}
        <section id="doctors" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <p className="text-sm font-bold uppercase tracking-[0.3em] text-sky-700">{tx('Bác sĩ nổi bật', 'Featured doctors')}</p>
              <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                {tx('Đội ngũ chuyên gia — tìm kiếm & đặt lịch ngay', 'Our specialists — search and book now')}
              </h2>
              <p className="text-slate-600">
                {tx('Tìm bác sĩ theo tên hoặc chuyên khoa, bấm "Đặt lịch" để chọn ngày giờ và thanh toán.', 'Find a doctor by name or specialty, then select a time and payment method.')}
              </p>
            </div>
          </div>

          {/* Search + Filter */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="doctor-search"
                type="text"
                placeholder={tx('Tìm theo tên bác sĩ...', 'Search by doctor name...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-full border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm font-medium text-slate-900 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedSpecialty('')}
                className={`rounded-full border px-4 py-2 text-xs font-bold transition ${selectedSpecialty === '' ? 'border-sky-500 bg-sky-500 text-white shadow-md shadow-sky-500/30' : 'border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-700'}`}
              >
                {tx('Tất cả', 'All')}
              </button>
              {specialties.map((spec) => (
                <button
                  key={spec}
                  onClick={() => setSelectedSpecialty(spec === selectedSpecialty ? '' : spec)}
                  className={`rounded-full border px-4 py-2 text-xs font-bold transition ${selectedSpecialty === spec ? 'border-sky-500 bg-sky-500 text-white shadow-md shadow-sky-500/30' : 'border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-700'}`}
                >
                  {localizeDbText(spec, specialtyEn, language)}
                </button>
              ))}
            </div>
          </div>

          {/* Doctor count result */}
          {!loading && (
            <p className="mt-3 text-sm text-slate-500">
              {filteredDoctors.length === 0
                ? tx('Không tìm thấy bác sĩ phù hợp.', 'No matching doctors found.')
                : `${tx('Tìm thấy', 'Found')} ${filteredDoctors.length} ${tx('bác sĩ', 'doctor(s)')}${selectedSpecialty ? ` · ${localizeDbText(selectedSpecialty, specialtyEn, language)}` : ''}${searchQuery ? ` · "${searchQuery}"` : ''}`}
            </p>
          )}

          <div className="mt-6">
            {loading ? (
              <div className="flex items-center justify-center gap-3 rounded-[2rem] border border-slate-100 bg-white py-16 text-sm font-semibold text-sky-700 shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600" />
                {tx('Đang tải danh sách bác sĩ...', 'Loading doctors...')}
              </div>
            ) : filteredDoctors.length === 0 ? (
              <div className="rounded-[2rem] border border-slate-100 bg-white py-16 text-center text-sm text-slate-500 shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
                {doctors.length === 0 ? tx('Chưa có dữ liệu bác sĩ. Kiểm tra lại backend.', 'No doctor data yet. Please check the backend.') : tx('Không tìm thấy bác sĩ phù hợp với tìm kiếm.', 'No doctors match your search.')}
              </div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                {filteredDoctors.map((doctor) => (
                  <article
                    key={doctor.id}
                    className="group rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:shadow-[0_28px_80px_rgba(15,23,42,0.12)]"
                  >
                    <div className="flex flex-col gap-6 sm:flex-row">
                      <div className="flex shrink-0 flex-col items-center gap-3 sm:w-48 sm:items-start">
                        <div className="relative">
                          <div className="grid h-24 w-24 place-items-center rounded-[1.75rem] bg-gradient-to-br from-sky-50 via-white to-emerald-50 text-4xl shadow-inner">
                            {doctor.isOnline ? '👨‍⚕️' : '👩‍⚕️'}
                          </div>
                          <span className={`absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full border-2 border-white ${doctor.isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        </div>

                        <div className="text-center sm:text-left">
                          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-sky-700">{tx('Chuyên gia', 'Specialist')}</p>
                          <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">{doctor.name}</h3>
                          <p className="mt-1 text-sm font-medium text-slate-500">{localizeDbText(doctor.specialty, specialtyEn, language)}</p>
                        </div>

                        {/* Action button */}
                        <div className="w-full">
                          <button
                            id={`book-doctor-${doctor.id}`}
                            onClick={() => openBookingModal(doctor)}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-sky-600 to-cyan-500 px-4 py-2.5 text-sm font-black text-white shadow-md shadow-sky-500/30 transition hover:from-sky-700 hover:to-cyan-600 active:scale-95"
                          >
                            <CalendarDays className="h-4 w-4" />
                            {tx('Đặt lịch', 'Book')}
                          </button>
                        </div>
                      </div>

                      <div className="flex-1 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">
                            {localizeDbText(doctor.specialty, specialtyEn, language)}
                          </div>
                          <div className="flex items-center gap-1 rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                            <Star className="h-3.5 w-3.5 fill-current" />
                            {doctor.rating?.toFixed(1) ?? '5.0'}
                          </div>
                        </div>

                        <p className="text-sm leading-7 text-slate-600">
                          {doctor.bio
                            ? localizeDbText(doctor.bio, doctorBioEn, language)
                            : tx('Ứng dụng y khoa từ xa để tối ưu tầm soát, tư vấn và điều trị kịp thời.', 'Using telemedicine to improve screening, consultation, and timely treatment.')}
                        </p>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-3xl bg-slate-50 p-4">
                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                              {tx('Kinh nghiệm', 'Experience')}
                            </p>
                            <p className="mt-2 text-lg font-black text-slate-950">{doctor.yearsExp || 8}+ {tx('năm', 'years')}</p>
                          </div>
                          <div className="rounded-3xl bg-slate-50 p-4">
                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                              {tx('Số bệnh nhân', 'Patients')}
                            </p>
                            <p className="mt-2 text-lg font-black text-slate-950">
                              {doctor.patientCount || 0}+
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                          <Clock3 className="h-4 w-4 text-slate-400" />
                          {doctor.isOnline ? tx('Đang online và sẵn sàng tư vấn', 'Online and ready to consult') : tx('Đang ngoại tuyến, có thể đặt lịch trước', 'Offline — advance booking is available')}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Social */}
        <section id="social" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[2rem] border border-slate-100 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
              <p className="text-sm font-bold uppercase tracking-[0.3em] text-sky-700">{tx('Tác động xã hội', 'Social impact')}</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950">{tx('Dự án cộng đồng và y tế học đường', 'Community and school health projects')}</h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                {tx('Các sáng kiến giúp y tế từ xa tạo ra tác động thiết thực cho cộng đồng.', 'Initiatives that help telehealth create meaningful impact for the community.')}
              </p>

              <div className="mt-6 space-y-4">
                {socialStories.map((story) => (
                  <div key={story.title} className="rounded-3xl bg-slate-50 p-4">
                    <h3 className="text-sm font-bold text-slate-950">{story.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{story.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {[
                { title: tx('Giám sát an toàn', 'Safety monitoring'), description: tx('Tối ưu cho trường học, doanh nghiệp và các chương trình sàng lọc quy mô lớn.', 'Designed for schools, businesses, and large-scale screening programs.'), accent: 'from-sky-500 to-cyan-500' },
                { title: tx('Hội thảo chuyên môn', 'Professional workshops'), description: tx('Thư viện hoạt động với hình ảnh, nhãn và điểm nhấn rõ ràng.', 'A clear activity library with images, labels, and highlights.'), accent: 'from-emerald-500 to-teal-500' },
                { title: tx('Tư vấn ca phức tạp', 'Complex case consultation'), description: tx('Hỗ trợ phân luồng sớm, giảm thời gian chờ và tăng khả năng tiếp cận chuyên gia.', 'Enable early triage, reduce waiting time, and improve specialist access.'), accent: 'from-indigo-500 to-sky-500' },
                { title: tx('Đào tạo và chuyển giao', 'Training and knowledge transfer'), description: tx('Mô hình dễ hiểu và dễ triển khai cho đội ngũ y tế cơ sở.', 'An easy-to-understand model for local healthcare teams.'), accent: 'from-amber-500 to-orange-500' },
              ].map((item) => (
                <div key={item.title} className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                  <div className={`h-2 w-20 rounded-full bg-gradient-to-r ${item.accent}`} />
                  <h3 className="mt-4 text-lg font-bold text-slate-950">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Partners */}
        <section id="partners" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="rounded-[2.25rem] border border-slate-100 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl space-y-3">
                <p className="text-sm font-bold uppercase tracking-[0.3em] text-sky-700">{tx('Khách hàng và đối tác', 'Customers and partners')}</p>
                <h2 className="text-3xl font-black tracking-tight text-slate-950">{tx('Mạng lưới hợp tác rộng và đáng tin cậy', 'A broad and trusted partner network')}</h2>
                <p className="text-slate-600">
                  {tx('Kết nối cùng các đơn vị y tế, giáo dục và doanh nghiệp đáng tin cậy.', 'Connecting trusted healthcare, education, and business organizations.')}
                </p>
              </div>
              <a
                href="https://ostelehealth.vn/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-sky-200 hover:text-sky-700"
              >
                {tx('Xem website tham chiếu', 'View reference website')}
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              {partnerLogos.map((partner) => (
                <div
                  key={partner}
                  className="flex h-24 items-center justify-center rounded-3xl border border-slate-100 bg-slate-50 px-4 text-center text-xs font-bold uppercase tracking-[0.2em] text-slate-400"
                >
                  {partner}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="rounded-[2.25rem] bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950 px-8 py-10 text-white shadow-[0_30px_90px_rgba(15,23,42,0.25)] lg:px-12">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.3em] text-sky-300">{tx('Bắt đầu ngay', 'Get started')}</p>
                <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
                  {tx('Sẵn sàng cho trải nghiệm khám chữa bệnh tốt hơn', 'Ready for a better healthcare experience')}
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
                  {tx('Đặt lịch với bác sĩ chuyên khoa, chọn giờ khám và thanh toán online ngay hôm nay.', 'Book a specialist, choose a time, and pay online today.')}
                </p>
              </div>

              <div className="flex flex-wrap gap-3 lg:justify-end">
                <a
                  href="#doctors"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-50"
                >
                  {tx('Tìm bác sĩ & đặt lịch', 'Find a doctor & book')}
                  <ChevronRight className="h-4 w-4" />
                </a>
                <a
                  href="mailto:Info@ostelehealth.com"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  {tx('Gửi email', 'Send email')}
                  <Mail className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Floating SOS Button (Chỉ hiện cho PATIENT) */}
      {authUser?.role === 'PATIENT' && (
        <button
          onClick={() => setShowEmergencyModal(true)}
          className="fixed bottom-8 right-8 z-50 flex h-16 items-center gap-3 rounded-full bg-gradient-to-r from-red-600 to-rose-600 px-6 font-bold text-white shadow-2xl shadow-red-600/30 ring-4 ring-red-500/20 transition hover:scale-105 hover:from-red-500 hover:to-rose-500 hover:shadow-red-500/40 active:scale-95"
        >
          <span className="relative flex h-8 w-8">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-40"></span>
            <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-lg backdrop-blur">
              🚨
            </span>
          </span>
          {tx('CẤP CỨU SOS', 'EMERGENCY SOS')}
        </button>
      )}

      {/* SOS Emergency Modal */}
      {showEmergencyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border-4 border-rose-500 bg-white shadow-[0_0_50px_rgba(244,63,94,0.5)]">
            <div className="bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 px-6 py-6 text-center text-white">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-4xl shadow-inner backdrop-blur-md">
                🚨
              </span>
              <h2 className="mt-4 text-2xl font-black uppercase tracking-widest">{tx('Báo động đỏ', 'Emergency alert')}</h2>
              <p className="mt-1 text-sm font-medium text-rose-100">{tx('Kích hoạt hệ thống y tế khẩn cấp', 'Activate emergency medical support')}</p>
            </div>
            <div className="p-6">
              <p className="mb-4 text-center text-sm font-semibold text-slate-600">
                {tx('Lựa chọn tình trạng khẩn cấp:', 'Select the emergency condition:')}
              </p>
              <div className="flex flex-col gap-3">
                {(language === 'vi' ? [
                  'Đau thắt ngực / Khó thở',
                  'Tai biến / Đột quỵ',
                  'Chấn thương nghiêm trọng',
                  'Ngộ độc',
                  'Khác (Cần hỗ trợ y tế gấp)',
                ] : [
                  'Chest pain / Shortness of breath',
                  'Stroke symptoms',
                  'Serious injury',
                  'Poisoning',
                  'Other urgent medical emergency',
                ]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedEmergencyType(type)}
                    className={`rounded-2xl border-2 px-4 py-3 text-left font-bold transition ${
                      selectedEmergencyType === type
                        ? 'border-rose-500 bg-rose-50 text-rose-700'
                        : 'border-slate-100 bg-white text-slate-700 hover:border-rose-200 hover:bg-rose-50/50'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3 bg-slate-50 p-6">
              <button
                onClick={() => setShowEmergencyModal(false)}
                className="flex-1 rounded-full border border-slate-200 bg-white py-3 font-bold text-slate-600 transition hover:bg-slate-100"
              >
                {tx('Hủy bỏ', 'Cancel')}
              </button>
              <button
                onClick={handleEmergencySubmit}
                className="flex-1 rounded-full bg-rose-600 py-3 font-black text-white shadow-lg shadow-rose-500/30 transition hover:bg-rose-700"
              >
                {tx('GỌI CẤP CỨU NGAY', 'CALL FOR HELP NOW')}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-slate-200/70 bg-white/80">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_0.8fr_0.8fr] lg:px-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-sky-600 via-cyan-500 to-emerald-500 text-xs font-black tracking-[0.2em] text-white">
                OS
              </div>
              <div>
                <p className="text-sm font-extrabold text-slate-950">OS Telehealth</p>
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
                  {tx('Nền tảng y tế số', 'Digital healthcare platform')}
                </p>
              </div>
            </div>
            <p className="max-w-md text-sm leading-7 text-slate-600">
              {tx('Kết nối người bệnh với bác sĩ chuyên khoa, hỗ trợ tư vấn trực tuyến và theo dõi sức khỏe toàn diện.', 'Connecting patients with specialists for online consultations and comprehensive health monitoring.')}
            </p>
          </div>

          <div className="space-y-3 text-sm text-slate-600">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">{tx('Liên hệ', 'Contact')}</p>
            <div className="flex items-center gap-3"><PhoneCall className="h-4 w-4 text-sky-700" /> 0886 805 115</div>
            <div className="flex items-center gap-3"><Mail className="h-4 w-4 text-sky-700" /> Info@ostelehealth.com</div>
            <div className="flex items-center gap-3"><MapPin className="h-4 w-4 text-sky-700" /> TP. Hồ Chí Minh</div>
          </div>

          <div className="space-y-3 text-sm text-slate-600">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">{tx('Dịch vụ', 'Services')}</p>
            <p>{tx('Tư vấn sức khỏe từ xa', 'Online health consultations')}</p>
            <p>{tx('Xét nghiệm tại nhà', 'At-home testing')}</p>
            <p>{tx('Giao thuốc tận nơi', 'Medicine delivery')}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Home;
