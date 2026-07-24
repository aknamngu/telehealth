import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { socket } from '../socket';
import { getAuthUser } from '../auth';

type CallStatus = 'idle' | 'calling' | 'incoming' | 'connected' | 'declined';

interface IncomingCallPayload {
  appointmentId: string;
  fromName: string;
  fromRole: string;
}

export default function Consultation() {
  const { appointmentId } = useParams();
  const authUser = getAuthUser();

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [incomingCall, setIncomingCall] = useState<IncomingCallPayload | null>(null);

  useEffect(() => {
    if (!appointmentId) return;

    socket.connect();
    socket.emit('joinRoom', appointmentId);

    const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    peerConnection.current = new RTCPeerConnection(config);

    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((mediaStream) => {
      localStreamRef.current = mediaStream;
      if (localVideoRef.current) localVideoRef.current.srcObject = mediaStream;
      mediaStream.getTracks().forEach((track) => peerConnection.current?.addTrack(track, mediaStream));
    });

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('candidate', { candidate: event.candidate, appointmentId });
      }
    };

    peerConnection.current.ontrack = (event) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
    };

    // --- Báo hiệu cuộc gọi ---
    socket.on('call:invite', (payload: IncomingCallPayload) => {
      setIncomingCall(payload);
      setCallStatus('incoming');
    });

    socket.on('call:accept', async () => {
      // Người GỌI nhận được xác nhận -> giờ mới thật sự tạo offer WebRTC
      const offer = await peerConnection.current?.createOffer();
      await peerConnection.current?.setLocalDescription(offer);
      socket.emit('offer', { offer, appointmentId });
      setCallStatus('connected');
    });

    socket.on('call:decline', () => {
      setCallStatus('declined');
    });

    // --- WebRTC signaling (giữ nguyên như cũ) ---
    socket.on('offer', async (offer) => {
      await peerConnection.current?.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.current?.createAnswer();
      await peerConnection.current?.setLocalDescription(answer);
      socket.emit('answer', { answer, appointmentId });
    });

    socket.on('answer', async (answer) => {
      await peerConnection.current?.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on('candidate', (candidate) => {
      peerConnection.current?.addIceCandidate(new RTCIceCandidate(candidate));
    });

    return () => {
      socket.off('call:invite');
      socket.off('call:accept');
      socket.off('call:decline');
      socket.off('offer');
      socket.off('answer');
      socket.off('candidate');
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      peerConnection.current?.close();
      socket.disconnect();
    };
  }, [appointmentId]);

  const handleStartCall = () => {
    setCallStatus('calling');
    socket.emit('call:invite', {
      appointmentId,
      fromName: authUser?.fullName ?? 'Người dùng',
      fromRole: authUser?.role ?? 'PATIENT',
    });
  };

  const handleAccept = () => {
    socket.emit('call:accept', { appointmentId });
    setCallStatus('connected');
    setIncomingCall(null);
  };

  const handleDecline = () => {
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