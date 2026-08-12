$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$clinicPath = Join-Path $repoRoot 'telehealth-frontend\src\Clinic.tsx'

if (-not (Test-Path $clinicPath)) {
  throw "Không tìm thấy Clinic.tsx tại $clinicPath"
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$text = [System.IO.File]::ReadAllText($clinicPath, [System.Text.Encoding]::UTF8)

function Replace-Once {
  param(
    [string]$Source,
    [string]$Old,
    [string]$New,
    [string]$Label
  )

  if ($Source.Contains($New)) {
    Write-Host "[OK] $Label đã có sẵn"
    return $Source
  }

  if (-not $Source.Contains($Old)) {
    throw "Không tìm thấy đoạn cần sửa: $Label. Dừng để tránh sửa sai file."
  }

  Write-Host "[FIX] $Label"
  return $Source.Replace($Old, $New)
}

# 1) Giữ remote stream độc lập với DOM <video> hiện tại.
$old = @'
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
'@
$new = @'
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const pcRef = useRef<RTCPeerConnection | null>(null);
'@
$text = Replace-Once $text $old $new 'thêm remoteStreamRef + ICE queue'

# 2) Khi remote track tới, lưu stream vào ref trước khi React đổi nhánh render.
$old = @'
    pc.ontrack = (e) => {
      console.log('🎥 Remote track received!');
      if (remoteVideoRef.current && e.streams[0]) {
        remoteVideoRef.current.srcObject = e.streams[0];
      }
      setCallStatus('connected');
    };
'@
$new = @'
    pc.ontrack = (e) => {
      console.log('🎥 Remote track received!');
      const stream = e.streams[0];
      if (stream) {
        remoteStreamRef.current = stream;
        (window as any)._tempRemoteStream = stream;
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
          remoteVideoRef.current.play().catch(() => {});
        }
      }
      setCallStatus('connected');
    };
'@
$text = Replace-Once $text $old $new 'lưu remote stream khi ontrack'

# 3) Disconnected có thể chỉ là tạm thời trên mobile; chỉ kết thúc tự động khi failed/closed.
$old = @'
    pc.onconnectionstatechange = () => {
      console.log('🔗 Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') setCallStatus('connected');
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') setCallStatus('ended');
    };
'@
$new = @'
    pc.onconnectionstatechange = () => {
      console.log('🔗 Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') setCallStatus('connected');
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') setCallStatus('ended');
    };

    pc.oniceconnectionstatechange = () => {
      console.log('🧊 ICE connection state:', pc.iceConnectionState);
    };
'@
$text = Replace-Once $text $old $new 'không kết thúc call vì disconnected thoáng qua'

# 4) Candidate có thể tới trước remoteDescription. Queue lại thay vì add ngay và lỗi.
$old = @'
    const handleCandidate = async (candidate: RTCIceCandidateInit) => {
      try {
        if (pcRef.current && candidate) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error('Lỗi add candidate:', err);
      }
    };
'@
$new = @'
    const flushPendingIceCandidates = async () => {
      const pc = pcRef.current;
      if (!pc?.remoteDescription) return;
      const pending = pendingIceCandidatesRef.current.splice(0);
      for (const item of pending) {
        await pc.addIceCandidate(new RTCIceCandidate(item));
      }
    };

    const handleCandidate = async (candidate: RTCIceCandidateInit) => {
      try {
        const pc = pcRef.current;
        if (!pc || !candidate) return;
        if (!pc.remoteDescription) {
          pendingIceCandidatesRef.current.push(candidate);
          return;
        }
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('Lỗi add candidate:', err);
      }
    };
'@
$text = Replace-Once $text $old $new 'queue ICE candidate trước remoteDescription'

# 5) Flush candidate sau khi doctor nhận offer.
$old = @'
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
'@
$new = @'
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await flushPendingIceCandidates();
        const answer = await pc.createAnswer();
'@
$text = Replace-Once $text $old $new 'flush ICE sau offer'

# 6) Flush candidate sau khi patient nhận answer.
$old = @'
        await pcRef.current!.setRemoteDescription(new RTCSessionDescription(answer));
'@
$new = @'
        await pcRef.current!.setRemoteDescription(new RTCSessionDescription(answer));
        await flushPendingIceCandidates();
'@
$text = Replace-Once $text $old $new 'flush ICE sau answer'

# 7) React thay cả <video> khi isConnected đổi. Gắn lại stream vào node mới.
$old = @'
  const isConnected = callStatus === 'connected';
  const isCalling = callStatus === 'calling';
  const isBusy = callStatus === 'busy';

  return (
'@
$new = @'
  const isConnected = callStatus === 'connected';
  const isCalling = callStatus === 'calling';
  const isBusy = callStatus === 'busy';

  useEffect(() => {
    if (!isConnected) return;

    const attachStreams = () => {
      if (localVideoRef.current && localStreamRef.current) {
        if (localVideoRef.current.srcObject !== localStreamRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
        localVideoRef.current.play().catch(() => {});
      }

      if (remoteVideoRef.current && remoteStreamRef.current) {
        if (remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
          remoteVideoRef.current.srcObject = remoteStreamRef.current;
        }
        remoteVideoRef.current.play().catch(() => {});
      }
    };

    // Chạy sau render để refs đã trỏ vào 2 <video> mới của nhánh connected.
    const frame = requestAnimationFrame(attachStreams);
    const timer = window.setTimeout(attachStreams, 120);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [isConnected]);

  return (
'@
$text = Replace-Once $text $old $new 'gắn lại local/remote stream sau khi chuyển connected'

# 8) Recording dùng remote ref ổn định.
$old = @'
    const remoteStream = (window as any)._tempRemoteStream || remoteVideoRef.current?.srcObject;
'@
$new = @'
    const remoteStream = remoteStreamRef.current || (window as any)._tempRemoteStream || remoteVideoRef.current?.srcObject;
'@
$text = Replace-Once $text $old $new 'recording dùng remoteStreamRef'

# 9) Clear refs/queue khi nhận call:end.
$old = @'
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      delete (window as any)._tempRemoteStream;
'@
$new = @'
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      remoteStreamRef.current = null;
      pendingIceCandidatesRef.current = [];
      delete (window as any)._tempRemoteStream;
'@
$text = Replace-Once $text $old $new 'clear stream/ICE khi call:end'

# 10) endCall cũng clear refs/queue. Replace-Once ở trên thay occurrence đầu; xử lý occurrence còn lại nếu có.
$old2 = @'
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    delete (window as any)._tempRemoteStream;
'@
$new2 = @'
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    remoteStreamRef.current = null;
    pendingIceCandidatesRef.current = [];
    delete (window as any)._tempRemoteStream;
'@
if ($text.Contains($old2)) {
  Write-Host '[FIX] clear stream/ICE trong endCall'
  $text = $text.Replace($old2, $new2)
}

[System.IO.File]::WriteAllText($clinicPath, $text, $utf8NoBom)

Write-Host ''
Write-Host '✅ Đã sửa Clinic.tsx an toàn, giữ UTF-8 tiếng Việt.' -ForegroundColor Green
Write-Host '✅ Fix chính: camera/remote stream không bị mất khi UI chuyển sang connected.' -ForegroundColor Green
Write-Host '✅ Có thêm ICE queue để tránh candidate tới sớm gây lỗi.' -ForegroundColor Green
Write-Host ''
Write-Host 'Kiểm tra diff:' -ForegroundColor Cyan
Write-Host '  git diff -- telehealth-frontend/src/Clinic.tsx'
Write-Host ''
Write-Host 'Sau đó restart frontend:' -ForegroundColor Cyan
Write-Host '  docker restart telehealth-frontend-public'
