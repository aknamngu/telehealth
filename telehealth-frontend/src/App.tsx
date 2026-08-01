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

function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();

  if (!getAuthToken()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

// Popup thông báo cuộc gọi đến — hiển thị ở MỌI trang cho bác sĩ
function DoctorCallListener() {
  const authUser = getAuthUser() as AuthUser | null;
  const navigate = useNavigate();
  const [incomingCall, setIncomingCall] = useState<IncomingCallPayload | null>(null);

  useEffect(() => {
    if (!authUser || authUser.role !== 'DOCTOR') return;

    const handler = (payload: IncomingCallPayload) => {
      console.log('Doctor received call:invite', payload);
      setIncomingCall(payload);
    };

    socket.on('call:invite', handler);

    return () => {
      socket.off('call:invite', handler);
    };
  }, [authUser?.id, authUser?.role]);

  if (!incomingCall) return null;

  const accept = () => {
    const { appointmentId, doctorId } = incomingCall;
    setIncomingCall(null);
    // Điều hướng bác sĩ vào trang CLINIC (đẹp) với autoAccept=true
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

    if (authUser.role === 'DOCTOR') {
      // Bác sĩ join room cá nhân để nhận call:invite từ bệnh nhân ở MỌI trang
      socket.emit('joinRoom', `doctor_${authUser.id}`);
      console.log('Doctor socket joined room:', `doctor_${authUser.id}`);
    }

    return () => {
      socket.disconnect();
    };
  }, [authUser?.id, authUser?.role]);

  return (
    <Router>
      {/* DoctorCallListener phải nằm bên trong Router để dùng useNavigate */}
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
        {/* Giữ route /consultation để backward compatible, nhưng mọi luồng mới đều dùng /clinic */}
      </Routes>
    </Router>
  );
}

export default App;