import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Banknote,
  Bell,
  CalendarDays,
  ChartColumn,
  CheckCircle2,
  FileText,
  HeartPulse,
  LogOut,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import { clearAuthSession, getAuthToken, type AuthUser } from './auth';
import { socket } from './socket';

interface ApiWrapper<T> {
  message?: string;
  data: T;
}

interface AppointmentItem {
  id: number;
  patientId?: number;
  doctorId?: number;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  status: string;
  patient?: { id?: number; fullName: string; email?: string };
  doctor?: { id?: number; fullName: string; email?: string };
  prescriptions?: PrescriptionItem[];
  review?: { rating: number; comment?: string } | null;
  aiSummaries?: { aiSummary?: string; suggestedMedicines?: string }[];
}

interface PrescriptionItem {
  id: number;
  diagnosis: string;
  medicines: string;
  createdAt: string;
  appointment?: { patient?: { fullName: string }; doctor?: { fullName: string } };
}

interface VitalItem {
  id: number;
  heartRate?: number | null;
  respiratoryRate?: number | null;
  oxygenSaturation?: number | null;
  measuredAt: string;
  appointment?: { patient?: { fullName: string }; doctor?: { fullName: string } };
}

interface MessageItem {
  id: number;
  content: string;
  messageType: string;
  createdAt: string;
  sender?: { fullName: string; role: string };
  appointment?: { id: number; status: string };
}

interface NewAppointmentNotif {
  appointmentId: number;
  patientName: string;
  date: string;
  startTime: string;
}

interface AdminPayload {
  stats: {
    userCount: number;
    doctorCount: number;
    patientCount: number;
    appointmentCount: number;
    prescriptionCount: number;
    messageCount: number;
    vitalCount: number;
  };
  statusStats: Array<{ status: string; _count: { status: number } }>;
  recentAppointments: AppointmentItem[];
  recentMessages: MessageItem[];
  recentPrescriptions: PrescriptionItem[];
  recentVitals: VitalItem[];
  topDoctors: Array<{ id: number; name: string; specialty: string; rating: number; patientCount: number; yearsExp: number; isOnline: boolean }>;
  allUsers: Array<{ id: number; email: string; fullName: string; role: string; isActive: boolean; createdAt: string }>;
}

interface PatientPayload {
  patient: { id: number; fullName: string; email: string; role: string };
  stats: {
    totalAppointments: number;
    upcomingAppointments: number;
    completedAppointments: number;
    prescriptionCount: number;
    vitalCount: number;
    messageCount: number;
  };
  upcomingAppointments: AppointmentItem[];
  completedAppointments: AppointmentItem[];
  prescriptions: PrescriptionItem[];
  vitals: VitalItem[];
  messages: MessageItem[];
}

interface DoctorPayload {
  doctor: { id: number; fullName: string; email: string; role: string };
  profile?: { specialty?: string; experienceYears?: number; bio?: string | null } | null;
  stats: {
    totalAppointments: number;
    upcomingAppointments?: number;
    todayAppointments: number;
    completedAppointments: number;
    prescriptionCount: number;
    vitalCount: number;
    messageCount: number;
  };
  upcomingAppointments?: AppointmentItem[];
  todaysAppointments: AppointmentItem[];
  completedAppointments: AppointmentItem[];
  prescriptions: PrescriptionItem[];
  vitals: VitalItem[];
  messages: MessageItem[];
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const TIME_SLOTS = [
  '08:00 - 08:30', '08:30 - 09:00', '09:00 - 09:30', '09:30 - 10:00',
  '10:00 - 10:30', '10:30 - 11:00', '11:00 - 11:30', '11:30 - 12:00',
  '13:30 - 14:00', '14:00 - 14:30', '14:30 - 15:00', '15:00 - 15:30',
  '15:30 - 16:00', '16:00 - 16:30', '16:30 - 17:00'
];

function formatDate(value?: string | Date) {
  if (!value) return '---';
  return new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(value?: string | Date) {
  if (!value) return '---';
  return new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function formatDoctorName(name?: string) {
  if (!name) return '---';
  const trimmed = name.trim();
  if (/^(BS|ThS|TS|PGS|GS)\b/i.test(trimmed)) {
    return trimmed;
  }
  return `BS. ${trimmed}`;
}

function Dashboard() {
  const navigate = useNavigate();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [payload, setPayload] = useState<AdminPayload | PatientPayload | DoctorPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [newApptNotif, setNewApptNotif] = useState<NewAppointmentNotif | null>(null);
  const [selectedPrescription, setSelectedPrescription] = useState<{
    appointmentId: number;
    date: string;
    doctorName: string;
    diagnosis: string;
    medicines: string;
    aiSummary?: string;
    suggestedMedicines?: string;
  } | null>(null);

  const [ratingModal, setRatingModal] = useState<{ appointmentId: number, doctorName: string } | null>(null);
  const [ratingVal, setRatingVal] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingLoading, setRatingLoading] = useState(false);

  // States cho Quản lý Lịch làm việc Bác sĩ
  const [selectedScheduleDate, setSelectedScheduleDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [doctorSchedules, setDoctorSchedules] = useState<{startTime: string, endTime: string, isBooked: boolean}[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  // States cho Ví & Hoá đơn
  const [wallet, setWallet] = useState<{ balance: number } | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    const token = getAuthToken();

    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    fetch(`${API_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (response) => {
        const data = (await response.json()) as ApiWrapper<AuthUser>;

        if (!response.ok) {
          throw new Error(data.message ?? 'Phiên đăng nhập không còn hợp lệ');
        }

        setAuthUser(data.data);
      })
      .catch(() => {
        clearAuthSession();
        navigate('/login', { replace: true });
      });
  }, [navigate]);

  const loadDashboard = useCallback(() => {
    const token = getAuthToken();
    if (!token) { navigate('/login', { replace: true }); return; }

    setLoading(true);
    setError('');

    fetch(`${API_URL}/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const data = (await response.json()) as ApiWrapper<AdminPayload | PatientPayload | DoctorPayload>;
        if (!response.ok) throw new Error(data.message ?? 'Không thể tải dashboard');
        setPayload(data.data);
      })
      .catch((loadError) => {
        setPayload(null);
        setError(loadError instanceof Error ? loadError.message : 'Không thể tải dashboard');
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  const loadWalletAndInvoices = useCallback(() => {
    const token = getAuthToken();
    if (!token || !authUser) return;

    if (authUser.role === 'PATIENT' || authUser.role === 'ADMIN' || authUser.role === 'DOCTOR') {
      fetch(`${API_URL}/wallet/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => { if (data.data) setWallet(data.data); })
        .catch(console.error);
    }
    
    if (authUser.role === 'PATIENT') {
      fetch(`${API_URL}/wallet/invoices/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => { if (data.data) setInvoices(data.data); })
        .catch(console.error);
    } else if (authUser.role === 'ADMIN') {
      fetch(`${API_URL}/wallet/invoices`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => { if (data.data) setInvoices(data.data); })
        .catch(console.error);
    }
  }, [authUser]);

  useEffect(() => {
    if (!authUser) return;
    loadDashboard();
    loadWalletAndInvoices();
  }, [authUser, loadDashboard, loadWalletAndInvoices]);

  // Tải danh sách lịch rảnh khi đổi ngày (Chỉ cho bác sĩ)
  const loadDoctorSchedules = useCallback(() => {
    if (!authUser || authUser.role !== 'DOCTOR' || !selectedScheduleDate) return;
    const token = getAuthToken();
    setLoadingSchedule(true);
    fetch(`${API_URL}/doctors/${authUser.id}/schedules?date=${selectedScheduleDate}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.data) {
          setDoctorSchedules(data.data);
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoadingSchedule(false));
  }, [authUser, selectedScheduleDate]);

  useEffect(() => {
    loadDoctorSchedules();
  }, [loadDoctorSchedules]);

  const toggleScheduleSlot = async (timeStr: string) => {
    if (!authUser || authUser.role !== 'DOCTOR') return;
    const [start, end] = timeStr.split(' - ');
    const token = getAuthToken();
    
    // Optimistic UI update (optional, nhưng tạm thời gọi API rồi reload cho chắc)
    try {
      const res = await fetch(`${API_URL}/doctors/${authUser.id}/schedules/toggle`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          date: selectedScheduleDate,
          startTime: start,
          endTime: end
        })
      });
      if (res.ok) {
        loadDoctorSchedules(); // Reload data
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Real-time: bác sĩ nhận thông báo khi có lịch hẹn mới
  useEffect(() => {
    if (!authUser || authUser.role !== 'DOCTOR') return;

    const handler = (notif: NewAppointmentNotif) => {
      setNewApptNotif(notif);
    };
    socket.on('appointment:new', handler);
    return () => { socket.off('appointment:new', handler); };
  }, [authUser?.id, authUser?.role]);

  const roleLabel = useMemo(() => {
    if (authUser?.role === 'ADMIN') return 'Admin Overview';
    if (authUser?.role === 'PATIENT') return 'Patient Care Center';
    if (authUser?.role === 'DOCTOR') return 'Doctor Command Room';
    return 'Telehealth Dashboard';
  }, [authUser?.role]);

  const statCards = useMemo(() => {
    if (!payload || !authUser) return [];

    if (authUser.role === 'ADMIN') {
      const admin = payload as AdminPayload;
      return [
        ['Users', admin.stats.userCount],
        ['Doctors', admin.stats.doctorCount],
        ['Patients', admin.stats.patientCount],
        ['Appointments', admin.stats.appointmentCount],
        ['Prescriptions', admin.stats.prescriptionCount],
        ['Vitals', admin.stats.vitalCount],
      ];
    }

    if (authUser.role === 'PATIENT') {
      const patient = payload as PatientPayload;
      return [
        ['Appointments', patient.stats.totalAppointments],
        ['Upcoming', patient.stats.upcomingAppointments],
        ['Completed', patient.stats.completedAppointments],
        ['Prescriptions', patient.stats.prescriptionCount],
        ['Vitals', patient.stats.vitalCount],
        ['Messages', patient.stats.messageCount],
      ];
    }

    const doctor = payload as DoctorPayload;
    return [
      ['Appointments', doctor.stats.totalAppointments],
      ['Upcoming', doctor.stats.upcomingAppointments ?? doctor.stats.todayAppointments],
      ['Completed', doctor.stats.completedAppointments],
      ['Prescriptions', doctor.stats.prescriptionCount],
      ['Vitals', doctor.stats.vitalCount],
      ['Messages', doctor.stats.messageCount],
    ];
  }, [payload, authUser]);

  const handleLogout = () => {
    clearAuthSession();
    navigate('/login', { replace: true });
  };

  // Cập nhật trạng thái lịch hẹn (Hủy/Duyệt)
  async function updateAppointmentStatus(appointmentId: number, status: string) {
    const token = getAuthToken();
    if (!token) return;
    setCancellingId(appointmentId);
    try {
      const res = await fetch(`${API_URL}/appointments/${appointmentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        loadDashboard();
      }
    } catch { /* ignore */ }
    finally { setCancellingId(null); }
  }

  const handleRefund = async (invoiceId: number) => {
    if (!window.confirm('Bạn có chắc chắn muốn hoàn tiền cho giao dịch này?')) return;
    const token = getAuthToken();
    try {
      const res = await fetch(`${API_URL}/wallet/invoices/${invoiceId}/refund`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Lỗi hoàn tiền');
      alert('Hoàn tiền thành công!');
      loadWalletAndInvoices();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Quản lý trạng thái User (Khóa / Mở khóa)
  async function toggleUserStatus(userId: number, currentStatus: boolean) {
    if (!window.confirm(`Bạn có chắc muốn ${currentStatus ? 'KHOÁ' : 'MỞ KHOÁ'} tài khoản này?`)) return;
    const token = getAuthToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      if (res.ok) {
        alert(`Đã ${currentStatus ? 'khoá' : 'mở khoá'} thành công!`);
        loadDashboard();
      } else {
        const data = await res.json();
        alert(data.message || 'Có lỗi xảy ra');
      }
    } catch (e) {
      alert('Không thể kết nối đến máy chủ!');
    }
  }

  async function submitRating(e: React.FormEvent) {
    e.preventDefault();
    if (!ratingModal) return;
    
    setRatingLoading(true);
    try {
      const res = await fetch(`${API_URL}/appointments/${ratingModal.appointmentId}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          rating: ratingVal,
          comment: ratingComment
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Lỗi khi gửi đánh giá');
      
      alert('Cảm ơn bạn đã gửi đánh giá!');
      setRatingModal(null);
      setRatingVal(5);
      setRatingComment('');
      loadDashboard();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    } finally {
      setRatingLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.12),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.12),_transparent_26%),linear-gradient(180deg,_#f8fafc_0%,_#eef6ff_52%,_#f8fafc_100%)] text-slate-900">

      {/* 🔔 Thông báo lịch hẹn mới cho bác sĩ */}
      {newApptNotif && (
        <div className="fixed bottom-6 right-6 z-50 w-80 overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-2xl shadow-emerald-500/20 animate-in slide-in-from-right">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-3 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              <span className="text-xs font-black uppercase tracking-[0.2em]">Lịch hẹn mới!</span>
            </div>
            <button onClick={() => setNewApptNotif(null)} className="grid h-6 w-6 place-items-center rounded-full bg-white/20 hover:bg-white/30">
              <X className="h-3 w-3" />
            </button>
          </div>
          <div className="p-4">
            <p className="font-bold text-slate-900">Bệnh nhân {newApptNotif.patientName}</p>
            <p className="mt-1 text-sm text-slate-600">
              Đặt lịch ngày <strong>{new Date(newApptNotif.date).toLocaleDateString('vi-VN')}</strong> lúc <strong>{newApptNotif.startTime}</strong>
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => { setNewApptNotif(null); loadDashboard(); }}
                className="flex-1 rounded-full bg-emerald-600 py-2 text-xs font-black text-white hover:bg-emerald-700"
              >
                Xem lịch
              </button>
              <button onClick={() => setNewApptNotif(null)} className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                Bỏ qua
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-40 border-b border-white/70 bg-white/80 backdrop-blur-xl shadow-[0_8px_32px_rgba(15,23,42,0.04)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <button onClick={() => navigate('/')} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 transition hover:text-sky-700">
            <ArrowLeft className="h-4 w-4" />
            Về trang chủ
          </button>
          <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">
            <Sparkles className="h-4 w-4 text-sky-600" />
            <span className="text-sm font-semibold text-slate-700">{roleLabel}</span>
          </div>
          <button onClick={handleLogout} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-rose-200 hover:text-rose-700">
            <LogOut className="h-4 w-4" />
            Đăng xuất
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-sky-700">Dashboard</p>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Bảng điều khiển telehealth theo vai trò</h1>
              <p className="text-slate-600">
                Xin chào {authUser?.fullName ?? 'bạn'} - dữ liệu đang được khóa theo tài khoản đăng nhập hiện tại.
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3">
              <ShieldCheck className="h-5 w-5 text-sky-600" />
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Current role</p>
                <p className="text-sm font-semibold text-slate-800">{authUser?.role ?? '---'}</p>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            {statCards.map(([label, value]) => (
              <div key={label as string} className="rounded-3xl border border-slate-100 bg-slate-50 p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">{label as string}</p>
                <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">{value as number}</p>
              </div>
            ))}
          </div>
        </section>

        {loading ? (
          <div className="mt-6 rounded-[2rem] border border-slate-100 bg-white px-6 py-16 text-center text-sm font-semibold text-sky-700 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
            Đang tải dữ liệu dashboard...
          </div>
        ) : error ? (
          <div className="mt-6 rounded-[2rem] border border-rose-100 bg-rose-50 px-6 py-10 text-center text-sm font-semibold text-rose-700 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
            {error}
          </div>
        ) : payload && authUser ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {authUser.role === 'ADMIN' ? renderAdminSections(payload as AdminPayload) : null}
            {authUser.role === 'PATIENT' ? renderPatientSections(payload as PatientPayload) : null}
            {authUser.role === 'DOCTOR' ? renderDoctorSections(payload as DoctorPayload) : null}
          </div>
        ) : null}
      </main>

      {/* Modal View Prescription */}
      {selectedPrescription && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg animate-[slideUp_0.3s_cubic-bezier(0.16,1,0.3,1)] rounded-[2rem] bg-white p-8 shadow-2xl">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h3 className="text-2xl font-black tracking-tight text-slate-900">Hồ sơ & Đơn thuốc</h3>
                <p className="text-sm font-medium text-slate-500">Khám ngày {selectedPrescription.date} với {selectedPrescription.doctorName}</p>
              </div>
              <button onClick={() => setSelectedPrescription(null)} className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                  Chẩn đoán bệnh
                </label>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-800">
                  {selectedPrescription.diagnosis}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                  Đơn thuốc & Liều dùng
                </label>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-800 whitespace-pre-wrap">
                  {selectedPrescription.medicines}
                </div>
              </div>

              {selectedPrescription.aiSummary && (
                <div className="mt-4">
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-sky-600">
                    <Sparkles className="mr-1.5 inline h-3.5 w-3.5" /> Tóm tắt Bệnh án (Bởi AI)
                  </label>
                  <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm font-medium text-sky-900 whitespace-pre-wrap">
                    {selectedPrescription.aiSummary}
                  </div>
                </div>
              )}

              <div className="pt-4">
                <button
                  onClick={() => setSelectedPrescription(null)}
                  className="w-full rounded-full bg-slate-900 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-slate-800"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Rating */}
      {ratingModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm animate-[slideUp_0.3s_cubic-bezier(0.16,1,0.3,1)] rounded-[2rem] bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-black tracking-tight text-slate-900">Đánh giá Bác sĩ</h3>
                <p className="text-xs font-medium text-slate-500">Bác sĩ {ratingModal.doctorName}</p>
              </div>
              <button onClick={() => setRatingModal(null)} className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={submitRating} className="space-y-4">
              <div className="flex justify-center gap-2 py-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRatingVal(star)}
                    className={`text-3xl transition ${star <= ratingVal ? 'text-amber-400' : 'text-slate-200 hover:text-slate-300'}`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Lời nhận xét</label>
                <textarea
                  required
                  rows={3}
                  value={ratingComment}
                  onChange={e => setRatingComment(e.target.value)}
                  placeholder="Bác sĩ tư vấn nhiệt tình..."
                  className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm focus:border-sky-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={ratingLoading}
                className="w-full rounded-full bg-slate-900 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {ratingLoading ? 'Đang gửi...' : 'Gửi Đánh Giá'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  function renderAdminSections(data: AdminPayload) {
    return (
      <>
        <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)] lg:col-span-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-700">Appointment flow</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight">Phân bố trạng thái lịch hẹn</h2>
            </div>
            <ChartColumn className="h-6 w-6 text-sky-600" />
          </div>
          <div className="mt-5 space-y-3">
            {data.statusStats.map((item) => {
              const percent = data.stats.appointmentCount === 0 ? 0 : Math.round((item._count.status / data.stats.appointmentCount) * 100);
              return (
                <div key={item.status}>
                  <div className="mb-1 flex items-center justify-between text-sm font-medium text-slate-600">
                    <span>{item.status}</span>
                    <span>{item._count.status}</span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-100">
                    <div className="h-3 rounded-full bg-gradient-to-r from-sky-500 to-emerald-500" style={{ width: `${Math.max(percent, 4)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)] lg:col-span-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-sky-700">
            <Stethoscope className="h-4 w-4" />
            Top doctors
          </div>
          <div className="mt-4 space-y-3">
            {data.topDoctors.map((doctor) => (
              <div key={doctor.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">{formatDoctorName(doctor.name)}</p>
                    <p className="text-sm text-slate-600">{doctor.specialty}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${doctor.isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                    {doctor.isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-600">
                  <span>{doctor.rating.toFixed(1)} ★</span>
                  <span>{doctor.patientCount.toLocaleString('vi-VN')} bệnh nhân</span>
                  <span>{doctor.yearsExp} năm kinh nghiệm</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)] lg:col-span-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-sky-700">
            <Users className="h-4 w-4" />
            Quản lý Tài khoản (Users)
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Họ tên</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Vai trò</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.allUsers?.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">{user.fullName}</td>
                    <td className="px-4 py-3">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-black tracking-wide ${user.role === 'DOCTOR' ? 'bg-sky-100 text-sky-700' : user.role === 'ADMIN' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {user.isActive ? (
                        <span className="text-emerald-600 font-bold">Hoạt động</span>
                      ) : (
                        <span className="text-rose-600 font-bold">Bị khoá</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {user.role !== 'ADMIN' && (
                        <button
                          onClick={() => toggleUserStatus(user.id, user.isActive)}
                          className={`rounded border px-3 py-1 text-xs font-semibold ${user.isActive ? 'border-rose-200 text-rose-600 hover:bg-rose-50' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}
                        >
                          {user.isActive ? 'Khoá' : 'Mở khoá'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)] lg:col-span-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-sky-700">
            <Wallet className="h-4 w-4" />
            Quản lý Hoá Đơn / Hoàn Tiền
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Mã hoá đơn</th>
                  <th className="px-4 py-3">Bệnh nhân</th>
                  <th className="px-4 py-3">Số tiền</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.length === 0 ? (
                  <tr><td colSpan={5} className="py-4 text-center text-slate-400">Không có hoá đơn nào</td></tr>
                ) : invoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">#{inv.id}</td>
                    <td className="px-4 py-3">{inv.patient?.fullName || inv.appointment?.patient?.fullName || '---'}</td>
                    <td className="px-4 py-3 font-bold text-sky-600">{inv.amount.toLocaleString('vi-VN')}đ</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-black tracking-wide ${
                        inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' :
                        inv.status === 'REFUNDED' ? 'bg-slate-100 text-slate-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {inv.status === 'PAID' ? 'ĐÃ THANH TOÁN' : inv.status === 'REFUNDED' ? 'ĐÃ HOÀN TIỀN' : 'CHỜ HOÀN TIỀN'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {inv.status === 'PENDING_REFUND' && (
                        <button
                          onClick={() => handleRefund(inv.id)}
                          className="rounded border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600 hover:bg-emerald-100"
                        >
                          Duyệt hoàn tiền
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)] lg:col-span-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-sky-700">
            <CalendarDays className="h-4 w-4" />
            Quản lý Lịch hẹn Gần đây
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Bệnh nhân</th>
                  <th className="px-4 py-3">Bác sĩ</th>
                  <th className="px-4 py-3">Thời gian</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.recentAppointments.map(appt => (
                  <tr key={appt.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{appt.patient?.fullName}</td>
                    <td className="px-4 py-3">{appt.doctor?.fullName}</td>
                    <td className="px-4 py-3">{formatDate(appt.appointmentDate)} {appt.startTime}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-black tracking-wide ${
                        appt.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                        appt.status === 'CANCELLED' ? 'bg-rose-100 text-rose-700' :
                        appt.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                        'bg-sky-100 text-sky-700'
                      }`}>
                        {appt.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(appt.status === 'PENDING' || appt.status === 'CONFIRMED' || appt.status === 'ACCEPTED') && (
                        <button
                          onClick={() => updateAppointmentStatus(appt.id, 'CANCELLED')}
                          className="rounded border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                        >
                          Huỷ lịch
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)] lg:col-span-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-sky-700">
            <MessageSquare className="h-4 w-4" />
            Recent messages
          </div>
          <div className="mt-4 space-y-3">
            {data.recentMessages.map((message) => (
              <div key={message.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
                  <span>{message.sender?.fullName ?? '---'} · {message.sender?.role ?? '---'}</span>
                  <span>{formatTime(message.createdAt)}</span>
                </div>
                <p className="mt-2 text-sm font-medium text-slate-800">{message.content}</p>
              </div>
            ))}
          </div>
        </section>
      </>
    );
  }

  function renderPatientSections(data: PatientPayload) {
    return (
      <>
        <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)] lg:col-span-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-sky-700">
            <Users className="h-4 w-4" />
            Patient profile
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-sky-600 via-cyan-500 to-emerald-500 text-xl font-black text-white">
              {data.patient.fullName.charAt(0)}
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight">{data.patient.fullName}</h2>
              <p className="text-slate-600">{data.patient.email}</p>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-emerald-100 bg-emerald-50 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)] lg:col-span-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
            Số dư ví OS Telehealth
          </div>
          <div className="mt-4">
            <h2 className="text-3xl font-black text-emerald-600">
              {wallet ? wallet.balance.toLocaleString('vi-VN') + ' VNĐ' : 'Đang tải...'}
            </h2>
            <p className="text-sm text-emerald-600/80 mt-1">Dùng để thanh toán phí khám trực tuyến</p>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)] lg:col-span-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-sky-700">
            Lịch sử giao dịch
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3">Mã hoá đơn</th>
                  <th className="px-4 py-3">Số tiền</th>
                  <th className="px-4 py-3">Bác sĩ</th>
                  <th className="px-4 py-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.length === 0 ? (
                  <tr><td colSpan={4} className="py-4 text-center text-slate-400">Chưa có giao dịch nào</td></tr>
                ) : invoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">#{inv.id}</td>
                    <td className="px-4 py-3 text-rose-600 font-bold">-{inv.amount.toLocaleString('vi-VN')}đ</td>
                    <td className="px-4 py-3">{inv.appointment?.doctor?.fullName || '---'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-black tracking-wide ${
                        inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' :
                        inv.status === 'REFUNDED' ? 'bg-slate-100 text-slate-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {inv.status === 'PAID' ? 'ĐÃ THANH TOÁN' : inv.status === 'REFUNDED' ? 'ĐÃ HOÀN TIỀN' : 'CHỜ HOÀN TIỀN'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-sky-700">
              <CalendarDays className="h-4 w-4" />
              Lịch hẹn sắp tới
            </div>
            {data.upcomingAppointments.filter(a => a.status !== 'CANCELLED').length > 0 && (
              <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-black text-sky-700">{data.upcomingAppointments.filter(a => a.status !== 'CANCELLED').length}</span>
            )}
          </div>
          <div className="mt-4 space-y-3">
            {data.upcomingAppointments.filter(a => a.status !== 'CANCELLED').length === 0 ? (
              <p className="text-center py-6 text-sm text-slate-400">Chưa có lịch hẹn sắp tới</p>
            ) : data.upcomingAppointments.filter(a => a.status !== 'CANCELLED').map((appointment) => (
              <div key={appointment.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900">{formatDoctorName(appointment.doctor?.fullName)}</p>
                    <p className="text-sm text-slate-600">{formatDate(appointment.appointmentDate)} · {appointment.startTime} – {appointment.endTime}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
                    appointment.status === 'CONFIRMED' || appointment.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-700' :
                    appointment.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>{appointment.status === 'PENDING' ? 'CHỜ DUYỆT' : appointment.status === 'CONFIRMED' ? 'ĐÃ XÁC NHẬN' : appointment.status}</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  {(appointment.status === 'CONFIRMED' || appointment.status === 'ACCEPTED') ? (
                    <button
                      onClick={() => navigate(`/clinic?doc=${appointment.doctorId ?? 1}&appointmentId=${appointment.id}`)}
                      className="flex-1 rounded-full bg-sky-600 px-4 py-2 text-center text-sm font-bold text-white transition hover:bg-sky-700"
                    >
                      Vào phòng khám
                    </button>
                  ) : (
                    <div className="flex-1 rounded-full bg-amber-50 border border-amber-100 py-2 text-center text-xs font-semibold text-amber-600">
                      ⏳ Đang chờ bác sĩ xác nhận lịch hẹn
                    </div>
                  )}
                  {(appointment.status === 'PENDING' || appointment.status === 'CONFIRMED') && (
                    <button
                      onClick={() => updateAppointmentStatus(appointment.id, 'CANCELLED')}
                      disabled={cancellingId === appointment.id}
                      className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                    >
                      {cancellingId === appointment.id ? '...' : 'Hủy'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section Lịch đã hủy - hiện trạng thái chờ hoàn tiền */}
        {data.upcomingAppointments.filter(a => a.status === 'CANCELLED').length > 0 && (
          <section className="rounded-[2rem] border border-rose-100 bg-rose-50/50 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-rose-600">
              <XCircle className="h-4 w-4" />
              Lịch đã hủy &amp; Trạng thái hoàn tiền
            </div>
            <div className="mt-4 space-y-3">
              {data.upcomingAppointments.filter(a => a.status === 'CANCELLED').map((appointment) => {
                const relatedInvoice = invoices.find(inv => inv.appointmentId === appointment.id);
                return (
                  <div key={appointment.id} className="rounded-3xl border border-rose-100 bg-white p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-slate-900">{formatDoctorName(appointment.doctor?.fullName)}</p>
                        <p className="text-sm text-slate-600">{formatDate(appointment.appointmentDate)} · {appointment.startTime} – {appointment.endTime}</p>
                      </div>
                      <span className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide bg-rose-100 text-rose-700">ĐÃ HỦY</span>
                    </div>
                    {relatedInvoice && (
                      <div className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${
                        relatedInvoice.status === 'REFUNDED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                        'bg-amber-50 text-amber-700 border border-amber-100'
                      }`}>
                        {relatedInvoice.status === 'REFUNDED' ? (
                          <><span>✅</span> Đã hoàn tiền <strong>{relatedInvoice.amount.toLocaleString('vi-VN')}đ</strong> vào ví của bạn.</>
                        ) : (
                          <><span>⏳</span> Đang xử lý hoàn tiền <strong>{relatedInvoice.amount.toLocaleString('vi-VN')}đ</strong> — Admin sẽ duyệt sớm.</>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-sky-700">
            <CheckCircle2 className="h-4 w-4" />
            Lịch sử khám
          </div>
          <div className="mt-4 space-y-3">
            {data.completedAppointments.length === 0 ? (
              <p className="text-center py-6 text-sm text-slate-400">Chưa có lịch sử khám bệnh</p>
            ) : data.completedAppointments.map((appointment) => (
              <div key={appointment.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900">{formatDoctorName(appointment.doctor?.fullName)}</p>
                    <p className="text-sm text-slate-600">{formatDate(appointment.appointmentDate)} · {appointment.startTime} – {appointment.endTime}</p>
                  </div>
                  <span className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide bg-slate-200 text-slate-700">ĐÃ HOÀN TẤT</span>
                </div>
                {appointment.prescriptions && appointment.prescriptions.length > 0 && (
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setSelectedPrescription({
                        appointmentId: appointment.id,
                        date: formatDate(appointment.appointmentDate),
                        doctorName: formatDoctorName(appointment.doctor?.fullName),
                        diagnosis: appointment.prescriptions![0].diagnosis,
                        medicines: appointment.prescriptions![0].medicines,
                        aiSummary: appointment.aiSummaries?.[0]?.aiSummary,
                        suggestedMedicines: appointment.aiSummaries?.[0]?.suggestedMedicines
                      })}
                      className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800"
                    >
                      <FileText className="h-3 w-3" />
                      Xem Hồ sơ & Đơn thuốc
                    </button>
                    {!appointment.review && (
                      <button
                        onClick={() => setRatingModal({ appointmentId: appointment.id, doctorName: formatDoctorName(appointment.doctor?.fullName) })}
                        className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-700 transition hover:bg-amber-100"
                      >
                        Đánh giá Bác sĩ
                      </button>
                    )}
                    {appointment.review && (
                      <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 border border-emerald-100">
                        Đã đánh giá: {appointment.review.rating} ★
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-sky-700">
            <HeartPulse className="h-4 w-4" />
            Vital signs
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {data.vitals.map((item) => (
              <div key={item.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-700">{item.heartRate ?? '---'} bpm</p>
                <p className="text-xs text-slate-500">SpO2 {item.oxygenSaturation ?? '---'}%</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)] lg:col-span-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-sky-700">
            <MessageSquare className="h-4 w-4" />
            Messages
          </div>
          <div className="mt-4 space-y-3">
            {data.messages.map((message) => (
              <div key={message.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>{message.sender?.fullName ?? '---'}</span>
                  <span>{formatTime(message.createdAt)}</span>
                </div>
                <p className="mt-2 text-sm font-medium text-slate-800">{message.content}</p>
              </div>
            ))}
          </div>
        </section>
      </>
    );
  }

  function renderDoctorSections(data: DoctorPayload) {
    const allAppts = data.upcomingAppointments && data.upcomingAppointments.length > 0
      ? data.upcomingAppointments
      : data.todaysAppointments;
    const appointmentsList = allAppts.filter(a => a.status !== 'CANCELLED');

    return (
      <>
        {/* Quản lý Lịch làm việc */}
        <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)] lg:col-span-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-sky-700 mb-4">
            <CalendarDays className="h-4 w-4" />
            Cấu hình lịch làm việc
          </div>
          <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Chọn ngày:</label>
            <input 
              type="date" 
              value={selectedScheduleDate}
              onChange={(e) => setSelectedScheduleDate(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              min={new Date().toISOString().split('T')[0]}
            />
            <p className="mt-2 text-xs text-slate-500">Bấm vào các khung giờ dưới đây để đánh dấu giờ rảnh (Xanh) hoặc bận (Xám).</p>
          </div>
          
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {TIME_SLOTS.map((slot) => {
              const [start] = slot.split(' - ');
              const scheduleItem = doctorSchedules.find(s => s.startTime === start);
              const isAvailable = !!scheduleItem;
              const isBooked = scheduleItem?.isBooked;

              return (
                <button
                  key={slot}
                  onClick={() => toggleScheduleSlot(slot)}
                  disabled={loadingSchedule || isBooked}
                  className={`rounded-xl px-2 py-3 text-center text-[11px] font-bold transition-all sm:text-sm ${
                    isBooked
                      ? 'bg-rose-100 text-rose-700 opacity-60 cursor-not-allowed border border-rose-200'
                      : isAvailable 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 shadow-sm' 
                        : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  {slot}
                  {isBooked && <span className="block text-[9px] mt-1 text-rose-500 font-black">ĐÃ ĐẶT</span>}
                </button>
              );
            })}
          </div>
        </section>
        <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)] lg:col-span-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-sky-700">
            <Stethoscope className="h-4 w-4" />
            Doctor profile
          </div>
          <div className="mt-4 space-y-2">
            <h2 className="text-2xl font-black tracking-tight">{formatDoctorName(data.doctor.fullName)}</h2>
            <p className="text-slate-600">{data.doctor.email}</p>
            <p className="text-sm font-semibold text-slate-800">{data.profile?.specialty ?? '---'}</p>
            <p className="text-sm text-slate-600">{data.profile?.bio ?? '---'}</p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-700 border border-emerald-100">
              <Banknote className="h-4 w-4" />
              Tổng doanh thu: {(data.stats.completedAppointments * 100000).toLocaleString('vi-VN')} VNĐ
            </div>
          </div>
        </section>

        {/* Danh sách lịch hẹn bệnh nhân đã đặt với bác sĩ */}
        <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)] lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-sky-700">
              <CalendarDays className="h-4 w-4" />
              Lịch hẹn khám bệnh từ người dùng ({appointmentsList.length})
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {appointmentsList.length === 0 ? (
              <p className="text-center py-6 text-sm text-slate-400">Chưa có lịch hẹn khám nào từ bệnh nhân</p>
            ) : appointmentsList.map((appointment) => (
              <div key={appointment.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900">Bệnh nhân: {appointment.patient?.fullName ?? 'Bệnh nhân'}</p>
                    <p className="text-sm text-slate-600">{formatDate(appointment.appointmentDate)} · {appointment.startTime} – {appointment.endTime}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
                    appointment.status === 'CONFIRMED' || appointment.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-700' :
                    appointment.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                    appointment.status === 'CANCELLED' ? 'bg-rose-100 text-rose-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>{appointment.status === 'CANCELLED' ? 'ĐÃ HỦY' : appointment.status === 'PENDING' ? 'CHỜ DUYỆT' : appointment.status === 'CONFIRMED' ? 'ĐÃ DUYỆT' : appointment.status}</span>
                </div>

                {/* Nút thao tác dành cho Bác sĩ */}
                <div className="mt-3 flex items-center gap-2">
                  {appointment.status === 'PENDING' && (
                    <>
                      <button
                        onClick={() => updateAppointmentStatus(appointment.id, 'CONFIRMED')}
                        disabled={cancellingId === appointment.id}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-emerald-600 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Duyệt lịch
                      </button>
                      <button
                        onClick={() => updateAppointmentStatus(appointment.id, 'CANCELLED')}
                        disabled={cancellingId === appointment.id}
                        className="inline-flex items-center justify-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Từ chối
                      </button>
                    </>
                  )}

                  {(appointment.status === 'CONFIRMED' || appointment.status === 'ACCEPTED') && (
                    <button 
                      onClick={() => navigate(`/clinic?doc=${authUser?.id ?? 1}&appointmentId=${appointment.id}`)}
                      className="flex-1 rounded-full bg-emerald-600 px-4 py-2 text-center text-sm font-bold text-white transition hover:bg-emerald-700"
                    >
                      Vào phòng tư vấn
                    </button>
                  )}

                  {appointment.status === 'CANCELLED' && (
                    <div className="flex-1 rounded-full bg-slate-100 py-2 text-center text-xs font-semibold text-slate-500">
                      ❌ Đã hủy phiên khám này
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-sky-700">
            <FileText className="h-4 w-4" />
            Prescriptions
          </div>
          <div className="mt-4 space-y-3">
            {data.prescriptions.map((item) => (
              <div key={item.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                <p className="font-bold text-slate-900">{item.diagnosis}</p>
                <p className="mt-1 text-sm text-slate-600">{item.medicines}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-sky-700">
            <HeartPulse className="h-4 w-4" />
            Vital signs
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {data.vitals.map((item) => (
              <div key={item.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-700">{item.heartRate ?? '---'} bpm</p>
                <p className="text-xs text-slate-500">SpO2 {item.oxygenSaturation ?? '---'}%</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)] lg:col-span-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-sky-700">
            <MessageSquare className="h-4 w-4" />
            Messages
          </div>
          <div className="mt-4 space-y-3">
            {data.messages.map((message) => (
              <div key={message.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>{message.sender?.fullName ?? '---'}</span>
                  <span>{formatTime(message.createdAt)}</span>
                </div>
                <p className="mt-2 text-sm font-medium text-slate-800">{message.content}</p>
              </div>
            ))}
          </div>
        </section>
      </>
    );
  }
}

export default Dashboard;
