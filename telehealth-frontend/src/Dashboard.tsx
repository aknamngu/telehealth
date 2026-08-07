import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Banknote,
  Bell,
  CalendarDays,
  ChartColumn,
  CheckCircle2,
  Clock,
  Edit3,
  FileText,
  HeartPulse,
  LogOut,
  MessageSquare,
  Pill,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Trash2,
  Users,
  Wallet,
  X,
  XCircle,
  AlertTriangle,
  Info,
  Star,
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

interface PatientProfileData {
  medicalHistory?: string | null;
  allergies?: string | null;
  bloodType?: string | null;
}

interface MedicationReminder {
  id: number;
  medicineName: string;
  reminderTime: string;
  isActive: boolean;
  prescription: {
    diagnosis: string;
    appointment: { doctor?: { fullName: string } };
  };
}

interface DoctorPendingProfile {
  id: number;
  userId: number;
  specialty: string;
  experienceYears: number;
  bio?: string | null;
  status: string;
  user: { id: number; fullName: string; email: string };
}

interface DoctorPayload {
  doctor: { id: number; fullName: string; email: string; role: string };
  profile?: { specialty?: string; experienceYears?: number; bio?: string | null; status?: string } | null;
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

  // ===== TOAST & CONFIRM MODAL SYSTEM =====
  const [toasts, setToasts] = useState<{ id: number; type: 'success' | 'error' | 'info' | 'warning'; message: string }[]>([]);
  const toastIdRef = useRef(0);
  const showToast = (type: 'success' | 'error' | 'info' | 'warning', message: string) => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void; confirmLabel?: string; variant?: 'danger' | 'success' } | null>(null);
  const showConfirm = (opts: { title: string; message: string; onConfirm: () => void; confirmLabel?: string; variant?: 'danger' | 'success' }) => {
    setConfirmModal(opts);
  };

  // States cho Quản lý Lịch làm việc Bác sĩ
  const [selectedScheduleDate, setSelectedScheduleDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [doctorSchedules, setDoctorSchedules] = useState<{startTime: string, endTime: string, isBooked: boolean}[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  // States cho Ví & Hoá đơn
  const [wallet, setWallet] = useState<{ balance: number } | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);

  // States Hồ sơ Bệnh nhân
  const [patientProfile, setPatientProfile] = useState<PatientProfileData | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({ medicalHistory: '', allergies: '', bloodType: '' });
  const [profileSaving, setProfileSaving] = useState(false);

  // States Hồ sơ Bác sĩ
  const [showDoctorProfileModal, setShowDoctorProfileModal] = useState(false);
  const [doctorProfileForm, setDoctorProfileForm] = useState({ specialty: '', experienceYears: 0, bio: '' });
  const [doctorProfileSaving, setDoctorProfileSaving] = useState(false);

  // States Nhắc uống thuốc
  const [reminders, setReminders] = useState<MedicationReminder[]>([]);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderForm, setReminderForm] = useState({ prescriptionId: 0, medicineName: '', reminderTime: '08:00' });
  const [reminderSaving, setReminderSaving] = useState(false);
  const reminderCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [reminderToast, setReminderToast] = useState<string | null>(null);

  // Danh sách đơn thuốc cho dropdown nhắc nhở
  const [allPrescriptions, setAllPrescriptions] = useState<{ id: number; diagnosis: string; medicines: string; doctorName?: string }[]>([]);

  // States Admin: Duyệt hồ sơ Bác sĩ
  const [pendingDoctors, setPendingDoctors] = useState<DoctorPendingProfile[]>([]);

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
        loadWalletAndInvoices();
      }
    } catch { /* ignore */ }
    finally { setCancellingId(null); }
  }

  const handleRefund = async (invoiceId: number) => {
    showConfirm({
      title: 'Xác nhận hoàn tiền',
      message: 'Bạn có chắc chắn muốn hoàn tiền cho giao dịch này?',
      confirmLabel: 'Hoàn tiền',
      variant: 'success',
      onConfirm: async () => {
        const token = getAuthToken();
        try {
          const res = await fetch(`${API_URL}/wallet/invoices/${invoiceId}/refund`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || 'Lỗi hoàn tiền');
          showToast('success', '✅ Hoàn tiền thành công!');
          loadWalletAndInvoices();
        } catch (err: any) {
          showToast('error', err.message);
        }
      }
    });
  };

  // Quản lý trạng thái User (Khóa / Mở khóa)
  async function toggleUserStatus(userId: number, currentStatus: boolean) {
    showConfirm({
      title: currentStatus ? 'Khoá tài khoản' : 'Mở khoá tài khoản',
      message: `Bạn có chắc muốn ${currentStatus ? 'KHOÁ' : 'MỞ KHOÁ'} tài khoản này?`,
      confirmLabel: currentStatus ? 'Khoá' : 'Mở khoá',
      variant: currentStatus ? 'danger' : 'success',
      onConfirm: async () => {
        const token = getAuthToken();
        if (!token) return;
        try {
          const res = await fetch(`${API_URL}/users/${userId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ isActive: !currentStatus }),
          });
          if (res.ok) {
            showToast('success', `Đã ${currentStatus ? 'khoá' : 'mở khoá'} thành công!`);
            loadDashboard();
          } else {
            const data = await res.json();
            showToast('error', data.message || 'Có lỗi xảy ra');
          }
        } catch (_e) {
          showToast('error', 'Không thể kết nối đến máy chủ!');
        }
      }
    });
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
      
      showToast('success', '✨ Cảm ơn bạn đã gửi đánh giá!');
      setRatingModal(null);
      setRatingVal(5);
      setRatingComment('');
      loadDashboard();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Có lỗi xảy ra');
    } finally {
      setRatingLoading(false);
    }
  }

  // ===== HỒ SƠ BỆNH NHÂN =====
  const loadPatientProfile = useCallback(async () => {
    if (!authUser || authUser.role !== 'PATIENT') return;
    const token = getAuthToken();
    try {
      const res = await fetch(`${API_URL}/users/profile/me`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.data?.patientProfile) {
        setPatientProfile(data.data.patientProfile);
        setProfileForm({
          medicalHistory: data.data.patientProfile.medicalHistory ?? '',
          allergies: data.data.patientProfile.allergies ?? '',
          bloodType: data.data.patientProfile.bloodType ?? '',
        });
      }
    } catch (e) { console.error(e); }
  }, [authUser]);

  useEffect(() => { loadPatientProfile(); }, [loadPatientProfile]);

  const savePatientProfile = async () => {
    setProfileSaving(true);
    try {
      const res = await fetch(`${API_URL}/users/profile/patient`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify(profileForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setPatientProfile(data.data);
      setShowProfileModal(false);
      showToast('success', '✅ Cập nhật hồ sơ thành công!');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Lỗi lưu hồ sơ');
    } finally { setProfileSaving(false); }
  };

  // ===== HỒ SƠ BÁC SĨ =====
  const loadDoctorProfileForm = useCallback(async () => {
    if (!authUser || authUser.role !== 'DOCTOR') return;
    const token = getAuthToken();
    try {
      const res = await fetch(`${API_URL}/users/profile/me`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.data?.doctorProfile) {
        const dp = data.data.doctorProfile;
        setDoctorProfileForm({ specialty: dp.specialty ?? '', experienceYears: dp.experienceYears ?? 0, bio: dp.bio ?? '' });
      }
    } catch (e) { console.error(e); }
  }, [authUser]);

  useEffect(() => { loadDoctorProfileForm(); }, [loadDoctorProfileForm]);

  const saveDoctorProfile = async () => {
    setDoctorProfileSaving(true);
    try {
      const res = await fetch(`${API_URL}/users/profile/doctor`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify(doctorProfileForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setShowDoctorProfileModal(false);
      showToast('info', '📨 Hồ sơ đã gửi, đang chờ Admin phê duyệt!');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Lỗi lưu hồ sơ');
    } finally { setDoctorProfileSaving(false); }
  };

  // ===== ADMIN: DUYỆT HỒ SƠ BÁC SĨ =====
  const loadPendingDoctors = useCallback(async () => {
    if (!authUser || authUser.role !== 'ADMIN') return;
    const token = getAuthToken();
    try {
      const res = await fetch(`${API_URL}/users/doctors/pending`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.data) setPendingDoctors(data.data);
    } catch (e) { console.error(e); }
  }, [authUser]);

  useEffect(() => { loadPendingDoctors(); }, [loadPendingDoctors]);

  const approveDoctorProfile = async (userId: number, status: 'APPROVED' | 'REJECTED') => {
    const token = getAuthToken();
    try {
      const res = await fetch(`${API_URL}/users/${userId}/doctor-profile/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      showToast(status === 'APPROVED' ? 'success' : 'warning', status === 'APPROVED' ? '✅ Đã phê duyệt hồ sơ!' : '❌ Đã từ chối hồ sơ!');
      loadPendingDoctors();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Lỗi khi xử lý');
    }
  };

  // ===== NHẮC UỐNG THUỐC =====
  const loadReminders = useCallback(async () => {
    if (!authUser || authUser.role !== 'PATIENT') return;
    const token = getAuthToken();
    try {
      const res = await fetch(`${API_URL}/medication-reminders`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.data) setReminders(data.data);
    } catch (e) { console.error(e); }
  }, [authUser]);

  useEffect(() => { loadReminders(); }, [loadReminders]);

  const addReminder = async () => {
    if (!reminderForm.medicineName.trim() || !reminderForm.prescriptionId) {
      showToast('warning', 'Vui lòng chọn đơn thuốc và điền tên thuốc!'); return;
    }
    setReminderSaving(true);
    try {
      const res = await fetch(`${API_URL}/medication-reminders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify(reminderForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setShowReminderModal(false);
      setReminderForm({ prescriptionId: 0, medicineName: '', reminderTime: '08:00' });
      loadReminders();
      showToast('success', '💊 Đã thêm lịch nhắc uống thuốc!');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Lỗi thêm nhắc nhở');
    } finally { setReminderSaving(false); }
  };

  const toggleReminder = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/medication-reminders/${id}/toggle`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (res.ok) loadReminders();
    } catch (e) { console.error(e); }
  };

  const deleteReminder = async (id: number) => {
    showConfirm({
      title: 'Xóa lịch nhắc',
      message: 'Bạn có chắc muốn xóa lịch nhắc uống thuốc này?',
      confirmLabel: 'Xóa',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_URL}/medication-reminders/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${getAuthToken()}` },
          });
          if (res.ok) {
            loadReminders();
            showToast('success', 'Đã xóa lịch nhắc!');
          }
        } catch (e) { console.error(e); }
      }
    });
  };

  // Kiểm tra nhắc nhở mỗi 30 giây
  useEffect(() => {
    if (!authUser || authUser.role !== 'PATIENT') return;
    reminderCheckRef.current = setInterval(() => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      const matched = reminders.find(r => r.isActive && r.reminderTime === hhmm);
      if (matched) {
        setReminderToast(`💊 Đến giờ uống thuốc: ${matched.medicineName}`);
        setTimeout(() => setReminderToast(null), 8000);
      }
    }, 30000);
    return () => { if (reminderCheckRef.current) clearInterval(reminderCheckRef.current); };
  }, [authUser, reminders]);

  // Load prescriptions từ completedAppointments cho dropdown nhắc thuốc
  useEffect(() => {
    if (!payload || !authUser || authUser.role !== 'PATIENT') return;
    const patientData = payload as PatientPayload;
    const prescList: { id: number; diagnosis: string; medicines: string; doctorName?: string }[] = [];
    patientData.completedAppointments?.forEach(appt => {
      appt.prescriptions?.forEach(p => {
        prescList.push({
          id: p.id,
          diagnosis: p.diagnosis,
          medicines: p.medicines,
          doctorName: appt.doctor?.fullName,
        });
      });
    });
    setAllPrescriptions(prescList);
  }, [payload, authUser]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.12),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.12),_transparent_26%),linear-gradient(180deg,_#f8fafc_0%,_#eef6ff_52%,_#f8fafc_100%)] text-slate-900">

      {/* ===== TOAST STACK ===== */}
      {toasts.length > 0 && (
        <div className="fixed top-5 right-5 z-[300] flex flex-col gap-3 w-96 pointer-events-none">
          {toasts.map(toast => {
            const cfg = {
              success: { bg: 'bg-emerald-50 border-emerald-200', icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />, accent: 'text-emerald-700' },
              error:   { bg: 'bg-rose-50 border-rose-200', icon: <XCircle className="h-5 w-5 text-rose-600" />, accent: 'text-rose-700' },
              warning: { bg: 'bg-amber-50 border-amber-200', icon: <AlertTriangle className="h-5 w-5 text-amber-600" />, accent: 'text-amber-700' },
              info:    { bg: 'bg-sky-50 border-sky-200', icon: <Info className="h-5 w-5 text-sky-600" />, accent: 'text-sky-700' },
            }[toast.type];
            return (
              <div
                key={toast.id}
                className={`pointer-events-auto flex items-start gap-3 rounded-2xl border ${cfg.bg} p-4 shadow-xl animate-[slideInRight_0.35s_ease-out]`}
              >
                <div className="shrink-0 mt-0.5">{cfg.icon}</div>
                <p className={`flex-1 text-sm font-semibold ${cfg.accent}`}>{toast.message}</p>
                <button onClick={() => dismissToast(toast.id)} className="shrink-0 text-slate-400 hover:text-slate-600 transition">
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== CONFIRM MODAL ===== */}
      {confirmModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[2rem] bg-white p-8 shadow-2xl animate-[slideUp_0.3s_cubic-bezier(0.16,1,0.3,1)]">
            <div className="flex items-start gap-4">
              <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${confirmModal.variant === 'danger' ? 'bg-rose-100' : 'bg-emerald-100'}`}>
                {confirmModal.variant === 'danger'
                  ? <AlertTriangle className="h-6 w-6 text-rose-600" />
                  : <CheckCircle2 className="h-6 w-6 text-emerald-600" />}
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight text-slate-900">{confirmModal.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{confirmModal.message}</p>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 rounded-full border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Hủy bỏ
              </button>
              <button
                onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }}
                className={`flex-1 rounded-full py-3 text-sm font-bold text-white shadow-lg transition active:scale-95 ${
                  confirmModal.variant === 'danger'
                    ? 'bg-rose-600 shadow-rose-600/30 hover:bg-rose-700'
                    : 'bg-emerald-600 shadow-emerald-600/30 hover:bg-emerald-700'
                }`}
              >
                {confirmModal.confirmLabel || 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 💊 Toast nhắc uống thuốc */}
      {reminderToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] flex items-start gap-3 rounded-2xl border border-violet-200 bg-white p-4 shadow-2xl shadow-violet-500/20 w-96">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-violet-100">
            <Pill className="h-5 w-5 text-violet-600" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-violet-600">Nhắc uống thuốc</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{reminderToast}</p>
          </div>
          <button onClick={() => setReminderToast(null)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
        </div>
      )}

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

      {/* Modal Cập nhật Hồ sơ Bệnh nhân */}
      {showProfileModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] bg-white p-8 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="mb-6 flex items-start justify-between">
              <h3 className="text-2xl font-black tracking-tight text-slate-900">Hồ sơ Y tế Của tôi</h3>
              <button onClick={() => setShowProfileModal(false)} className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 hover:bg-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">Nhóm máu</label>
                <input type="text" value={profileForm.bloodType} onChange={e => setProfileForm({ ...profileForm, bloodType: e.target.value })} className="w-full rounded-xl border px-4 py-2" placeholder="Ví dụ: O+, A-" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">Tiền sử bệnh</label>
                <textarea value={profileForm.medicalHistory} onChange={e => setProfileForm({ ...profileForm, medicalHistory: e.target.value })} className="w-full rounded-xl border px-4 py-2 h-24" placeholder="Các bệnh từng mắc..." />
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">Dị ứng thuốc</label>
                <textarea value={profileForm.allergies} onChange={e => setProfileForm({ ...profileForm, allergies: e.target.value })} className="w-full rounded-xl border px-4 py-2 h-24" placeholder="Liệt kê dị ứng nếu có..." />
              </div>
            </div>
            <button onClick={savePatientProfile} disabled={profileSaving} className="mt-6 w-full rounded-full bg-sky-600 py-3 font-bold text-white hover:bg-sky-700 disabled:opacity-50">
              {profileSaving ? 'Đang lưu...' : 'Lưu hồ sơ'}
            </button>
          </div>
        </div>
      )}

      {/* Modal Cập nhật Hồ sơ Bác sĩ */}
      {showDoctorProfileModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] bg-white p-8 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="mb-6 flex items-start justify-between">
              <h3 className="text-2xl font-black tracking-tight text-slate-900">Hồ sơ Chuyên môn</h3>
              <button onClick={() => setShowDoctorProfileModal(false)} className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 hover:bg-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">Chuyên khoa</label>
                <input type="text" value={doctorProfileForm.specialty} onChange={e => setDoctorProfileForm({ ...doctorProfileForm, specialty: e.target.value })} className="w-full rounded-xl border px-4 py-2" placeholder="Ví dụ: Tim mạch, Đa khoa" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">Kinh nghiệm (năm)</label>
                <input type="number" value={doctorProfileForm.experienceYears} onChange={e => setDoctorProfileForm({ ...doctorProfileForm, experienceYears: Number(e.target.value) })} className="w-full rounded-xl border px-4 py-2" min={0} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">Tiểu sử & Kinh nghiệm</label>
                <textarea value={doctorProfileForm.bio} onChange={e => setDoctorProfileForm({ ...doctorProfileForm, bio: e.target.value })} className="w-full rounded-xl border px-4 py-2 h-32" placeholder="Giới thiệu bản thân, nơi công tác..." />
              </div>
            </div>
            <button onClick={saveDoctorProfile} disabled={doctorProfileSaving} className="mt-6 w-full rounded-full bg-sky-600 py-3 font-bold text-white hover:bg-sky-700 disabled:opacity-50">
              {doctorProfileSaving ? 'Đang gửi...' : 'Lưu và Gửi Admin duyệt'}
            </button>
          </div>
        </div>
      )}

      {/* Modal Thêm Nhắc uống thuốc */}
      {showReminderModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] bg-white p-8 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h3 className="text-2xl font-black tracking-tight text-slate-900">Thêm Nhắc uống thuốc</h3>
                <p className="text-xs text-slate-500 mt-1">Chọn đơn thuốc từ lịch sử khám của bạn</p>
              </div>
              <button onClick={() => setShowReminderModal(false)} className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 hover:bg-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Chọn đơn thuốc</label>
                {allPrescriptions.length === 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 font-medium">
                    <AlertTriangle className="inline h-4 w-4 mr-1.5" />
                    Bạn chưa có đơn thuốc nào. Vui lòng hoàn tất ít nhất một ca khám trước.
                  </div>
                ) : (
                  <select
                    value={reminderForm.prescriptionId}
                    onChange={e => {
                      const pid = Number(e.target.value);
                      const selected = allPrescriptions.find(p => p.id === pid);
                      setReminderForm({
                        ...reminderForm,
                        prescriptionId: pid,
                        medicineName: selected ? selected.medicines.split(',')[0].split('\n')[0].trim().substring(0, 60) : reminderForm.medicineName,
                      });
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  >
                    <option value={0}>— Chọn đơn thuốc —</option>
                    {allPrescriptions.map(p => (
                      <option key={p.id} value={p.id}>
                        #{p.id} — {p.diagnosis.substring(0, 40)}{p.doctorName ? ` (BS. ${p.doctorName})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {reminderForm.prescriptionId > 0 && (() => {
                const selected = allPrescriptions.find(p => p.id === reminderForm.prescriptionId);
                return selected ? (
                  <div className="rounded-xl border border-violet-100 bg-violet-50 p-3 text-xs text-violet-800">
                    <p className="font-bold">Chẩn đoán: {selected.diagnosis}</p>
                    <p className="mt-1 text-violet-600">Thuốc: {selected.medicines}</p>
                  </div>
                ) : null;
              })()}
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Tên thuốc cần nhắc</label>
                <input type="text" value={reminderForm.medicineName} onChange={e => setReminderForm({ ...reminderForm, medicineName: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" placeholder="Ví dụ: Paracetamol 500mg" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Giờ uống</label>
                <input type="time" value={reminderForm.reminderTime} onChange={e => setReminderForm({ ...reminderForm, reminderTime: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
              </div>
            </div>
            <button onClick={addReminder} disabled={reminderSaving || allPrescriptions.length === 0} className="mt-6 w-full rounded-full bg-gradient-to-r from-violet-600 to-purple-500 py-3.5 font-bold text-white shadow-lg shadow-violet-600/25 hover:from-violet-700 hover:to-purple-600 disabled:opacity-50 transition active:scale-[0.98]">
              {reminderSaving ? 'Đang lưu...' : '💊 Thêm nhắc nhở'}
            </button>
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
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-amber-600">
            <CheckCircle2 className="h-4 w-4" />
            Phê duyệt hồ sơ bác sĩ
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Bác sĩ</th>
                  <th className="px-4 py-3">Chuyên khoa</th>
                  <th className="px-4 py-3">Kinh nghiệm</th>
                  <th className="px-4 py-3 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingDoctors.length === 0 ? (
                  <tr><td colSpan={4} className="py-4 text-center text-slate-400">Không có hồ sơ nào đang chờ duyệt</td></tr>
                ) : pendingDoctors.map(doc => (
                  <tr key={doc.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">{doc.user.fullName}<br/><span className="text-xs font-normal text-slate-500">{doc.user.email}</span></td>
                    <td className="px-4 py-3 text-sky-700 font-medium">{doc.specialty}</td>
                    <td className="px-4 py-3">{doc.experienceYears} năm</td>
                    <td className="px-4 py-3 text-right flex items-center justify-end gap-2">
                      <button onClick={() => approveDoctorProfile(doc.userId, 'APPROVED')} className="rounded-full bg-emerald-100 text-emerald-700 px-3 py-1 text-xs font-bold hover:bg-emerald-200">Phê duyệt</button>
                      <button onClick={() => approveDoctorProfile(doc.userId, 'REJECTED')} className="rounded-full bg-rose-100 text-rose-700 px-3 py-1 text-xs font-bold hover:bg-rose-200">Từ chối</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-sky-600 via-cyan-500 to-emerald-500 text-xl font-black text-white">
                {data.patient.fullName.charAt(0)}
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tight">{data.patient.fullName}</h2>
                <p className="text-slate-600">{data.patient.email}</p>
              </div>
            </div>
            <button onClick={() => setShowProfileModal(true)} className="flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-100">
              <Edit3 className="h-4 w-4" /> Cập nhật Hồ sơ y tế
            </button>
          </div>
          {patientProfile && (
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Nhóm máu</p>
                <p className="mt-1 font-semibold text-slate-800">{patientProfile.bloodType || 'Chưa cập nhật'}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tiền sử bệnh</p>
                <p className="mt-1 font-semibold text-slate-800">{patientProfile.medicalHistory || 'Chưa cập nhật'}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Dị ứng thuốc</p>
                <p className="mt-1 font-semibold text-slate-800">{patientProfile.allergies || 'Chưa cập nhật'}</p>
              </div>
            </div>
          )}
        </section>

        {/* Lịch nhắc uống thuốc */}
        <section className="rounded-[2rem] border border-violet-100 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)] lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-violet-600">
              <Pill className="h-4 w-4" />
              Lịch nhắc uống thuốc
            </div>
            <button onClick={() => setShowReminderModal(true)} className="rounded-full bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-700">
              + Thêm nhắc nhở
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {reminders.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có lịch nhắc thuốc nào.</p>
            ) : reminders.map(r => (
              <div key={r.id} className={`flex items-center justify-between rounded-2xl border p-4 ${r.isActive ? 'border-violet-200 bg-violet-50' : 'border-slate-200 bg-slate-50 opacity-60'}`}>
                <div className="flex items-center gap-4">
                  <div className={`grid h-12 w-12 place-items-center rounded-xl ${r.isActive ? 'bg-violet-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{r.medicineName}</h3>
                    <p className="text-xs text-slate-500">Giờ uống: <strong className="text-slate-800">{r.reminderTime}</strong></p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleReminder(r.id)} className={`px-3 py-1.5 text-xs font-semibold rounded-full ${r.isActive ? 'bg-white text-violet-700' : 'bg-slate-200 text-slate-700'}`}>
                    {r.isActive ? 'Đang bật' : 'Đã tắt'}
                  </button>
                  <button onClick={() => deleteReminder(r.id)} className="grid h-8 w-8 place-items-center rounded-full text-rose-500 hover:bg-rose-100">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
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
        {/* HỒ SƠ BÁC SĨ */}
        <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)] lg:col-span-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-sky-700 mb-4">
            <Stethoscope className="h-4 w-4" />
            Doctor Profile
          </div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-indigo-600 via-sky-500 to-emerald-500 text-xl font-black text-white shadow-lg">
                {data.doctor.fullName.charAt(0)}
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tight">{data.doctor.fullName}</h2>
                <p className="font-semibold text-sky-600">{data.profile?.specialty || 'Chưa cập nhật chuyên khoa'}</p>
                <p className="text-sm text-slate-500">{data.profile?.experienceYears || 0} năm kinh nghiệm</p>
              </div>
            </div>
            <div className="text-right">
              {data.profile?.status === 'PENDING' && (
                <span className="mb-2 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-700 uppercase">
                  ⏳ Đang chờ Admin duyệt
                </span>
              )}
              <div>
                <button onClick={() => setShowDoctorProfileModal(true)} className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition">
                  <Edit3 className="h-4 w-4" /> Cập nhật hồ sơ
                </button>
              </div>
            </div>
          </div>
          {data.profile?.bio && (
            <div className="mt-6 rounded-2xl bg-slate-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Giới thiệu</p>
              <p className="mt-1 text-sm font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">{data.profile.bio}</p>
            </div>
          )}
        </section>

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

        {/* Đánh giá từ bệnh nhân */}
        <section className="rounded-[2rem] border border-amber-100 bg-amber-50/30 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)] lg:col-span-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-amber-600">
            <Star className="h-4 w-4" />
            Đánh giá từ bệnh nhân
          </div>
          <div className="mt-4 space-y-3">
            {data.completedAppointments.filter(a => a.review).length === 0 ? (
              <p className="text-center py-6 text-sm text-slate-400">Chưa có đánh giá nào từ bệnh nhân</p>
            ) : data.completedAppointments.filter(a => a.review).map((appointment) => (
              <div key={appointment.id} className="rounded-3xl border border-amber-100 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900">{appointment.patient?.fullName ?? 'Bệnh nhân'}</p>
                    <p className="text-sm text-slate-600">{formatDate(appointment.appointmentDate)}</p>
                  </div>
                  <div className="flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-sm font-black text-amber-700">
                    {appointment.review!.rating} ★
                  </div>
                </div>
                {appointment.review!.comment && (
                  <p className="mt-3 text-sm font-medium text-slate-700 bg-amber-50/50 p-3 rounded-2xl border border-amber-100/50">
                    "{appointment.review!.comment}"
                  </p>
                )}
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
