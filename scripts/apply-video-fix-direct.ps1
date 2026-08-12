$ErrorActionPreference = 'Stop'
$path = Join-Path (Split-Path -Parent $PSScriptRoot) 'telehealth-frontend\src\Clinic.tsx'
if (-not (Test-Path $path)) { throw "Clinic.tsx not found: $path" }
$text = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)

function Replace-Required([string]$old,[string]$new,[string]$label) {
  if ($script:text.Contains($new)) { Write-Host "[OK] $label"; return }
  if (-not $script:text.Contains($old)) { throw "Target not found: $label" }
  $script:text = $script:text.Replace($old,$new)
  Write-Host "[FIX] $label"
}

Replace-Required @'
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
'@ @'
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const pcRef = useRef<RTCPeerConnection | null>(null);
'@ 'stable stream refs'

Replace-Required @'
    pc.ontrack = (e) => {
      console.log('🎥 Remote track received!');
      if (remoteVideoRef.current && e.streams[0]) {
        remoteVideoRef.current.srcObject = e.streams[0];
      }
      setCallStatus('connected');
    };
'@ @'
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
'@ 'persist remote stream ontrack'

Replace-Required @'
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') setCallStatus('ended');
'@ @'
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') setCallStatus('ended');
'@ 'do not end on transient disconnected'

Replace-Required @'
    const handleCandidate = async (candidate: RTCIceCandidateInit) => {
      try {
        if (pcRef.current && candidate) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error('Lỗi add candidate:', err);
      }
    };
'@ @'
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
'@ 'queue early ICE candidates'

Replace-Required @'
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
'@ @'
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await flushPendingIceCandidates();
        const answer = await pc.createAnswer();
'@ 'flush ICE after offer'

Replace-Required @'
        await pcRef.current!.setRemoteDescription(new RTCSessionDescription(answer));
'@ @'
        await pcRef.current!.setRemoteDescription(new RTCSessionDescription(answer));
        await flushPendingIceCandidates();
'@ 'flush ICE after answer'

Replace-Required @'
  const isConnected = callStatus === 'connected';
  const isCalling = callStatus === 'calling';
  const isBusy = callStatus === 'busy';

  return (
'@ @'
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
    const frame = requestAnimationFrame(attachStreams);
    const timer = window.setTimeout(attachStreams, 150);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [isConnected]);

  return (
'@ 'reattach streams after connected render'

Replace-Required @'
    const remoteStream = (window as any)._tempRemoteStream || remoteVideoRef.current?.srcObject;
'@ @'
    const remoteStream = remoteStreamRef.current || (window as any)._tempRemoteStream || remoteVideoRef.current?.srcObject;
'@ 'recording uses stable remote stream'

$text = $text.Replace("      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;`n      delete (window as any)._tempRemoteStream;", "      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;`n      remoteStreamRef.current = null;`n      pendingIceCandidatesRef.current = [];`n      delete (window as any)._tempRemoteStream;")
$text = $text.Replace("    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;`n    delete (window as any)._tempRemoteStream;", "    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;`n    remoteStreamRef.current = null;`n    pendingIceCandidatesRef.current = [];`n    delete (window as any)._tempRemoteStream;")

[System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding($false)))
Write-Host 'VIDEO FIX APPLIED' -ForegroundColor Green
