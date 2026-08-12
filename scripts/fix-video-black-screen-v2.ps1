$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$clinicPath = Join-Path $repoRoot 'telehealth-frontend\src\Clinic.tsx'

if (-not (Test-Path $clinicPath)) {
  throw "Clinic.tsx not found: $clinicPath"
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$text = [System.IO.File]::ReadAllText($clinicPath, [System.Text.Encoding]::UTF8)
# Normalize newlines so exact patches work on both Windows CRLF and Git LF.
$text = $text -replace "`r`n", "`n"

function Patch-Once {
  param(
    [string]$Source,
    [string]$Old,
    [string]$New,
    [string]$Label
  )

  if ($Source.Contains($New)) {
    Write-Host "[OK] $Label"
    return $Source
  }
  if (-not $Source.Contains($Old)) {
    throw "Patch target not found: $Label"
  }
  Write-Host "[FIX] $Label"
  $idx = $Source.IndexOf($Old)
  return $Source.Substring(0, $idx) + $New + $Source.Substring($idx + $Old.Length)
}

# 1. Stable refs for remote media + early ICE candidates.
$old = "  const localStreamRef = useRef<MediaStream | null>(null);`n  const pcRef = useRef<RTCPeerConnection | null>(null);"
$new = "  const localStreamRef = useRef<MediaStream | null>(null);`n  const remoteStreamRef = useRef<MediaStream | null>(null);`n  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);`n  const pcRef = useRef<RTCPeerConnection | null>(null);"
$text = Patch-Once $text $old $new 'stable stream refs'

# 2. Persist remote stream before React switches the video DOM branch.
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
$text = Patch-Once $text $old $new 'persist remote stream ontrack'

# 3. Mobile/WebRTC can briefly become disconnected while ICE recovers.
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
$text = Patch-Once $text $old $new 'do not end on transient disconnected'

# 4. Queue candidates that arrive before setRemoteDescription.
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
$text = Patch-Once $text $old $new 'queue early ICE candidates'

# 5. Flush queued ICE after doctor receives offer.
$old = "        await pc.setRemoteDescription(new RTCSessionDescription(offer));`n        const answer = await pc.createAnswer();"
$new = "        await pc.setRemoteDescription(new RTCSessionDescription(offer));`n        await flushPendingIceCandidates();`n        const answer = await pc.createAnswer();"
$text = Patch-Once $text $old $new 'flush ICE after offer'

# 6. Flush queued ICE after patient receives answer.
$old = "        await pcRef.current!.setRemoteDescription(new RTCSessionDescription(answer));"
$new = "        await pcRef.current!.setRemoteDescription(new RTCSessionDescription(answer));`n        await flushPendingIceCandidates();"
$text = Patch-Once $text $old $new 'flush ICE after answer'

# 7. Reattach local + remote streams to the NEW video nodes rendered by isConnected.
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
      const localVideo = localVideoRef.current;
      const remoteVideo = remoteVideoRef.current;
      const localStream = localStreamRef.current;
      const remoteStream = remoteStreamRef.current;

      if (localVideo && localStream) {
        if (localVideo.srcObject !== localStream) localVideo.srcObject = localStream;
        localVideo.play().catch(() => {});
      }

      if (remoteVideo && remoteStream) {
        if (remoteVideo.srcObject !== remoteStream) remoteVideo.srcObject = remoteStream;
        remoteVideo.play().catch(() => {});
      }
    };

    // isConnected swaps the entire <video> subtree, so refs point to new DOM nodes.
    const frame = requestAnimationFrame(attachStreams);
    const timer = window.setTimeout(attachStreams, 150);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [isConnected]);

  return (
'@
$text = Patch-Once $text $old $new 'reattach streams after connected render'

# 8. Recording should use the stable remote ref.
$old = "    const remoteStream = (window as any)._tempRemoteStream || remoteVideoRef.current?.srcObject;"
$new = "    const remoteStream = remoteStreamRef.current || (window as any)._tempRemoteStream || remoteVideoRef.current?.srcObject;"
$text = Patch-Once $text $old $new 'recording uses stable remote stream'

# 9. Clear refs/queue everywhere the call is ended.
$old = "      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;`n      delete (window as any)._tempRemoteStream;"
$new = "      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;`n      remoteStreamRef.current = null;`n      pendingIceCandidatesRef.current = [];`n      delete (window as any)._tempRemoteStream;"
$text = Patch-Once $text $old $new 'clear refs in socket call:end'

$old = "    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;`n    delete (window as any)._tempRemoteStream;"
$new = "    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;`n    remoteStreamRef.current = null;`n    pendingIceCandidatesRef.current = [];`n    delete (window as any)._tempRemoteStream;"
$text = Patch-Once $text $old $new 'clear refs in local endCall'

# Write back as UTF-8 without BOM, keeping LF (Git-friendly and avoids mojibake).
[System.IO.File]::WriteAllText($clinicPath, $text, $utf8NoBom)

Write-Host ''
Write-Host 'VIDEO PATCH APPLIED SUCCESSFULLY' -ForegroundColor Green
Write-Host 'Clinic.tsx kept as UTF-8; only WebRTC/video-stream logic was changed.' -ForegroundColor Green
Write-Host ''
Write-Host 'Next:' -ForegroundColor Cyan
Write-Host '  git diff -- telehealth-frontend/src/Clinic.tsx'
Write-Host '  docker restart telehealth-frontend-public'
