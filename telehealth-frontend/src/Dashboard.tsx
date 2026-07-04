import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  ChartColumn,
  FileText,
  HeartPulse,
  LogOut,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
} from 'lucide-react';
import { clearAuthSession, getAuthToken, type AuthUser } from './auth';

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
    todayAppointments: number;
    completedAppointments: number;
    prescriptionCount: number;
    vitalCount: number;
    messageCount: number;
  };
  todaysAppointments: AppointmentItem[];
  completedAppointments: AppointmentItem[];
  prescriptions: PrescriptionItem[];
  vitals: VitalItem[];
  messages: MessageItem[];
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

function formatDate(value?: string | Date) {
  if (!value) return '---';
  return new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(value?: string | Date) {
  if (!value) return '---';
  return new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function Dashboard() {
  const navigate = useNavigate();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [payload, setPayload] = useState<AdminPayload | PatientPayload | DoctorPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  useEffect(() => {
    if (!authUser) return;

    const token = getAuthToken();

    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    setLoading(true);
    setError('');

    fetch(`${API_URL}/dashboard`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (response) => {
        const data = (await response.json()) as ApiWrapper<AdminPayload | PatientPayload | DoctorPayload>;

        if (!response.ok) {
          throw new Error(data.message ?? 'Không thể tải dashboard');
        }

        setPayload(data.data);
      })
      .catch((loadError) => {
        setPayload(null);
        setError(loadError instanceof Error ? loadError.message : 'Không thể tải dashboard');
      })
      .finally(() => setLoading(false));
  }, [authUser, navigate]);

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
      ['Today', doctor.stats.todayAppointments],
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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.12),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.12),_transparent_26%),linear-gradient(180deg,_#f8fafc_0%,_#eef6ff_52%,_#f8fafc_100%)] text-slate-900">
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
                    <p className="font-bold text-slate-900">{doctor.name}</p>
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

        <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)] lg:col-span-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-sky-700">
            <CalendarDays className="h-4 w-4" />
            Recent appointments
          </div>
          <div className="mt-4 space-y-3">
            {data.recentAppointments.map((appointment) => (
              <div key={appointment.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">{appointment.patient?.fullName ?? '---'}</p>
                    <p className="text-sm text-slate-600">{appointment.doctor?.fullName ?? '---'}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">{appointment.status}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-600">
                  <span>{formatDate(appointment.appointmentDate)}</span>
                  <span>{appointment.startTime} - {appointment.endTime}</span>
                </div>
              </div>
            ))}
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

        <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-sky-700">
            <CalendarDays className="h-4 w-4" />
            Upcoming appointments
          </div>
          <div className="mt-4 space-y-3">
            {data.upcomingAppointments.map((appointment) => (
              <div key={appointment.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                <p className="font-bold text-slate-900">{appointment.doctor?.fullName ?? '---'}</p>
                <p className="text-sm text-slate-600">{formatDate(appointment.appointmentDate)} · {appointment.startTime} - {appointment.endTime}</p>
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

  function renderDoctorSections(data: DoctorPayload) {
    return (
      <>
        <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)] lg:col-span-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-sky-700">
            <Stethoscope className="h-4 w-4" />
            Doctor profile
          </div>
          <div className="mt-4 space-y-2">
            <h2 className="text-2xl font-black tracking-tight">{data.doctor.fullName}</h2>
            <p className="text-slate-600">{data.doctor.email}</p>
            <p className="text-sm font-semibold text-slate-800">{data.profile?.specialty ?? '---'}</p>
            <p className="text-sm text-slate-600">{data.profile?.bio ?? '---'}</p>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-sky-700">
            <CalendarDays className="h-4 w-4" />
            Today's appointments
          </div>
          <div className="mt-4 space-y-3">
            {data.todaysAppointments.map((appointment) => (
              <div key={appointment.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                <p className="font-bold text-slate-900">{appointment.patient?.fullName ?? '---'}</p>
                <p className="text-sm text-slate-600">{formatDate(appointment.appointmentDate)} · {appointment.startTime} - {appointment.endTime}</p>
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
