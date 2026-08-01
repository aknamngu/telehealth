import { useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { socket } from '../socket';
import { getAuthUser } from '../auth';

type CallStatus = 'idle' | 'calling' | 'incoming' | 'connected' | 'declined';

export default function Consultation() {
  const { appointmentId } = useParams();
  const location = useLocation();
  const authUser = getAuthUser();
  const autoAccept = location.state?.autoAccept as boolean | undefined;
  const doctorId = location.state?.doctorId as number | undefined;

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [incomingCall, setIncomingCall] = useState<{ appointmentId: string; fromName: string; fromRole: string } | null>(null);

  useEffect(() => {
    if (!appointmentId) return;

    socket.emit('joinRoom', appointmentId);
    if (authUser?.role === 'DOCTOR') {
      socket.emit('joinRoom', `doctor_${authUser.id}`);
    }

    const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    const pc = new RTCPeerConnection(config);
    peerConnection.current = pc;

    const setupLocalMedia = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = mediaStream;
        if (localVideoRef.current) localVideoRef.current.srcObject = mediaStream;
        mediaStream.getTracks().forEach((track) => pc.addTrack(track, mediaStream));

        if (authUser?.role === 'DOCTOR' && autoAccept) {
          setCallStatus('calling');
          socket.emit('call:accept', { appointmentId });
        }
      } catch (error) {
        console.error('Failed to initialize local media:', error);
      }
    };

    setupLocalMedia();

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('candidate', { candidate: event.candidate, appointmentId });
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
    };

    socket.on('call:invite', (payload: { appointmentId: string; fromName: string; fromRole: string }) => {
      setIncomingCall(payload);
      setCallStatus('incoming');
    });

    socket.on('call:accept', async () => {
      if (authUser?.role === 'PATIENT') {
        setCallStatus('calling');
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('offer', { offer, appointmentId });
      }
    });

    socket.on('call:decline', () => {
      setCallStatus('declined');
    });

    socket.on('offer', async (offer) => {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('answer', { answer, appointmentId });
      setCallStatus('connected');
    });

    socket.on('answer', async (answer) => {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      setCallStatus('connected');
    });

    socket.on('candidate', async (candidate) => {
      if (candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    return () => {
      socket.off('call:invite');
      socket.off('call:accept');
      socket.off('call:decline');
      socket.off('offer');
      socket.off('answer');
      socket.off('candidate');
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      pc.close();
      peerConnection.current = null;
    };
  }, [appointmentId, authUser?.id, authUser?.role, autoAccept]);

  const handleStartCall = () => {
    if (!appointmentId) return;

    setCallStatus('calling');
    socket.emit('call:invite', {
      appointmentId,
      doctorId,
      fromName: authUser?.fullName ?? 'Người dùng',
      fromRole: authUser?.role ?? 'PATIENT',
    });
  };

  const handleAccept = () => {
    if (!appointmentId || !incomingCall) return;

    socket.emit('call:accept', { appointmentId });
    setIncomingCall(null);
    setCallStatus('connected');
  };

  const handleDecline = () => {
    if (!appointmentId) return;

    socket.emit('call:decline', { appointmentId });
    setCallStatus('idle');
    setIncomingCall(null);
  };

  return (
    <div className="p-10">
      <h1 className="mb-4 text-xl font-bold">Phòng khám - Mã cuộc hẹn: {appointmentId}</h1>

      <div className="flex gap-4">
        <video ref={localVideoRef} autoPlay muted className="w-1/2 rounded-lg border bg-black" />
        <video ref={remoteVideoRef} autoPlay className="w-1/2 rounded-lg border bg-black" />
      </div>

      {callStatus === 'idle' && (
        <button onClick={handleStartCall} className="mt-5 rounded bg-sky-600 px-6 py-2 text-white">
          Bắt đầu gọi
        </button>
      )}

      {callStatus === 'calling' && (
        <p className="mt-5 font-semibold text-sky-700">Đang gọi... chờ đối phương chấp nhận</p>
      )}

      {callStatus === 'declined' && (
        <p className="mt-5 font-semibold text-rose-600">Cuộc gọi đã bị từ chối.</p>
      )}

      {callStatus === 'connected' && (
        <p className="mt-5 font-semibold text-emerald-600">Đã kết nối cuộc gọi.</p>
      )}

      {/* Popup có cuộc gọi đến */}
      {callStatus === 'incoming' && incomingCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-80 rounded-2xl bg-white p-6 text-center shadow-2xl">
            <p className="text-lg font-bold">Cuộc gọi đến</p>
            <p className="mt-2 text-slate-600">
              {incomingCall.fromName} ({incomingCall.fromRole}) đang gọi cho bạn
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <button onClick={handleAccept} className="rounded-full bg-emerald-600 px-5 py-2 font-bold text-white">
                Chấp nhận
              </button>
              <button onClick={handleDecline} className="rounded-full bg-rose-600 px-5 py-2 font-bold text-white">
                Từ chối
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}