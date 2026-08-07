import { BrowserRouter as Router, Navigate, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Home from './Home';
import Clinic from './Clinic';
import Dashboard from './Dashboard';
import Login from './Login';
import { getAuthToken, getAuthUser, type AuthUser } from './auth';
import { socket } from './socket';

interface IncomingCallPayload {
  appointmentId: string;
  doctorId?: number;
  fromName: string;
  fromRole: string;
}

interface EmergencyCallPayload {
  appointmentId: string;
  doctorId?: number;
  fromName: string;
  emergencyType: string;
  details?: string;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();

  if (!getAuthToken()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

// Popup thông báo cuộc gọi đến / Báo động Cấp cứu SOS — hiển thị ở MỌI trang cho bác sĩ
function DoctorCallListener() {
  const authUser = getAuthUser() as AuthUser | null;
  const navigate = useNavigate();
  const [incomingCall, setIncomingCall] = useState<IncomingCallPayload | null>(null);
  const [emergencyCall, setEmergencyCall] = useState<EmergencyCallPayload | null>(null);

  useEffect(() => {
    if (!authUser || authUser.role !== 'DOCTOR') return;

    // Tham gia phòng của riêng bác sĩ để nhận thông báo từ mọi nơi
    socket.emit('joinRoom', `doctor_${authUser.id}`);

    const normalCallHandler = (payload: IncomingCallPayload) => {
      console.log('Doctor received call:invite', payload);
      setIncomingCall(payload);
    };

    const emergencyCallHandler = (payload: EmergencyCallPayload) => {
      console.log('🚨 Doctor received EMERGENCY call:emergency', payload);
      setEmergencyCall(payload);
    };

    const emergencyHandledHandler = (payload: { appointmentId: string | number }) => {
      setEmergencyCall((prev) => {
        if (prev && String(prev.appointmentId) === String(payload.appointmentId)) {
          console.log('🚨 SOS call handled by another doctor, hiding modal.');
          return null;
        }
        return prev;
      });
    };

    socket.on('call:invite', normalCallHandler);
    socket.on('call:emergency', emergencyCallHandler);
    socket.on('call:emergency:handled', emergencyHandledHandler);

    return () => {
      socket.off('call:invite', normalCallHandler);
      socket.off('call:emergency', emergencyCallHandler);
      socket.off('call:emergency:handled', emergencyHandledHandler);
    };
  }, [authUser?.id, authUser?.role]);

  // 1. Nếu có cuộc gọi CẤP CỨU KHẨN CẤP SOS (Ưu tiên số 1)
  if (emergencyCall) {
    const acceptEmergency = () => {
      const { appointmentId, doctorId } = emergencyCall;
      
      // Nếu bác sĩ đang trong cuộc gọi thường khác -> phát tín hiệu override
      if (incomingCall) {
        socket.emit('call:emergency:override', {
          emergencyAppointmentId: appointmentId,
          previousAppointmentId: incomingCall.appointmentId,
          doctorId: doctorId ?? authUser?.id ?? 1,
        });
      }

      setEmergencyCall(null);
      setIncomingCall(null);
      const docParam = doctorId ?? authUser?.id ?? 1;
      navigate(`/clinic?doc=${docParam}&appointmentId=${appointmentId}&autoAccept=true&isEmergency=true`);
    };

    const declineEmergency = () => {
      setEmergencyCall(null);
    };

    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-md">
        <div className="w-full max-w-md overflow-hidden rounded-3xl border-4 border-rose-500 bg-white shadow-[0_0_50px_rgba(244,63,94,0.5)] animate-pulse">
          {/* Header Báo động đỏ */}
          <div className="bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 px-6 py-6 text-white">
            <div className="flex items-center gap-3">
              <span className="relative flex h-14 w-14 shrink-0 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-40"></span>
                <span className="relative inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-3xl backdrop-blur">
                  🆘
                </span>
              </span>
              <div>
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-[0.2em] text-white">
                  BÁO ĐỘNG ĐỎ KHẨN CẤP
                </span>
                <h2 className="mt-1 text-2xl font-black tracking-tight">CA CẤP CỨU NGUY CẤP</h2>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-3 px-6 py-6">
            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-600">Loại tình huống khẩn cấp</p>
              <p className="mt-1 text-lg font-black text-rose-950">
                {emergencyCall.emergencyType || 'Cấp cứu nguy kịch'}
              </p>
            </div>

            <p className="text-sm leading-6 text-slate-700">
              Bệnh nhân <span className="font-bold text-slate-900">{emergencyCall.fromName}</span> đang yêu cầu trợ giúp y tế khẩn cấp ngay lập tức!
            </p>
            {emergencyCall.details && (
              <p className="text-xs text-slate-500 italic">" {emergencyCall.details} "</p>
            )}

            {incomingCall && (
              <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 font-semibold border border-amber-200">
                ⚠️ Chấp nhận ca này sẽ tự động ưu tiên tạm ngắt phiên tư vấn thường hiện tại của bạn để cứu ca cấp cứu!
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
            <button
              onClick={declineEmergency}
              className="flex-1 rounded-full border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Bỏ qua
            </button>
            <button
              onClick={acceptEmergency}
              className="flex-[2] rounded-full bg-gradient-to-r from-rose-600 to-red-600 py-3 text-sm font-black text-white shadow-lg shadow-rose-600/40 transition hover:from-rose-700 hover:to-red-700 active:scale-95 flex items-center justify-center gap-2"
            >
              🚨 ỨNG CỨU NGAY
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Cuộc gọi thường
  if (!incomingCall) return null;

  const accept = () => {
    const { appointmentId, doctorId } = incomingCall;
    setIncomingCall(null);
    const docParam = doctorId ?? authUser?.id ?? 1;
    navigate(`/clinic?doc=${docParam}&appointmentId=${appointmentId}&autoAccept=true`);
  };

  const decline = () => {
    socket.emit('call:decline', { appointmentId: incomingCall.appointmentId });
    setIncomingCall(null);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-600 to-cyan-500 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <span className="relative flex h-12 w-12 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-30"></span>
              <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-2xl backdrop-blur">
                📞
              </span>
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-100">Cuộc gọi đến</p>
              <h2 className="text-xl font-black">Bệnh nhân đang gọi</h2>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-slate-600">
            <span className="font-bold text-slate-900">{incomingCall.fromName}</span> đang yêu cầu phiên tư vấn video trực tuyến.
          </p>
          <p className="mt-1 text-sm text-slate-400">Mã cuộc hẹn: #{incomingCall.appointmentId}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
          <button
            onClick={decline}
            className="flex-1 rounded-full border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:border-slate-300"
          >
            Từ chối
          </button>
          <button
            onClick={accept}
            className="flex-1 rounded-full bg-gradient-to-r from-sky-600 to-cyan-500 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-500/30 transition hover:from-sky-700 hover:to-cyan-600 active:scale-95"
          >
            Tham gia ngay
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const authUser = getAuthUser() as AuthUser | null;

  useEffect(() => {
    if (!authUser) return;

    socket.connect();

    const onConnect = () => {
      if (authUser.role === 'DOCTOR') {
        socket.emit('joinRoom', `doctor_${authUser.id}`);
        console.log('Doctor socket joined room (on connect):', `doctor_${authUser.id}`);
      }
    };

    socket.on('connect', onConnect);

    // Nếu socket đã connect sẵn thì gọi luôn
    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.disconnect();
    };
  }, [authUser?.id, authUser?.role]);

  return (
    <Router>
      <DoctorCallListener />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/clinic" element={<Clinic />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;