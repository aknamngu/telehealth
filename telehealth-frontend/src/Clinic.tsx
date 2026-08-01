import { socket } from './socket';
import { useEffect, useRef, useState, useCallback, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getAuthToken, getAuthUser } from './auth';
import {
  Activity,
  ArrowLeft,
  CalendarDays,
  Clock,
  Heart,
  MicOff,
  PhoneOff,
  Send,
  ShieldCheck,
  Stethoscope,
  Video,
  VideoOff,
  Zap,
} from 'lucide-react';

interface Doctor {
  id: number;
  name: string;
  specialty: string;
}

interface Message {
  sender: 'patient' | 'doctor';
  text: string;
  time: string;
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

type CallStatus = 'idle' | 'calling' | 'connected' | 'declined' | 'ended' | 'busy';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const TIME_SLOTS = [
  { start: '08:00', end: '08:30' },
  { start: '08:30', end: '09:00' },
  { start: '09:00', end: '09:30' },
  { start: '09:30', end: '10:00' },
  { start: '10:00', end: '10:30' },
  { start: '14:00', end: '14:30' },
  { start: '14:30', end: '15:00' },
  { start: '15:00', end: '15:30' },
  { start: '15:30', end: '16:00' },
];

const EMERGENCY_TYPES = [
  { id: 'drowning', label: '🏊‍♂️ Đuối nước / Ngạt thở', desc: 'Bệnh nhân vừa vớt lên, ngạt nước, cần hướng dẫn ép tim / hô hấp nhân tạo khẩn cấp!' },
  { id: 'accident', label: '🚗 Tai nạn / Chấn thương nặng', desc: 'Mất máu, gãy xương hoặc chấn thương nguy kịch tại hiện trường.' },
  { id: 'cardiac', label: '🫀 Co giật / Ngưng tim đột ngột', desc: 'Bệnh nhân bất tỉnh, co giật hoặc đột ngụy cần can thiệp gấp.' },
  { id: 'other', label: '⚠️ Cấp cứu khẩn cấp khác', desc: 'Các tình huống nguy kịch tính mạng khác.' },
];

function Clinic() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authUser = getAuthUser();
  const queryDocId = searchParams.get('doc');
  const queryAppointmentId = searchParams.get('appointmentId');
  const docId = queryDocId ?? '1';
  const appointmentId = queryAppointmentId ?? queryDocId ?? '1';
  const autoAccept = searchParams.get('autoAccept') === 'true';
  const isEmergencyParam = searchParams.get('isEmergency') === 'true';

  const [doctorsList, setDoctorsList] = useState<Doctor[]>([]);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number>(Number(docId));
  const [heartRate, setHeartRate] = useState(84);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [busyMessage, setBusyMessage] = useState<string>('');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [isEmergencyCall, setIsEmergencyCall] = useState(isEmergencyParam);

  // Modals state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  
  // Schedule Form State
  const [scheduleDate, setScheduleDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number>(0);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingMessage, setBookingMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Emergency Form State
  const [selectedEmergencyType, setSelectedEmergencyType] = useState(EMERGENCY_TYPES[0].id);
  const [emergencyDetails, setEmergencyDetails] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const appointmentIdRef = useRef(appointmentId);
  appointmentIdRef.current = appointmentId;

  // ─── 1. Khởi động Camera ───────────────────────────────────────────────────
  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        setCameraReady(true);
        console.log('📷 Camera ready');
      } catch (err) {
        console.error('Lỗi webcam:', err);
        alert('Hãy cấp quyền truy cập Camera để bắt đầu khám!');
      }
    }
    startCamera();
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ─── 2. Tải danh sách Bác sĩ từ API backend ──────────────────────────────
  useEffect(() => {
    fetch(`${API_URL}/doctors`)
      .then((r) => r.json())
      .then((payload: ApiWrapper<ApiDoctorUser[]> | ApiDoctorUser[]) => {
        const records = Array.isArray(payload) ? payload : payload.data;
        if (Array.isArray(records) && records.length > 0) {
          const docs: Doctor[] = records.map((d) => ({
            id: d.id,
            name: d.fullName,
            specialty: d.doctorProfile?.specialty ?? 'Đa khoa',
          }));

          setDoctorsList(docs);

          // Chọn bác sĩ khớp với docId hoặc lấy bác sĩ đầu tiên trong DB
          const currentDoc = docs.find((d) => d.id === Number(docId)) ?? docs[0];
          setDoctor(currentDoc);
          setSelectedDoctorId(currentDoc.id);
        } else {
          // Fallback nếu chưa có bác sĩ
          const fallback = { id: 1, name: 'BS. Trực tuyến', specialty: 'Đa khoa' };
          setDoctorsList([fallback]);
          setDoctor(fallback);
          setSelectedDoctorId(1);
        }
      })
      .catch(() => {
        const fallback = { id: 1, name: 'BS. Trực tuyến', specialty: 'Đa khoa' };
        setDoctorsList([fallback]);
        setDoctor(fallback);
        setSelectedDoctorId(1);
      });
  }, [docId]);

  // ─── 3. Nhịp tim giả lập ─────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => {
      setHeartRate((p) => { const n = p + (Math.random() > 0.5 ? 1 : -1); return n >= 80 && n <= 88 ? n : p; });
    }, 2500);
    return () => clearInterval(t);
  }, []);

  // ─── 4. Scroll chat ───────────────────────────────────────────────────────
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // ─── 5. Tạo RTCPeerConnection ──────────────────────────────────────────────
  useEffect(() => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });
    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        console.log('📡 Sending ICE candidate');
        socket.emit('candidate', { candidate: e.candidate, appointmentId: appointmentIdRef.current });
      }
    };

    pc.ontrack = (e) => {
      console.log('🎥 Remote track received!');
      if (remoteVideoRef.current && e.streams[0]) {
        remoteVideoRef.current.srcObject = e.streams[0];
      }
      setCallStatus('connected');
    };

    pc.onconnectionstatechange = () => {
      console.log('🔗 Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') setCallStatus('connected');
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') setCallStatus('ended');
    };

    return () => {
      pc.close();
      pcRef.current = null;
    };
  }, []);

  // ─── 6. Setup Socket Listeners (Xử lý Gọi thường, Báo bận, Cấp cứu) ──────
  useEffect(() => {
    if (!cameraReady || !appointmentId) return;

    socket.emit('joinRoom', appointmentId);
    console.log(`🚪 Joined room: room_${appointmentId}`);

    if (authUser?.role === 'DOCTOR') {
      socket.emit('joinRoom', `doctor_${authUser.id}`);
    }

    const addLocalTracks = () => {
      const pc = pcRef.current;
      if (!pc || !localStreamRef.current) return;
      if (pc.getSenders().length > 0) return;
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
        console.log('🎙️ Added local track:', track.kind);
      });
    };

    const handleCallAccept = async () => {
      if (authUser?.role !== 'PATIENT') return;
      console.log('✅ Patient received call:accept, creating offer...');
      try {
        addLocalTracks();
        const pc = pcRef.current!;
        const offer = await pc.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: true });
        await pc.setLocalDescription(offer);
        socket.emit('offer', { offer, appointmentId });
        setCallStatus('calling');
      } catch (err) {
        console.error('Lỗi tạo offer:', err);
      }
    };

    const handleOffer = async (offer: RTCSessionDescriptionInit) => {
      if (authUser?.role !== 'DOCTOR') return;
      console.log('📥 Doctor received offer, creating answer...');
      try {
        addLocalTracks();
        const pc = pcRef.current!;
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', { answer, appointmentId });
      } catch (err) {
        console.error('Lỗi tạo answer:', err);
      }
    };

    const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
      if (authUser?.role !== 'PATIENT') return;
      console.log('📥 Patient received answer');
      try {
        await pcRef.current!.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (err) {
        console.error('Lỗi set answer:', err);
      }
    };

    const handleCandidate = async (candidate: RTCIceCandidateInit) => {
      try {
        if (pcRef.current && candidate) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error('Lỗi add candidate:', err);
      }
    };

    const handleCallBusy = (payload: { message: string }) => {
      console.log('⚠️ Received call:busy event:', payload);
      setCallStatus('busy');
      setBusyMessage(payload.message || 'Bác sĩ hiện đang trong phiên tư vấn khác. Vui lòng đặt lịch hoặc chờ bác sĩ hoàn thành!');
    };

    const handleCallDecline = () => setCallStatus('declined');

    const handleCallEnd = (data?: { reason?: string; message?: string }) => {
      console.log('📴 Call ended', data);
      setCallStatus('ended');
      pcRef.current?.close();
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      if (data?.message) {
        alert(data.message);
      }
    };

    socket.on('call:accept', handleCallAccept);
    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('candidate', handleCandidate);
    socket.on('call:busy', handleCallBusy);
    socket.on('call:decline', handleCallDecline);
    socket.on('call:end', handleCallEnd);

    if (authUser?.role === 'DOCTOR' && autoAccept) {
      console.log('🩺 Doctor autoAccept: emitting call:accept');
      addLocalTracks();
      socket.emit('call:accept', { appointmentId, doctorId: authUser.id, fromName: authUser.fullName });
      setCallStatus('calling');
    }

    return () => {
      socket.off('call:accept', handleCallAccept);
      socket.off('offer', handleOffer);
      socket.off('answer', handleAnswer);
      socket.off('candidate', handleCandidate);
      socket.off('call:busy', handleCallBusy);
      socket.off('call:decline', handleCallDecline);
      socket.off('call:end', handleCallEnd);
    };
  }, [cameraReady, appointmentId, authUser?.id, authUser?.fullName, authUser?.role, autoAccept]);

  // ─── Actions ──────────────────────────────────────────────────────────────
  const startCall = useCallback(() => {
    if (callStatus !== 'idle') return;
    const targetDoctorId = selectedDoctorId || doctor?.id || Number(docId);
    setCallStatus('calling');
    setBusyMessage('');
    setIsEmergencyCall(false);

    socket.emit('call:invite', {
      appointmentId,
      doctorId: targetDoctorId,
      fromName: authUser?.fullName ?? 'Bệnh nhân',
      fromRole: authUser?.role ?? 'PATIENT',
    });
    console.log('📞 call:invite emitted', { appointmentId, doctorId: targetDoctorId });
  }, [callStatus, selectedDoctorId, doctor?.id, docId, appointmentId, authUser?.fullName, authUser?.role]);

  // Kích hoạt BÁO ĐỘNG CẤP CỨU SOS
  const handleEmergencySubmit = (e: FormEvent) => {
    e.preventDefault();
    setShowEmergencyModal(false);

    const emergencyObj = EMERGENCY_TYPES.find((t) => t.id === selectedEmergencyType);
    const targetDoctorId = selectedDoctorId || doctor?.id || Number(docId);

    setCallStatus('calling');
    setIsEmergencyCall(true);

    socket.emit('call:emergency', {
      appointmentId,
      doctorId: targetDoctorId,
      fromName: authUser?.fullName ?? 'Bệnh nhân khẩn cấp',
      emergencyType: emergencyObj?.label ?? 'Cấp cứu nguy kịch',
      details: emergencyDetails,
    });

    console.log('🚨 SOS Emergency emitted:', { appointmentId, emergencyType: emergencyObj?.label });
  };

  // Đặt lịch khám theo slot
  const handleScheduleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const token = getAuthToken();
    if (!token) {
      navigate('/login');
      return;
    }

    setBookingLoading(true);
    setBookingMessage(null);

    const slot = TIME_SLOTS[selectedSlotIndex];
    const targetDoctorId = selectedDoctorId || doctor?.id || Number(docId);

    try {
      const response = await fetch(`${API_URL}/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          doctorId: targetDoctorId,
          appointmentDate: scheduleDate,
          startTime: slot.start,
          endTime: slot.end,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message ?? 'Đã có lỗi xảy ra khi đặt lịch!');
      }

      setBookingMessage({
        type: 'success',
        text: `Đặt lịch khám với ${doctor?.name ?? 'Bác sĩ'} (${slot.start} - ${slot.end} ngày ${scheduleDate}) thành công!`,
      });
      setTimeout(() => {
        setShowScheduleModal(false);
        setBookingMessage(null);
      }, 2500);
    } catch (err) {
      setBookingMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể đặt lịch trùng!',
      });
    } finally {
      setBookingLoading(false);
    }
  };

  const endCall = useCallback(() => {
    socket.emit('call:end', { appointmentId });
    pcRef.current?.close();
    setCallStatus('ended');
    setIsEmergencyCall(false);
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  }, [appointmentId]);

  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsMuted(!track.enabled); }
  };

  const toggleVideo = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsVideoOff(!track.enabled); }
  };

  const handleSend = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    setMessages((p) => [
      ...p,
      { sender: authUser?.role === 'DOCTOR' ? 'doctor' : 'patient', text: chatInput.trim(), time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) },
    ]);
    setChatInput('');
  };

  const isConnected = callStatus === 'connected';
  const isCalling = callStatus === 'calling';
  const isBusy = callStatus === 'busy';

  return (
    <div className="min-h-screen text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.12),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#edf5ff_50%,_#f8fafc_100%)]" />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/60 bg-white/80 backdrop-blur-xl shadow-[0_8px_32px_rgba(15,23,42,0.04)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-sky-200 hover:text-sky-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Về trang chủ
            </button>
            <div className="hidden items-center gap-3 sm:flex">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-sky-600 via-cyan-500 to-emerald-500 text-xs font-black tracking-[0.2em] text-white shadow-lg shadow-sky-500/20">
                OS
              </div>
              <div>
                <p className="text-sm font-extrabold text-slate-950">Phòng khám trực tuyến</p>
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">Workspace tư vấn live</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Action Header Buttons */}
            {authUser?.role !== 'DOCTOR' && (
              <>
                <button
                  onClick={() => setShowScheduleModal(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3.5 py-2 text-xs font-bold text-sky-700 hover:bg-sky-100 transition"
                >
                  <Clock className="h-4 w-4" />
                  Đặt lịch hẹn
                </button>
                <button
                  onClick={() => setShowEmergencyModal(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-3.5 py-2 text-xs font-black text-white shadow-md shadow-rose-500/30 hover:bg-rose-700 transition animate-pulse"
                >
                  🆘 CẤP CỨU SOS
                </button>
              </>
            )}

            {isConnected && (
              <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                {isEmergencyCall ? 'Cấp cứu SOS đang kết nối' : 'Đang kết nối'}
              </div>
            )}

            <div className="rounded-full border border-sky-100 bg-sky-50 px-3 py-2 text-sm font-bold text-sky-700">
              Mã cuộc hẹn #{appointmentId}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1.6fr_0.95fr] lg:px-8">
        <section className="space-y-6">
          {/* Video Room Card */}
          <div className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
            {/* Card Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className={`grid h-11 w-11 place-items-center rounded-2xl text-white shadow-lg ${isEmergencyCall ? 'bg-rose-600' : 'bg-slate-950'}`}>
                  <Video className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Phòng video</p>
                    {isEmergencyCall && (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black uppercase text-rose-700">
                        🚨 Ca Cấp Cứu SOS
                      </span>
                    )}
                  </div>
                  <h1 className="text-lg font-black tracking-tight text-slate-950">{doctor?.name ?? 'Đang tải...'}</h1>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700">
                  <ShieldCheck className="h-4 w-4" />
                  Kết nối bảo mật
                </div>

                {/* Nút Gọi thường */}
                {callStatus === 'idle' && authUser?.role !== 'DOCTOR' && (
                  <button
                    onClick={startCall}
                    className="flex items-center gap-2 rounded-full bg-sky-600 px-4 py-2 text-sm font-bold text-white shadow-lg transition hover:bg-sky-700 active:scale-95"
                  >
                    <Video className="h-4 w-4" />
                    Bắt đầu gọi
                  </button>
                )}

                {/* Nút Kết thúc khi đang gọi hoặc đã kết nối */}
                {(isCalling || isConnected) && (
                  <button
                    onClick={endCall}
                    className="flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm font-bold text-white shadow-lg transition hover:bg-rose-700 active:scale-95"
                  >
                    <PhoneOff className="h-4 w-4" />
                    Kết thúc
                  </button>
                )}
              </div>
            </div>

            {/* ═══ VIDEO AREA ═══ */}
            <div className="relative">
              {/* CONNECTED: Remote video + Local PiP */}
              {isConnected ? (
                <div className="relative h-[420px] w-full overflow-hidden bg-slate-900">
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-full border border-white/20 bg-black/50 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                    {isEmergencyCall && <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />}
                    {authUser?.role === 'PATIENT' ? (doctor?.name ?? 'Bác sĩ') : 'Bệnh nhân'}
                  </div>

                  {/* Local PiP */}
                  <div className="absolute bottom-4 right-4 z-10 h-32 w-48 overflow-hidden rounded-2xl border-2 border-white/30 bg-black shadow-xl">
                    <video ref={localVideoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
                    <div className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">BẠN</div>
                  </div>

                  {/* Controls overlay */}
                  <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-3">
                    <button
                      onClick={toggleMic}
                      className={`grid h-11 w-11 place-items-center rounded-full border shadow-lg backdrop-blur transition active:scale-90 ${isMuted ? 'border-rose-400 bg-rose-500/80 text-white' : 'border-white/20 bg-white/20 text-white hover:bg-white/30'}`}
                      title={isMuted ? 'Bật mic' : 'Tắt mic'}
                    >
                      <MicOff className="h-4 w-4" />
                    </button>
                    <button
                      onClick={endCall}
                      className="grid h-12 w-12 place-items-center rounded-full bg-rose-600 text-white shadow-lg shadow-rose-600/40 transition hover:bg-rose-700 active:scale-90"
                    >
                      <PhoneOff className="h-5 w-5" />
                    </button>
                    <button
                      onClick={toggleVideo}
                      className={`grid h-11 w-11 place-items-center rounded-full border shadow-lg backdrop-blur transition active:scale-90 ${isVideoOff ? 'border-rose-400 bg-rose-500/80 text-white' : 'border-white/20 bg-white/20 text-white hover:bg-white/30'}`}
                      title={isVideoOff ? 'Bật camera' : 'Tắt camera'}
                    >
                      <VideoOff className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                /* IDLE / CALLING / BUSY / ENDED State */
                <div className="relative h-[420px] w-full overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.25),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)]">
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center text-white">
                    {callStatus === 'idle' && (
                      <div className="max-w-xl space-y-3">
                        <div className="mx-auto grid h-20 w-20 place-items-center rounded-[1.75rem] border border-white/10 bg-white/10 text-4xl shadow-2xl backdrop-blur">
                          🩺
                        </div>
                        <p className="text-2xl font-black tracking-tight">Sẵn sàng tư vấn</p>
                        <p className="text-sm leading-7 text-slate-300">
                          {authUser?.role === 'DOCTOR'
                            ? 'Bệnh nhân chưa bắt đầu cuộc gọi.'
                            : 'Bấm "Bắt đầu gọi" hoặc chọn nút SOS nếu gặp tình huống khẩn cấp.'}
                        </p>
                      </div>
                    )}

                    {/* ĐANG GỌI CẤP CỨU NGUY CẤP */}
                    {isCalling && isEmergencyCall && (
                      <div className="rounded-3xl border border-rose-500/40 bg-rose-500/10 px-8 py-6 shadow-2xl backdrop-blur animate-pulse">
                        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-rose-600 text-3xl">
                          🆘
                        </div>
                        <p className="text-2xl font-black text-rose-300 uppercase tracking-wide">
                          ĐANG PHÁT BÁO ĐỘNG CẤP CỨU SOS
                        </p>
                        <p className="mt-2 max-w-md text-sm leading-6 text-slate-200">
                          Hệ thống đang ưu tiên gửi thông báo nguy cấp tới toàn bộ bác sĩ trực tuyến. Vui lòng giữ máy!
                        </p>
                      </div>
                    )}

                    {/* ĐANG GỌI THƯỜNG */}
                    {isCalling && !isEmergencyCall && (
                      <div className="rounded-3xl border border-white/10 bg-white/5 px-8 py-6 shadow-lg backdrop-blur">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center">
                          <span className="relative flex h-12 w-12">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-40" />
                            <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-full bg-sky-500 text-2xl">📞</span>
                          </span>
                        </div>
                        <p className="text-xl font-bold">
                          {authUser?.role === 'DOCTOR' ? 'Đang kết nối với bệnh nhân...' : 'Đang chờ bác sĩ nhận cuộc gọi'}
                        </p>
                        <p className="mt-2 text-sm text-slate-300">Phiên tư vấn sẽ được kết nối ngay khi cả 2 sẵn sàng.</p>
                      </div>
                    )}

                    {/* BÁC SĨ BẬN CUỘC GỌI KHIẾN BỆNH NHÂN KHÔNG GỌI ĐƯỢC */}
                    {isBusy && (
                      <div className="max-w-md rounded-3xl border border-amber-400/40 bg-amber-500/15 p-6 backdrop-blur text-center">
                        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-amber-500 text-slate-950 font-black">
                          ⚠️
                        </div>
                        <p className="text-xl font-black text-amber-300">BÁC SĨ ĐANG BẬN TƯ VẤN</p>
                        <p className="mt-2 text-sm leading-6 text-slate-200">
                          {busyMessage || 'Bác sĩ hiện đang trong phiên tư vấn trực tiếp với bệnh nhân khác. Bạn vui lòng Đặt lịch hẹn hoặc chờ ít phút!'}
                        </p>
                        <div className="mt-5 flex justify-center gap-3">
                          <button
                            onClick={() => setShowScheduleModal(true)}
                            className="rounded-full bg-sky-500 px-5 py-2 text-xs font-bold text-white shadow hover:bg-sky-600 transition"
                          >
                            📅 Đặt lịch khám
                          </button>
                          <button
                            onClick={() => setCallStatus('idle')}
                            className="rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20 transition"
                          >
                            Đóng
                          </button>
                        </div>
                      </div>
                    )}

                    {callStatus === 'declined' && (
                      <div className="rounded-3xl border border-rose-400/30 bg-rose-500/10 px-8 py-6 backdrop-blur">
                        <p className="text-xl font-bold text-rose-300">Cuộc gọi đã bị từ chối</p>
                        <button onClick={() => setCallStatus('idle')} className="mt-4 rounded-full bg-white/10 px-5 py-2 text-sm font-semibold hover:bg-white/20">
                          Thử lại
                        </button>
                      </div>
                    )}

                    {callStatus === 'ended' && (
                      <div className="rounded-3xl border border-white/10 bg-white/5 px-8 py-6 backdrop-blur">
                        <p className="text-xl font-bold">Cuộc gọi đã kết thúc</p>
                        <button onClick={() => setCallStatus('idle')} className="mt-4 rounded-full bg-sky-500 px-5 py-2 text-sm font-semibold hover:bg-sky-600">
                          Gọi lại
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Local camera preview nhỏ góc phải */}
                  <div className="absolute bottom-5 right-5 h-32 w-48 overflow-hidden rounded-2xl border border-white/20 bg-black/50 shadow-lg">
                    <video ref={localVideoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
                    <div className="absolute left-2 top-2 rounded bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white">BẠN</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Vital Signs */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Nhịp tim</p>
                  <p className="mt-2 text-4xl font-black tracking-tight text-slate-950 tabular-nums">
                    {heartRate}<span className="ml-2 text-sm font-semibold text-slate-400">bpm</span>
                  </p>
                </div>
                <div className="grid h-16 w-16 place-items-center rounded-3xl bg-rose-50 text-rose-500">
                  <Heart className="h-7 w-7 fill-current" />
                </div>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-600">Chỉ số sinh tồn đang được mô phỏng theo thời gian thực để tạo cảm giác theo dõi y tế sống động hơn.</p>
            </div>
            <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">SpO2</p>
                  <p className="mt-2 text-4xl font-black tracking-tight text-slate-950">100<span className="ml-2 text-sm font-semibold text-slate-400">%</span></p>
                </div>
                <div className="grid h-16 w-16 place-items-center rounded-3xl bg-cyan-50 text-cyan-500">
                  <Zap className="h-7 w-7" />
                </div>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-600">Giao diện số liệu được làm thành những khối riêng để giảm rối mắt và tăng độ cao cấp cho màn hình.</p>
            </div>
          </div>
        </section>

        {/* Sidebar */}
        <aside className="space-y-6">
          {/* Doctor Info & Doctor Selector */}
          <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-sky-700">Bác sĩ tư vấn</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{doctor?.name ?? 'Đang tải...'}</h2>
                <p className="mt-1 text-sm text-slate-500">{doctor?.specialty ?? 'Chuyên khoa'}</p>
              </div>
              <div className="grid h-14 w-14 place-items-center rounded-3xl bg-slate-950 text-white">
                <Stethoscope className="h-6 w-6" />
              </div>
            </div>

            {/* Chọn bác sĩ khác */}
            {doctorsList.length > 1 && (
              <div className="mt-4">
                <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 mb-1">
                  Đổi bác sĩ tư vấn:
                </label>
                <select
                  value={selectedDoctorId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setSelectedDoctorId(id);
                    const found = doctorsList.find((d) => d.id === id);
                    if (found) setDoctor(found);
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-sky-500 focus:outline-none"
                >
                  {doctorsList.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.specialty})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="mt-5 grid gap-3 text-sm text-slate-600">
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="flex items-center gap-2 font-semibold text-slate-500">
                  <CalendarDays className="h-4 w-4 text-sky-600" />
                  Mã cuộc hẹn
                </span>
                <span className="font-bold text-slate-950">#{appointmentId}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="flex items-center gap-2 font-semibold text-slate-500">
                  <Activity className="h-4 w-4 text-emerald-600" />
                  Trạng thái
                </span>
                <span className={`font-bold ${isConnected ? 'text-emerald-600' : isCalling ? 'text-amber-600' : isBusy ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {isConnected ? 'Đang kết nối' : isCalling ? 'Đang gọi...' : isBusy ? 'Bác sĩ bận' : 'Sẵn sàng'}
                </span>
              </div>
            </div>
          </div>

          {/* Chat */}
          <div className="flex h-[500px] flex-col overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Chat</p>
                <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">Trao đổi trực tuyến</h3>
              </div>
              <div className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-sky-700">Real-time</div>
            </div>
            <div className="flex-1 overflow-y-auto bg-slate-50/60 p-4">
              {messages.length === 0 ? (
                <div className="mx-auto flex h-full max-w-[220px] flex-col items-center justify-center text-center">
                  <div className="grid h-14 w-14 place-items-center rounded-3xl bg-white text-sky-600 shadow-sm">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <h4 className="mt-4 text-sm font-bold text-slate-950">Chưa có tin nhắn</h4>
                  <p className="mt-2 text-xs leading-6 text-slate-500">Bắt đầu câu hỏi đầu tiên để phiên khám trông giống một workspace thực tế hơn.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex flex-col gap-1 ${msg.sender === 'patient' ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[85%] rounded-3xl px-4 py-3 text-sm font-medium shadow-sm ${msg.sender === 'patient' ? 'rounded-tr-md bg-gradient-to-r from-sky-600 to-cyan-600 text-white' : 'rounded-tl-md bg-slate-100 text-slate-800'}`}>
                        {msg.text}
                      </div>
                      <span className="mx-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{msg.time}</span>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              )}
            </div>
            <form onSubmit={handleSend} className="border-t border-slate-100 bg-white p-4">
              <div className="flex items-center gap-2 rounded-3xl border border-slate-200 bg-slate-50 px-3 py-2.5 focus-within:border-sky-300 focus-within:bg-white">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Nhập nội dung gửi bác sĩ..."
                  className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        </aside>
      </main>

      {/* 📅 MODAL ĐẶT LỊCH THEO KHUNG GIỜ */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-600">Đặt lịch trực tuyến</p>
                <h3 className="text-xl font-black text-slate-900">Chọn khung giờ khám bệnh</h3>
              </div>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="mt-5 space-y-4">
              {/* Dropdown Chọn Bác Sĩ */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-[0.18em] text-slate-500 mb-1.5">
                  Bác sĩ phụ trách tư vấn
                </label>
                <select
                  value={selectedDoctorId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setSelectedDoctorId(id);
                    const found = doctorsList.find((d) => d.id === id);
                    if (found) setDoctor(found);
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 focus:border-sky-500 focus:outline-none"
                >
                  {doctorsList.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.name} — {doc.specialty}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-[0.18em] text-slate-500 mb-1.5">
                  Ngày khám
                </label>
                <input
                  type="date"
                  value={scheduleDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 focus:border-sky-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-[0.18em] text-slate-500 mb-2">
                  Khung giờ tư vấn
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {TIME_SLOTS.map((slot, index) => (
                    <button
                      key={`${slot.start}-${slot.end}`}
                      type="button"
                      onClick={() => setSelectedSlotIndex(index)}
                      className={`rounded-2xl border py-3 text-xs font-bold transition ${
                        selectedSlotIndex === index
                          ? 'border-sky-600 bg-sky-600 text-white shadow-md'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {slot.start} - {slot.end}
                    </button>
                  ))}
                </div>
              </div>

              {bookingMessage && (
                <div
                  className={`rounded-2xl p-3.5 text-xs font-bold ${
                    bookingMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {bookingMessage.text}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="flex-1 rounded-full border border-slate-200 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={bookingLoading}
                  className="flex-1 rounded-full bg-sky-600 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-sky-700 disabled:opacity-50"
                >
                  {bookingLoading ? 'Đang kiểm tra...' : 'Xác nhận đặt lịch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🚨 MODAL KÍCH HOẠT BÁO ĐỘNG CẤP CỨU KHẨN CẤP SOS */}
      {showEmergencyModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-md">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border-2 border-rose-500 bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-rose-100 pb-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rose-600 text-2xl text-white">
                🆘
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-600">CẤP CỨU Y TẾ NGUY KỊCH</p>
                <h3 className="text-xl font-black text-slate-900">Gửi tín hiệu Báo động SOS khẩn cấp</h3>
              </div>
            </div>

            <form onSubmit={handleEmergencySubmit} className="mt-5 space-y-4">
              {/* Select Doctor for Emergency */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-[0.18em] text-slate-500 mb-1.5">
                  Bác sĩ ứng cứu chính
                </label>
                <select
                  value={selectedDoctorId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setSelectedDoctorId(id);
                    const found = doctorsList.find((d) => d.id === id);
                    if (found) setDoctor(found);
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 focus:border-rose-500 focus:outline-none"
                >
                  {doctorsList.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.name} — {doc.specialty}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-[0.18em] text-slate-500 mb-2">
                  Chọn tình huống khẩn cấp
                </label>
                <div className="space-y-2">
                  {EMERGENCY_TYPES.map((item) => (
                    <label
                      key={item.id}
                      onClick={() => setSelectedEmergencyType(item.id)}
                      className={`flex cursor-pointer flex-col rounded-2xl border p-3.5 transition ${
                        selectedEmergencyType === item.id
                          ? 'border-rose-500 bg-rose-50/70 shadow-sm'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-black text-slate-900">{item.label}</span>
                        <input
                          type="radio"
                          name="emergencyType"
                          checked={selectedEmergencyType === item.id}
                          onChange={() => setSelectedEmergencyType(item.id)}
                          className="h-4 w-4 text-rose-600"
                        />
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-600">{item.desc}</p>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-[0.18em] text-slate-500 mb-1">
                  Mô tả ngắn tình trạng hiện tại
                </label>
                <textarea
                  value={emergencyDetails}
                  onChange={(e) => setEmergencyDetails(e.target.value)}
                  placeholder="VD: Người bị đuối nước vừa vớt lên bờ lúc 5 phút trước, đang ngạt thở..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm focus:border-rose-500 focus:outline-none"
                  rows={2}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEmergencyModal(false)}
                  className="flex-1 rounded-full border border-slate-200 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-full bg-rose-600 py-3 text-sm font-black text-white shadow-lg shadow-rose-600/30 transition hover:bg-rose-700 active:scale-95"
                >
                  🚨 GỬI BÁO ĐỘNG SOS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Clinic;
