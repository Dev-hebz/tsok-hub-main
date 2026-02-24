'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import {
  collection, addDoc, query, orderBy, onSnapshot, where,
  doc, getDoc, getDocs, serverTimestamp, updateDoc, deleteDoc,
  setDoc, arrayUnion, arrayRemove, limit
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/AuthContext';
import { useOnlineStatuses, formatLastSeen } from '../../lib/useOnlineStatus';
import { sendNotification } from '../../lib/sendNotification';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';

// ─── Helpers ─────────────────────────────────────────────────────
const getChatId = (uid1, uid2) => [uid1, uid2].sort().join('_');

const formatTimeFull = (ts) => {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
};

const Avatar = ({ user, size = 10, isOnline = false, showStatus = false }) => {
  const px = size * 4;
  const initials = user?.fullName
    ? user.fullName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';
  const dotSize = Math.max(8, px * 0.28);
  const avatar = user?.profilePic ? (
    <img src={user.profilePic} alt={user.fullName}
      style={{ width: px, height: px, minWidth: px, minHeight: px }}
      className="rounded-full object-cover border-2 border-yellow-400 flex-shrink-0" />
  ) : (
    <div style={{ width: px, height: px, minWidth: px, minHeight: px, fontSize: Math.max(10, px * 0.3) }}
      className="rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-blue-900 font-bold border-2 border-yellow-400 flex-shrink-0">
      {initials}
    </div>
  );

  if (!showStatus) return avatar;
  return (
    <div className="relative flex-shrink-0" style={{ width: px, height: px }}>
      {avatar}
      <span style={{ width: dotSize, height: dotSize, bottom: 0, right: 0, border: '2px solid #1e3a5f' }}
        className={`absolute rounded-full ${isOnline ? 'bg-green-400' : 'bg-gray-500'}`} />
    </div>
  );
};

// ─── WebRTC Video Call ────────────────────────────────────────────
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

// ─── Video Filters ────────────────────────────────────────────────
const VIDEO_FILTERS = [
  { id: 'normal',  label: 'Normal',  icon: '🎥' },
  { id: 'beauty',  label: 'Beauty',  icon: '✨' },
  { id: 'smooth',  label: 'Smooth',  icon: '🌸' },
  { id: 'warm',    label: 'Warm',    icon: '🌅' },
  { id: 'cool',    label: 'Cool',    icon: '❄️' },
  { id: 'vivid',   label: 'Vivid',   icon: '🌈' },
  { id: 'soft',    label: 'Soft',    icon: '🌙' },
  { id: 'bw',      label: 'B&W',     icon: '⬛' },
  { id: 'vintage', label: 'Vintage', icon: '📷' },
  { id: 'bright',  label: 'Bright',  icon: '☀️' },
];

// Safari-compatible pixel-level filter application
const applyPixelFilter = (ctx, filterId, width, height) => {
  if (filterId === 'normal') return;
  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i], g = d[i+1], b = d[i+2];
      if (filterId === 'beauty') {
        // Brightness up, contrast slight down (smooth skin)
        r = Math.min(255, r * 1.08 * 0.92 + 255 * (1 - 0.92) / 2);
        g = Math.min(255, g * 1.08 * 0.92 + 255 * (1 - 0.92) / 2);
        b = Math.min(255, b * 1.08 * 0.92 + 255 * (1 - 0.92) / 2);
        // Slight saturation boost
        const avg = (r + g + b) / 3;
        r = Math.min(255, avg + (r - avg) * 1.1);
        g = Math.min(255, avg + (g - avg) * 1.1);
        b = Math.min(255, avg + (b - avg) * 1.1);
      } else if (filterId === 'smooth') {
        r = Math.min(255, r * 1.12 * 0.88 + 255 * (1 - 0.88) / 2);
        g = Math.min(255, g * 1.12 * 0.88 + 255 * (1 - 0.88) / 2);
        b = Math.min(255, b * 1.12 * 0.88 + 255 * (1 - 0.88) / 2);
        const avg = (r + g + b) / 3;
        r = Math.min(255, avg + (r - avg) * 0.95);
        g = Math.min(255, avg + (g - avg) * 0.95);
        b = Math.min(255, avg + (b - avg) * 0.95);
      } else if (filterId === 'warm') {
        r = Math.min(255, r * 1.15); // boost red
        g = Math.min(255, g * 1.05);
        b = Math.max(0,   b * 0.88); // reduce blue
      } else if (filterId === 'cool') {
        r = Math.max(0,   r * 0.88); // reduce red
        g = Math.min(255, g * 1.02);
        b = Math.min(255, b * 1.15); // boost blue
      } else if (filterId === 'vivid') {
        r = Math.min(255, r * 1.05);
        g = Math.min(255, g * 1.05);
        b = Math.min(255, b * 1.05);
        const avg = (r + g + b) / 3;
        r = Math.min(255, avg + (r - avg) * 1.5);
        g = Math.min(255, avg + (g - avg) * 1.5);
        b = Math.min(255, avg + (b - avg) * 1.5);
        r = Math.min(255, (r - 128) * 1.15 + 128);
        g = Math.min(255, (g - 128) * 1.15 + 128);
        b = Math.min(255, (b - 128) * 1.15 + 128);
      } else if (filterId === 'soft') {
        r = Math.min(255, (r - 128) * 0.85 + 128) * 0.95;
        g = Math.min(255, (g - 128) * 0.85 + 128) * 0.95;
        b = Math.min(255, (b - 128) * 0.85 + 128) * 0.95;
        const avg = (r + g + b) / 3;
        r = Math.min(255, avg + (r - avg) * 0.9);
        g = Math.min(255, avg + (g - avg) * 0.9);
        b = Math.min(255, avg + (b - avg) * 0.9);
      } else if (filterId === 'bw') {
        const gray = r * 0.299 + g * 0.587 + b * 0.114;
        const c = Math.min(255, (gray - 128) * 1.1 + 128);
        r = g = b = c;
      } else if (filterId === 'vintage') {
        // Sepia 50%
        const sr = r * 0.393 + g * 0.769 + b * 0.189;
        const sg = r * 0.349 + g * 0.686 + b * 0.168;
        const sb = r * 0.272 + g * 0.534 + b * 0.131;
        r = Math.min(255, r * 0.5 + sr * 0.5) * 0.9;
        g = Math.min(255, g * 0.5 + sg * 0.5) * 0.9;
        b = Math.min(255, b * 0.5 + sb * 0.5) * 0.9;
        const avg = (r + g + b) / 3;
        r = Math.min(255, avg + (r - avg) * 0.8);
        g = Math.min(255, avg + (g - avg) * 0.8);
        b = Math.min(255, avg + (b - avg) * 0.8);
      } else if (filterId === 'bright') {
        r = Math.min(255, r * 1.25);
        g = Math.min(255, g * 1.25);
        b = Math.min(255, b * 1.25);
        r = Math.min(255, (r - 128) * 1.05 + 128);
        g = Math.min(255, (g - 128) * 1.05 + 128);
        b = Math.min(255, (b - 128) * 1.05 + 128);
        const avg = (r + g + b) / 3;
        r = Math.min(255, avg + (r - avg) * 1.1);
        g = Math.min(255, avg + (g - avg) * 1.1);
        b = Math.min(255, avg + (b - avg) * 1.1);
      }
      d[i] = Math.max(0, Math.min(255, r));
      d[i+1] = Math.max(0, Math.min(255, g));
      d[i+2] = Math.max(0, Math.min(255, b));
    }
    ctx.putImageData(imageData, 0, 0);
  } catch (e) { /* cross-origin guard */ }
};

// Proper Safari ctx.filter detection — test actual pixel rendering
let _ctxFilterSupported = null;
const ctxFilterSupported = () => {
  if (_ctxFilterSupported !== null) return _ctxFilterSupported;
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 2;
    const ctx = c.getContext('2d');
    // Draw white pixel
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 2, 2);
    // Apply brightness 0 (should make it black)
    ctx.filter = 'brightness(0)';
    ctx.drawImage(c, 0, 0);
    const pixel = ctx.getImageData(0, 0, 1, 1).data;
    // If filter worked, pixel should be dark (< 50)
    _ctxFilterSupported = pixel[0] < 50;
  } catch { _ctxFilterSupported = false; }
  return _ctxFilterSupported;
};

const VideoCallModal = ({ callDoc, isCaller, currentUser, otherUser, onClose }) => {
  const localVideoRef = useRef(null);   // shows raw camera (hidden)
  const canvasRef = useRef(null);       // filtered canvas (hidden, streams to WebRTC)
  const previewRef = useRef(null);      // PIP preview (shows canvas output)
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);  // raw camera stream
  const canvasStreamRef = useRef(null); // filtered canvas stream sent via WebRTC
  const animFrameRef = useRef(null);    // requestAnimationFrame id
  const activeFilterRef = useRef('normal'); // ref so RAF loop gets latest value
  const facingModeRef = useRef('user'); // tracks current facing mode reliably

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [flipping, setFlipping] = useState(false);
  const [callStatus, setCallStatus] = useState(isCaller ? 'calling' : 'connecting');
  const [callDuration, setCallDuration] = useState(0);
  const [activeFilter, setActiveFilter] = useState('normal');
  const [showFilters, setShowFilters] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    initCall();
    return () => {
      document.body.style.overflow = '';
      cleanup();
    };
  }, []);

  // Sync filter ref so canvas loop always has latest value
  useEffect(() => {
    activeFilterRef.current = activeFilter;
  }, [activeFilter]);

  useEffect(() => {
    if (callStatus === 'connected') {
      timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [callStatus]);

  const formatDuration = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  // Canvas render loop — Safari-compatible pixel filter
  const startCanvasLoop = (videoEl, canvas) => {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let dimsSet = false;
    const draw = () => {
      if (videoEl.readyState >= 2) {
        if (!dimsSet && videoEl.videoWidth > 0) {
          canvas.width = videoEl.videoWidth;
          canvas.height = videoEl.videoHeight;
          dimsSet = true;
        }
        if (dimsSet) {
          const filterId = activeFilterRef.current;
          // Only mirror front camera — use stable ref, not per-frame track lookup
          const shouldMirror = facingModeRef.current !== 'environment';

          ctx.filter = 'none';
          ctx.save();
          if (shouldMirror) {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
          }
          ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
          ctx.restore();
          // Step 2: Apply filter
          if (filterId !== 'normal') {
            if (ctxFilterSupported()) {
              // Chrome/Firefox — fast CSS filter via ctx
              const cssMap = {
                beauty:  'brightness(1.08) contrast(0.92) saturate(1.1)',
                smooth:  'brightness(1.12) contrast(0.88) saturate(0.95)',
                warm:    'brightness(1.05) saturate(1.3) sepia(0.15) hue-rotate(-10deg)',
                cool:    'brightness(1.02) saturate(0.9) hue-rotate(15deg)',
                vivid:   'brightness(1.05) contrast(1.15) saturate(1.5)',
                soft:    'brightness(0.95) contrast(0.85) saturate(0.9)',
                bw:      'grayscale(1) contrast(1.1)',
                vintage: 'sepia(0.5) contrast(0.9) brightness(0.95) saturate(0.8)',
                bright:  'brightness(1.25) contrast(1.05) saturate(1.1)',
              };
              const tmpCanvas = document.createElement('canvas');
              tmpCanvas.width = canvas.width;
              tmpCanvas.height = canvas.height;
              const tmpCtx = tmpCanvas.getContext('2d');
              tmpCtx.filter = cssMap[filterId] || 'none';
              tmpCtx.drawImage(canvas, 0, 0);
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(tmpCanvas, 0, 0);
            } else {
              // Safari — pixel-level manipulation
              applyPixelFilter(ctx, filterId, canvas.width, canvas.height);
            }
          }
        }
      }
      animFrameRef.current = requestAnimationFrame(draw);
    };
    draw();
  };

  const cleanup = () => {
    cancelAnimationFrame(animFrameRef.current);
    clearInterval(timerRef.current);
    if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
    if (canvasStreamRef.current) canvasStreamRef.current.getTracks().forEach(t => t.stop());
    if (pcRef.current) pcRef.current.close();
    updateDoc(callDoc, { status: 'ended' }).catch(() => {});
  };

  const initCall = async () => {
    try {
      // 1. Get raw camera + mic stream — fallback for Android devices that reject resolution constraints
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
      } catch {
        // Fallback: minimal constraints — works on Motorola and older Android
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      }
      // Tag initial facing mode for flip tracking
      const vt = stream.getVideoTracks()[0];
      if (vt) {
        const detected = vt.getSettings?.()?.facingMode || 'user';
        vt._facingMode = detected;
        facingModeRef.current = detected;
      }
      localStreamRef.current = stream;

      // 2. Attach raw stream to hidden video element
      const videoEl = localVideoRef.current;
      videoEl.srcObject = stream;
      await videoEl.play().catch(() => {});

      // 3. Start canvas render loop
      const canvas = canvasRef.current;
      startCanvasLoop(videoEl, canvas);

      // 4. Capture canvas as stream (30fps) — fallback to original stream on iOS
      let canvasStream;
      const audioTrack = stream.getAudioTracks()[0];
      if (typeof canvas.captureStream === 'function') {
        canvasStream = canvas.captureStream(30);
        canvasStreamRef.current = canvasStream;
        // 5. Add audio track
        if (audioTrack) canvasStream.addTrack(audioTrack);
      } else {
        // iOS Safari doesn't support captureStream — use original stream directly
        // Filters will be display-only on iOS (PIP preview still shows them)
        canvasStream = stream;
        canvasStreamRef.current = null;
      }

      // 6. Show preview using canvas stream
      if (previewRef.current) {
        previewRef.current.srcObject = canvasStream;
      }

      // 7. Setup WebRTC with canvas stream (filtered video goes to other side)
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;
      canvasStream.getTracks().forEach(t => pc.addTrack(t, canvasStream));

      pc.ontrack = (e) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
        setCallStatus('connected');
      };

      pc.onicecandidate = async (e) => {
        if (!e.candidate) return;
        const field = isCaller ? 'callerCandidates' : 'calleeCandidates';
        await updateDoc(callDoc, { [field]: arrayUnion(e.candidate.toJSON()) });
      };

      if (isCaller) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await updateDoc(callDoc, { offer: { type: offer.type, sdp: offer.sdp }, status: 'calling' });
        const unsub = onSnapshot(callDoc, async snap => {
          const data = snap.data();
          if (!data) return;
          if (data.status === 'ended') { unsub(); onClose(); return; }
          if (data.answer && !pc.currentRemoteDescription) {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          }
          (data.calleeCandidates || []).forEach(c => {
            if (!pc._addedCandidates?.includes(JSON.stringify(c))) {
              pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
              pc._addedCandidates = [...(pc._addedCandidates || []), JSON.stringify(c)];
            }
          });
        });
      } else {
        const snap = await getDoc(callDoc);
        const data = snap.data();
        if (data?.offer) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await updateDoc(callDoc, { answer: { type: answer.type, sdp: answer.sdp }, status: 'answered' });
        }
        const unsub = onSnapshot(callDoc, async snap => {
          const data = snap.data();
          if (!data) return;
          if (data.status === 'ended') { unsub(); onClose(); return; }
          (data.callerCandidates || []).forEach(c => {
            if (!pc._addedCandidates?.includes(JSON.stringify(c))) {
              pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
              pc._addedCandidates = [...(pc._addedCandidates || []), JSON.stringify(c)];
            }
          });
        });
      }
    } catch (err) {
      console.error('Call error:', err);
      setCallStatus('error');
    }
  };

  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setMicOn(track.enabled); }
  };

  const toggleCam = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const newEnabled = !track.enabled;
    track.enabled = newEnabled;
    setCamOn(newEnabled);

    if (newEnabled) {
      // Camera ON — restart canvas loop with live video
      cancelAnimationFrame(animFrameRef.current);
      if (localVideoRef.current && canvasRef.current) {
        startCanvasLoop(localVideoRef.current, canvasRef.current);
      }
    } else {
      // Camera OFF — stop live loop, run a black-frame loop so remote side sees black
      cancelAnimationFrame(animFrameRef.current);
      const canvas = canvasRef.current;
      if (canvas && canvas.width > 0) {
        const ctx = canvas.getContext('2d');
        const drawBlack = () => {
          // Only keep drawing black while cam is off
          if (!localStreamRef.current?.getVideoTracks()[0]?.enabled) {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            animFrameRef.current = requestAnimationFrame(drawBlack);
          }
        };
        drawBlack();
      }
    }
  };

  const handleFlipCamera = async () => {
    if (!localStreamRef.current || flipping) return;
    const currentVideoTrack = localStreamRef.current.getVideoTracks()[0];
    if (!currentVideoTrack) return;
    setFlipping(true);

    const currentFacing = facingModeRef.current;
    const newFacing = currentFacing === 'user' ? 'environment' : 'user';

    try {
      // Stop canvas loop before switching
      cancelAnimationFrame(animFrameRef.current);

      // Get new camera stream
      let newStream;
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: newFacing } },
          audio: false,
        });
      } catch {
        try {
          newStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: newFacing },
            audio: false,
          });
        } catch {
          newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
      }

      const newVideoTrack = newStream.getVideoTracks()[0];

      // Detect actual facing from settings, fallback to requested
      const detectedFacing = newVideoTrack.getSettings?.()?.facingMode || newFacing;
      facingModeRef.current = detectedFacing;
      newVideoTrack._facingMode = detectedFacing;

      // Swap in localStream
      currentVideoTrack.stop();
      localStreamRef.current.removeTrack(currentVideoTrack);
      localStreamRef.current.addTrack(newVideoTrack);

      // Reset hidden video — Android needs srcObject = null first
      const videoEl = localVideoRef.current;
      if (videoEl) {
        videoEl.pause();
        videoEl.srcObject = null;
        await new Promise(r => setTimeout(r, 150)); // Android needs this gap

        videoEl.srcObject = localStreamRef.current;

        // Wait for actual frames — use both events + fallback timeout
        await new Promise((resolve) => {
          let done = false;
          const finish = () => { if (done) return; done = true; resolve(); };
          videoEl.addEventListener('canplay', finish, { once: true });
          videoEl.addEventListener('loadeddata', finish, { once: true });
          setTimeout(finish, 3000);
        });

        await videoEl.play().catch(() => {});
        await new Promise(r => setTimeout(r, 300));
      }

      // Reset canvas size so new camera resolution is picked up
      if (canvasRef.current) {
        canvasRef.current.width = 0;
        canvasRef.current.height = 0;
      }

      // Restart canvas loop — this is all that's needed for canvas path
      // The canvasStream track is the same object, WebRTC auto-gets new frames
      if (canvasRef.current && videoEl) {
        startCanvasLoop(videoEl, canvasRef.current);
        await new Promise(r => setTimeout(r, 500));
      }

      // Only replaceTrack on iOS (non-canvas path) since canvasStream is unchanged
      if (pcRef.current && !canvasStreamRef.current) {
        const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
        if (sender) await sender.replaceTrack(newVideoTrack);
      }

    } catch (e) {
      console.error('Flip cam error:', e);
    } finally {
      setFlipping(false);
    }
  };

  const handleEnd = () => { cleanup(); onClose(); };

  const currentFilter = VIDEO_FILTERS.find(f => f.id === activeFilter);

  return (
    <div className="fixed inset-0 z-[300] bg-gray-950 flex flex-col">
      {/* Hidden raw video + canvas (off-screen processing) */}
      <video ref={localVideoRef} autoPlay playsInline muted
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />
      <canvas ref={canvasRef}
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-blue-900/60 backdrop-blur flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${callStatus === 'connected' ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'}`}></span>
          <span className="text-white text-sm font-semibold">
            {callStatus === 'calling' ? `Calling ${otherUser?.fullName?.split(' ')[0]}...` :
             callStatus === 'connecting' ? 'Connecting...' :
             callStatus === 'connected' ? formatDuration(callDuration) :
             callStatus === 'error' ? 'Camera/mic error' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {activeFilter !== 'normal' && (
            <span className="text-yellow-400 text-xs font-semibold bg-yellow-400/20 px-2 py-0.5 rounded-full">
              {currentFilter?.icon} {currentFilter?.label}
            </span>
          )}
          <span className="text-blue-300 text-xs">TSOK Hub</span>
        </div>
      </div>

      {/* Videos */}
      <div className="flex-1 relative bg-gray-950 overflow-hidden">
        {/* Remote video — full screen */}
        <video ref={remoteVideoRef} autoPlay playsInline
          className="w-full h-full object-cover" />

        {callStatus !== 'connected' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Avatar user={otherUser} size={24} />
            <p className="text-white mt-4 font-semibold">{otherUser?.fullName}</p>
            <p className="text-blue-300 text-sm mt-1 animate-pulse">
              {callStatus === 'calling' ? 'Ringing...' : 'Connecting...'}
            </p>
          </div>
        )}

        {/* Local PIP — shows filtered canvas stream preview */}
        <div className="absolute bottom-4 right-4 w-28 h-36 sm:w-36 sm:h-48 rounded-2xl overflow-hidden border-2 border-yellow-400 shadow-2xl bg-gray-800">
          {/* Always keep video mounted — unmounting loses srcObject on cam re-enable */}
          <video ref={previewRef} autoPlay playsInline muted
            className={`w-full h-full object-cover ${camOn ? '' : 'hidden'}`}
            style={{ filter: { beauty:'brightness(1.08) contrast(0.92) saturate(1.1)', smooth:'brightness(1.12) contrast(0.88)', warm:'sepia(0.2) saturate(1.3) brightness(1.05)', cool:'hue-rotate(15deg) saturate(0.9)', vivid:'contrast(1.15) saturate(1.5)', soft:'brightness(0.95) contrast(0.85)', bw:'grayscale(1)', vintage:'sepia(0.5) contrast(0.9)', bright:'brightness(1.25)' }[activeFilter] || 'none' }} />
          {!camOn && (
            <div className="w-full h-full flex items-center justify-center bg-gray-800">
              <Avatar user={currentUser} size={10} />
            </div>
          )}
          {activeFilter !== 'normal' && camOn && (
            <div className="absolute bottom-1 left-1 text-xs bg-black/70 rounded-full px-1.5 py-0.5 text-white">
              {currentFilter?.icon}
            </div>
          )}
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="absolute bottom-0 left-0 right-0 bg-gray-900/97 backdrop-blur-lg border-t border-white/10 pb-2 z-50">
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <p className="text-white text-sm font-semibold">✨ Filters & Beauty</p>
              <button onClick={() => setShowFilters(false)} className="text-yellow-400 text-xs font-semibold">Done</button>
            </div>
            <div className="flex gap-2 px-3 overflow-x-auto pb-1">
              {VIDEO_FILTERS.map(filter => (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  className={`flex-shrink-0 flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
                    activeFilter === filter.id
                      ? 'bg-yellow-400/30 border-2 border-yellow-400'
                      : 'bg-white/10 border-2 border-transparent hover:bg-white/20'
                  }`}
                  style={{ minWidth: 64 }}
                >
                  <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center text-xl relative"
                    style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', filter: { beauty:'brightness(1.08) contrast(0.92) saturate(1.1)', smooth:'brightness(1.12) contrast(0.88)', warm:'sepia(0.2) saturate(1.3)', cool:'hue-rotate(15deg) saturate(0.9)', vivid:'contrast(1.15) saturate(1.5)', soft:'brightness(0.95) contrast(0.85)', bw:'grayscale(1)', vintage:'sepia(0.5) contrast(0.9)', bright:'brightness(1.25)' }[filter.id] || 'none' }}>
                    <span>{filter.icon}</span>
                  </div>
                  <span className={`text-xs font-medium ${activeFilter === filter.id ? 'text-yellow-400' : 'text-blue-200'}`}>
                    {filter.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="relative z-40 flex items-center justify-center gap-3 py-5 bg-gray-900 flex-shrink-0 px-2 overflow-x-auto">
        {/* Mic */}
        <button onClick={toggleMic}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${micOn ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-red-500 text-white'}`}>
          {micOn ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"/>
            </svg>
          )}
        </button>

        {/* Filter button */}
        <button onClick={() => setShowFilters(p => !p)}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all text-lg ${
            showFilters || activeFilter !== 'normal'
              ? 'bg-yellow-400/40 border-2 border-yellow-400 text-yellow-300'
              : 'bg-white/20 hover:bg-white/30 text-white'
          }`}>
          ✨
        </button>

        {/* End call */}
        <button onClick={handleEnd}
          className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all shadow-xl">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z"/>
          </svg>
        </button>

        {/* Camera toggle */}
        <button onClick={toggleCam}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${camOn ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-red-500 text-white'}`}>
          {camOn ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
            </svg>
          )}
        </button>

        {/* Flip camera */}
        <button
          type="button"
          onClick={handleFlipCamera}
          disabled={flipping}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${flipping ? 'bg-yellow-400/40 text-yellow-300' : 'bg-white/20 hover:bg-white/30 text-white'}`}
        >
          {flipping ? (
            <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};


// ─── Create Group Modal ───────────────────────────────────────────
const CreateGroupModal = ({ friends, currentUser, onClose, onCreate }) => {
  const [groupName, setGroupName] = useState('');
  const [selected, setSelected] = useState([]);
  const [creating, setCreating] = useState(false);

  const toggle = (uid) => setSelected(s => s.includes(uid) ? s.filter(x => x !== uid) : [...s, uid]);

  const handleCreate = async () => {
    if (!groupName.trim() || selected.length < 1) return;
    setCreating(true);
    try {
      const members = [currentUser.uid, ...selected];
      const groupRef = await addDoc(collection(db, 'groups'), {
        name: groupName.trim(),
        members,
        createdBy: currentUser.uid,
        createdAt: serverTimestamp(),
        lastMessage: null,
        lastMessageAt: serverTimestamp(),
      });
      onCreate({ id: groupRef.id, name: groupName.trim(), members, createdBy: currentUser.uid });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-blue-900/95 border border-white/20 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="text-white font-bold">Create Group Chat</h2>
          <button onClick={onClose} className="text-blue-300 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Group name */}
          <div>
            <label className="text-blue-200 text-xs font-semibold block mb-1.5">GROUP NAME</label>
            <input value={groupName} onChange={e => setGroupName(e.target.value)}
              placeholder="e.g. TSOK Officers 2026"
              className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-blue-300 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
          </div>

          {/* Select members */}
          <div>
            <label className="text-blue-200 text-xs font-semibold block mb-1.5">
              ADD MEMBERS ({selected.length} selected)
            </label>
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {friends.map(f => (
                <button key={f.uid} onClick={() => toggle(f.uid)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-left ${
                    selected.includes(f.uid) ? 'bg-yellow-400/20 border border-yellow-400/40' : 'bg-white/5 hover:bg-white/10 border border-transparent'
                  }`}>
                  <Avatar user={f} size={8} />
                  <span className="text-white text-sm flex-1 truncate">{f.fullName}</span>
                  {selected.includes(f.uid) && (
                    <span className="w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-blue-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
                      </svg>
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleCreate} disabled={!groupName.trim() || selected.length < 1 || creating}
            className="w-full py-3 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 text-blue-900 font-bold rounded-xl transition-all text-sm">
            {creating ? 'Creating...' : `Create Group (${selected.length + 1} members)`}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Message Bubble ───────────────────────────────────────────────
const EMOJI_REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];

const MessageBubble = ({ msg, isMe, showAvatar, isConsecutive, senderProfile, chatId, isGroup, currentUserId }) => {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(msg.text);
  const [saving, setSaving] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const editRef = useRef(null);

  useEffect(() => {
    if (editing) { editRef.current?.focus(); editRef.current?.select(); }
  }, [editing]);

  // Aggregate reactions: { '❤️': ['uid1','uid2'], ... }
  const reactions = msg.reactions || {};
  const reactionSummary = Object.entries(reactions).filter(([, uids]) => uids.length > 0);

  const handleReact = async (emoji) => {
    setShowEmojiPicker(false);
    try {
      const uids = reactions[emoji] || [];
      const alreadyReacted = uids.includes(currentUserId);
      const newUids = alreadyReacted ? uids.filter(u => u !== currentUserId) : [...uids, currentUserId];
      const updateData = { [`reactions.${emoji}`]: newUids };
      if (chatId.startsWith('groups/')) {
        const parts = chatId.split('/');
        await updateDoc(doc(db, 'groups', parts[1], 'messages', msg.id), updateData);
      } else {
        await updateDoc(doc(db, 'chats', chatId, 'messages', msg.id), updateData);
      }
    } catch (err) { console.error(err); }
  };

  const handleSaveEdit = async () => {
    const trimmed = editText.trim();
    if (!trimmed || trimmed === msg.text) { setEditing(false); setEditText(msg.text); return; }
    setSaving(true);
    try {
      if (chatId.startsWith('groups/')) {
        const parts = chatId.split('/');
        await updateDoc(doc(db, 'groups', parts[1], 'messages', msg.id), { text: trimmed, edited: true });
      } else {
        await updateDoc(doc(db, 'chats', chatId, 'messages', msg.id), { text: trimmed, edited: true });
      }
      setEditing(false);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      if (chatId.startsWith('groups/')) {
        const parts = chatId.split('/');
        await deleteDoc(doc(db, 'groups', parts[1], 'messages', msg.id));
      } else {
        await deleteDoc(doc(db, 'chats', chatId, 'messages', msg.id));
      }
    } catch (err) { console.error(err); }
  };

  return (
    <div className={`flex items-end gap-1.5 ${isMe ? 'flex-row-reverse' : 'flex-row'} ${isConsecutive ? 'mt-0.5' : 'mt-3'}`}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => { setHovered(false); setShowEmojiPicker(false); }}>

      {/* Avatar */}
      {!isMe && (
        <div style={{ width: 28, height: 28, minWidth: 28 }} className="flex-shrink-0 mb-5">
          {showAvatar && <Avatar user={senderProfile} size={7} />}
        </div>
      )}

      <div className={`flex items-end gap-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Action icons — react, edit, delete */}
        {!editing && (
          <div className={`flex flex-col gap-0.5 mb-5 transition-opacity duration-150 ${hovered ? 'opacity-100' : 'opacity-0'}`}>
            {/* Emoji react */}
            <div className="relative">
              <button onClick={() => setShowEmojiPicker(p => !p)} title="React"
                className="w-5 h-5 rounded-full bg-white/10 hover:bg-yellow-500/40 text-yellow-300 flex items-center justify-center transition-all text-xs">
                😊
              </button>
              {showEmojiPicker && (
                <div className={`absolute bottom-7 ${isMe ? 'right-0' : 'left-0'} z-50 flex gap-1 bg-blue-900/95 border border-white/20 rounded-2xl px-2 py-1.5 shadow-2xl`}>
                  {EMOJI_REACTIONS.map(emoji => (
                    <button key={emoji} onClick={() => handleReact(emoji)}
                      className="text-lg hover:scale-125 transition-transform active:scale-95">
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {isMe && (
              <>
                <button onClick={() => { setEditing(true); setEditText(msg.text); }} title="Edit"
                  className="w-5 h-5 rounded-full bg-white/10 hover:bg-blue-500/50 text-blue-300 hover:text-white flex items-center justify-center transition-all">
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                  </svg>
                </button>
                <button onClick={handleDelete} title="Delete"
                  className="w-5 h-5 rounded-full bg-white/10 hover:bg-red-500/50 text-blue-300 hover:text-red-300 flex items-center justify-center transition-all">
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                </button>
              </>
            )}
          </div>
        )}

        {/* Bubble */}
        <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[260px] sm:max-w-[340px]`}>
          {isGroup && !isMe && showAvatar && (
            <span className="text-yellow-400 text-xs font-semibold px-1 mb-0.5 truncate max-w-full">
              {senderProfile?.fullName?.split(' ')[0] || 'Member'}
            </span>
          )}

          {editing ? (
            <div className="flex items-center gap-1">
              <input ref={editRef} value={editText} onChange={e => setEditText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') { setEditing(false); setEditText(msg.text); } }}
                className="px-3 py-2 rounded-2xl bg-white/20 border-2 border-yellow-400 text-white text-sm focus:outline-none w-40 sm:w-56" />
              <button onClick={handleSaveEdit} disabled={saving}
                className="w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center text-blue-900 hover:bg-yellow-300 transition-all flex-shrink-0">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
                </svg>
              </button>
              <button onClick={() => { setEditing(false); setEditText(msg.text); }}
                className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-all flex-shrink-0">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          ) : (
            <div className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed break-words ${
              isMe ? 'bg-yellow-400 text-blue-900 font-medium rounded-br-sm' : 'bg-white/15 text-white rounded-bl-sm backdrop-blur-sm'
            }`}>
              {msg.text}
              {msg.edited && <span className="text-xs opacity-40 ml-1 italic">(edited)</span>}
            </div>
          )}

          {/* Reaction bubbles */}
          {reactionSummary.length > 0 && (
            <div className={`flex flex-wrap gap-0.5 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
              {reactionSummary.map(([emoji, uids]) => (
                <button key={emoji} onClick={() => handleReact(emoji)}
                  className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-all ${
                    uids.includes(currentUserId)
                      ? 'bg-yellow-400/30 border-yellow-400/60 text-yellow-200'
                      : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
                  }`}>
                  <span>{emoji}</span>
                  {uids.length > 1 && <span className="font-bold">{uids.length}</span>}
                </button>
              ))}
            </div>
          )}

          {!editing && (
            <span className={`text-xs text-blue-400 mt-0.5 px-1 flex items-center gap-0.5 ${isMe ? 'flex-row-reverse' : ''}`}>
              {formatTimeFull(msg.createdAt)}
              {isMe && !isGroup && (
                <span className={`font-bold ${msg.read ? 'text-yellow-400' : 'text-blue-500/50'}`} style={{ fontSize: 11, letterSpacing: -1 }}>
                  {msg.read ? '✓✓' : '✓'}
                </span>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Edit Group Modal ─────────────────────────────────────────────
const EditGroupModal = ({ group, friends, currentUser, onClose, onSave }) => {
  const [groupName, setGroupName] = useState(group.name);
  const [members, setMembers] = useState(group.members || []);
  const [saving, setSaving] = useState(false);

  const toggleMember = (uid) => {
    if (uid === currentUser.uid) return; // cant remove self (creator)
    setMembers(m => m.includes(uid) ? m.filter(x => x !== uid) : [...m, uid]);
  };

  const handleSave = async () => {
    if (!groupName.trim()) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'groups', group.id), {
        name: groupName.trim(),
        members,
      });
      onSave({ ...group, name: groupName.trim(), members });
      onClose();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  // All friends + existing non-friend members
  const allCandidates = [...friends];

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-blue-900/95 border border-white/20 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="text-white font-bold">Edit Group</h2>
          <button onClick={onClose} className="text-blue-300 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-blue-200 text-xs font-semibold block mb-1.5">GROUP NAME</label>
            <input value={groupName} onChange={e => setGroupName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-blue-300 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
          </div>
          <div>
            <label className="text-blue-200 text-xs font-semibold block mb-1.5">MEMBERS</label>
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {allCandidates.map(f => {
                const isMember = members.includes(f.uid);
                const isCreator = f.uid === currentUser.uid;
                return (
                  <button key={f.uid} onClick={() => toggleMember(f.uid)} disabled={isCreator}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-left ${
                      isMember ? 'bg-yellow-400/20 border border-yellow-400/40' : 'bg-white/5 hover:bg-white/10 border border-transparent'
                    } ${isCreator ? 'opacity-60 cursor-not-allowed' : ''}`}>
                    <Avatar user={f} size={8} />
                    <span className="text-white text-sm flex-1 truncate">{f.fullName}</span>
                    {isCreator && <span className="text-yellow-400 text-xs">creator</span>}
                    {isMember && !isCreator && (
                      <span className="w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-blue-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <button onClick={handleSave} disabled={!groupName.trim() || saving}
            className="w-full py-3 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 text-blue-900 font-bold rounded-xl transition-all text-sm">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Delete Group Confirm ─────────────────────────────────────────
const DeleteGroupConfirm = ({ group, onClose, onDeleted }) => {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'groups', group.id));
      onDeleted(group.id);
      onClose();
    } catch (err) { console.error(err); }
    finally { setDeleting(false); }
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-blue-900/95 border border-white/20 rounded-2xl w-full max-w-xs shadow-2xl p-6 text-center">
        <div className="text-4xl mb-3">🗑️</div>
        <h2 className="text-white font-bold text-lg mb-1">Delete Group?</h2>
        <p className="text-blue-300 text-sm mb-5">
          "<span className="text-white font-semibold">{group.name}</span>" will be permanently deleted. All messages will be lost.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-all text-sm">
            Cancel
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold rounded-xl transition-all text-sm">
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Main Chat Page ───────────────────────────────────────────────
export default function ChatPage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  // Tab: 'dm' | 'groups'
  const [activeTab, setActiveTab] = useState('dm');

  // DM state
  const [friends, setFriends] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [selectedFriendProfile, setSelectedFriendProfile] = useState(null);
  const [dmMessages, setDmMessages] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [loadingFriends, setLoadingFriends] = useState(true);

  // Group state
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupMessages, setGroupMessages] = useState([]);
  const [groupMemberProfiles, setGroupMemberProfiles] = useState({});
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [deletingGroup, setDeletingGroup] = useState(null);
  const [groupUnreads, setGroupUnreads] = useState({});

  // Shared
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);

  // Video call state
  const [activeCall, setActiveCall] = useState(null); // { callDoc, isCaller, otherUser }
  const [incomingCall, setIncomingCall] = useState(null); // { callDoc, callerProfile }
  const [startingCall, setStartingCall] = useState(false);
  const ringAudioRef = useRef(null); // ringtone audio element

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const unsubMessagesRef = useRef(null);
  const unsubUnreadsRef = useRef([]);

  // Play ringtone when incoming call arrives, stop when answered/declined
  useEffect(() => {
    if (incomingCall) {
      // Create oscillator-based ringtone using Web Audio API (no file needed)
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      let stopped = false;
      const playRing = () => {
        if (stopped) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
        osc.onended = () => {
          if (!stopped) setTimeout(playRing, 600); // repeat every ~1s
        };
      };
      playRing();
      ringAudioRef.current = { stop: () => { stopped = true; ctx.close(); } };
    } else {
      // Stop ringtone
      ringAudioRef.current?.stop();
      ringAudioRef.current = null;
    }
    return () => {
      ringAudioRef.current?.stop();
      ringAudioRef.current = null;
    };
  }, [incomingCall]);

  // Online statuses — must be after friends state
  const friendUids = friends.map(f => f.uid).filter(Boolean);
  const onlineStatuses = useOnlineStatuses(friendUids);

  // Auth guard
  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  // Load friends
  useEffect(() => {
    if (!userProfile || !user) return;
    const friendIds = userProfile.friends || [];
    if (!friendIds.length) { setFriends([]); setLoadingFriends(false); return; }
    Promise.all(friendIds.map(uid => getDoc(doc(db, 'users', uid)))).then(docs => {
      setFriends(docs.filter(d => d.exists()).map(d => ({ id: d.id, ...d.data() })));
      setLoadingFriends(false);
    });
  }, [userProfile, user]);

  // Load groups
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'groups'), orderBy('lastMessageAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      const myGroups = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(g => g.members?.includes(user.uid));
      setGroups(myGroups);
      setLoadingGroups(false);
    });
    return () => unsub();
  }, [user]);

  // DM unread counts — query only unread=false messages (no composite index needed)
  useEffect(() => {
    if (!user || !friends.length) return;
    unsubUnreadsRef.current.forEach(u => u());
    unsubUnreadsRef.current = friends.map(friend => {
      const chatId = getChatId(user.uid, friend.uid || friend.id);
      const q = query(
        collection(db, 'chats', chatId, 'messages'),
        where('read', '==', false),
        limit(99)
      );
      return onSnapshot(q, snap => {
        const count = snap.docs.filter(d => d.data().senderId !== user.uid).length;
        setUnreadCounts(prev => ({ ...prev, [friend.uid || friend.id]: count }));
      });
    });
    return () => unsubUnreadsRef.current.forEach(u => u());
  }, [user, friends]);

  // Group unread counts — only listen to recent messages not full history
  useEffect(() => {
    if (!user || !groups.length) return;
    const unsubs = groups.map(group => {
      const q = query(
        collection(db, 'groups', group.id, 'messages'),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      return onSnapshot(q, snap => {
        const count = snap.docs.filter(d => {
          const data = d.data();
          return data.senderId !== user.uid && !(data.readBy || []).includes(user.uid);
        }).length;
        setGroupUnreads(prev => ({ ...prev, [group.id]: count }));
      });
    });
    return () => unsubs.forEach(u => u());
  }, [user, groups]);

  // DM messages
  useEffect(() => {
    if (!selectedFriend || !user) return;
    if (unsubMessagesRef.current) unsubMessagesRef.current();
    setLoadingMessages(true);
    setDmMessages([]);
    const chatId = getChatId(user.uid, selectedFriend);
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'), limit(100));
    unsubMessagesRef.current = onSnapshot(q, async snap => {
      setDmMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoadingMessages(false);
      const unread = snap.docs.filter(d => d.data().senderId !== user.uid && !d.data().read);
      if (unread.length) {
        await Promise.all(unread.map(d => updateDoc(d.ref, { read: true })));
        setUnreadCounts(prev => ({ ...prev, [selectedFriend]: 0 }));
      }
    });
    return () => { if (unsubMessagesRef.current) unsubMessagesRef.current(); };
  }, [selectedFriend, user]);

  // Group messages + member profiles
  useEffect(() => {
    if (!selectedGroup || !user) return;
    if (unsubMessagesRef.current) unsubMessagesRef.current();
    setLoadingMessages(true);
    setGroupMessages([]);
    const q = query(collection(db, 'groups', selectedGroup.id, 'messages'), orderBy('createdAt', 'asc'), limit(100));
    unsubMessagesRef.current = onSnapshot(q, async snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setGroupMessages(msgs);
      setLoadingMessages(false);

      // Load sender profiles we don't have yet
      const senderIds = [...new Set(msgs.map(m => m.senderId))];
      const missing = senderIds.filter(id => !groupMemberProfiles[id]);
      if (missing.length) {
        const profiles = await Promise.all(missing.map(id => getDoc(doc(db, 'users', id))));
        const newProfiles = {};
        profiles.forEach(d => { if (d.exists()) newProfiles[d.id] = { id: d.id, ...d.data() }; });
        setGroupMemberProfiles(prev => ({ ...prev, ...newProfiles }));
      }

      // Mark as read
      const unread = snap.docs.filter(d => {
        const data = d.data();
        return data.senderId !== user.uid && !(data.readBy || []).includes(user.uid);
      });
      if (unread.length) {
        await Promise.all(unread.map(d => updateDoc(d.ref, { readBy: arrayUnion(user.uid) })));
        setGroupUnreads(prev => ({ ...prev, [selectedGroup.id]: 0 }));
      }
    });
    return () => { if (unsubMessagesRef.current) unsubMessagesRef.current(); };
  }, [selectedGroup, user]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dmMessages, groupMessages]);

  const selectFriend = async (friendId) => {
    setSelectedFriend(friendId);
    setSelectedGroup(null);
    setShowSidebar(false);
    const d = await getDoc(doc(db, 'users', friendId));
    if (d.exists()) setSelectedFriendProfile({ id: d.id, ...d.data() });
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const selectGroup = (group) => {
    setSelectedGroup(group);
    setSelectedFriend(null);
    setSelectedFriendProfile(null);
    setShowSidebar(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const goBack = () => {
    setSelectedFriend(null);
    setSelectedFriendProfile(null);
    setSelectedGroup(null);
    setDmMessages([]);
    setGroupMessages([]);
    setShowSidebar(true);
    if (unsubMessagesRef.current) unsubMessagesRef.current();
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;
    const text = newMessage.trim();
    setNewMessage('');
    setSending(true);
    try {
      if (selectedFriend) {
        const chatId = getChatId(user.uid, selectedFriend);
        await addDoc(collection(db, 'chats', chatId, 'messages'), {
          text, senderId: user.uid, read: false, createdAt: serverTimestamp(),
        });
        // Push notification to recipient
        sendNotification({
          recipientUid: selectedFriend,
          type: 'message',
          senderName: userProfile?.firstName || userProfile?.fullName || 'Someone',
          message: text.length > 60 ? text.slice(0, 60) + '...' : text,
        });
      } else if (selectedGroup) {
        await addDoc(collection(db, 'groups', selectedGroup.id, 'messages'), {
          text, senderId: user.uid, readBy: [user.uid], createdAt: serverTimestamp(),
        });
        await updateDoc(doc(db, 'groups', selectedGroup.id), {
          lastMessage: text, lastMessageAt: serverTimestamp(),
        });
        // Push notification to all group members except sender
        const otherMembers = (selectedGroup.members || []).filter(uid => uid !== user.uid);
        otherMembers.forEach(uid => {
          sendNotification({
            recipientUid: uid,
            type: 'group_message',
            senderName: userProfile?.firstName || userProfile?.fullName || 'Someone',
            message: text.length > 60 ? text.slice(0, 60) + '...' : text,
            groupName: selectedGroup.name,
          });
        });
      }
    } catch (err) {
      console.error(err);
      setNewMessage(text);
    } finally {
      setSending(false);
    }
  };

  // Listen for incoming calls — optimized with targeted queries
  useEffect(() => {
    if (!user) return;

    // Listen for DM calls where I am the callee
    const dmQuery = query(
      collection(db, 'calls'),
      where('calleeId', '==', user.uid),
      where('status', '==', 'calling')
    );

    const dmUnsub = onSnapshot(dmQuery, async snap => {
      for (const change of snap.docChanges()) {
        if (change.type === 'added' || change.type === 'modified') {
          // Don't show banner if already in a call
          setActiveCall(current => {
            if (current) return current; // already in call, ignore
            return current;
          });
          setIncomingCall(current => {
            if (current?.callDoc?.id === change.doc.id) return current; // already showing
            return current;
          });
          const data = change.doc.data();
          if (data.status !== 'calling') continue;
          const callerSnap = await getDoc(doc(db, 'users', data.callerId));
          const callerProfile = callerSnap.exists() ? { id: callerSnap.id, ...callerSnap.data() } : null;
          setActiveCall(current => {
            if (!current) {
              setIncomingCall({ callDoc: change.doc.ref, callerProfile, data });
            }
            return current;
          });
        }
        if (change.type === 'removed') {
          setIncomingCall(prev => prev?.callDoc?.id === change.doc.id ? null : prev);
        }
      }
    });

    // Listen for group calls where I am a member
    const groupQuery = query(
      collection(db, 'calls'),
      where('calleeId', '==', 'group'),
      where('status', '==', 'calling')
    );

    const groupUnsub = onSnapshot(groupQuery, async snap => {
      for (const change of snap.docChanges()) {
        if (change.type === 'added' || change.type === 'modified') {
          const data = change.doc.data();
          if (data.callerId === user.uid) continue;
          if (!(data.members || []).includes(user.uid)) continue;
          if (data.status !== 'calling') continue;
          const callerSnap = await getDoc(doc(db, 'users', data.callerId));
          const callerProfile = callerSnap.exists() ? { id: callerSnap.id, ...callerSnap.data() } : null;
          setActiveCall(current => {
            if (!current) {
              setIncomingCall({ callDoc: change.doc.ref, callerProfile, data, isGroup: true, groupName: data.groupName });
            }
            return current;
          });
        }
        if (change.type === 'removed') {
          setIncomingCall(prev => prev?.callDoc?.id === change.doc.id ? null : prev);
        }
      }
    });

    return () => { dmUnsub(); groupUnsub(); };
  }, [user]);

  // Start WebRTC call
  const startVideoCall = async () => {
    if (startingCall) return;
    setStartingCall(true);
    try {
      if (selectedFriend) {
        const callRef = await addDoc(collection(db, 'calls'), {
          callerId: user.uid,
          calleeId: selectedFriend,
          status: 'calling',
          createdAt: serverTimestamp(),
          callerCandidates: [],
          calleeCandidates: [],
        });
        setActiveCall({ callDoc: callRef, isCaller: true, otherUser: selectedFriendProfile });
        // Push call notification
        sendNotification({
          recipientUid: selectedFriend,
          type: 'call',
          senderName: userProfile?.fullName || 'Someone',
          callId: callRef.id,
        });
      } else if (selectedGroup) {
        const groupCallId = `group-${selectedGroup.id}`;
        const callRef = doc(db, 'calls', groupCallId);
        await setDoc(callRef, {
          callerId: user.uid,
          calleeId: 'group',
          groupId: selectedGroup.id,
          groupName: selectedGroup.name,
          members: selectedGroup.members,
          status: 'calling',
          createdAt: serverTimestamp(),
          callerCandidates: [],
          calleeCandidates: [],
        }, { merge: true });
        setActiveCall({ callDoc: callRef, isCaller: true, otherUser: { fullName: selectedGroup.name, isGroup: true } });
        // Push call notification to all group members
        const otherMembers = (selectedGroup.members || []).filter(uid => uid !== user.uid);
        otherMembers.forEach(uid => {
          sendNotification({
            recipientUid: uid,
            type: 'call',
            senderName: userProfile?.fullName || 'Someone',
            callId: groupCallId,
            groupName: selectedGroup.name,
          });
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setStartingCall(false);
    }
  };

  const answerCall = () => {
    if (!incomingCall) return;
    // Immediately mark as answered to stop the 'calling' listener from re-triggering
    updateDoc(incomingCall.callDoc, { status: 'answered' }).catch(() => {});
    setActiveCall({
      callDoc: incomingCall.callDoc,
      isCaller: false,
      otherUser: incomingCall.callerProfile,
    });
    setIncomingCall(null);
  };

  // Auto-answer if coming from feed page via sessionStorage
  useEffect(() => {
    if (!user) return;
    try {
      const raw = sessionStorage.getItem('pendingCall');
      if (!raw) return;
      sessionStorage.removeItem('pendingCall');
      const { callId, callerProfile } = JSON.parse(raw);
      if (!callId) return;
      const callRef = doc(db, 'calls', callId);
      const timer = setTimeout(() => {
        setIncomingCall(null);
        setActiveCall({
          callDoc: callRef,
          isCaller: false,
          otherUser: callerProfile,
        });
      }, 200);
      return () => clearTimeout(timer);
    } catch (e) { console.error('Auto-answer error:', e); }
  }, [user]);

  const declineCall = async () => {
    if (!incomingCall) return;
    await updateDoc(incomingCall.callDoc, { status: 'ended' });
    setIncomingCall(null);
  };

  const totalDmUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);
  const totalGroupUnread = Object.values(groupUnreads).reduce((a, b) => a + b, 0);

  const filteredFriends = friends.filter(f =>
    (f.fullName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredGroups = groups.filter(g =>
    (g.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentMessages = selectedFriend ? dmMessages : groupMessages;
  const chatId = selectedFriend ? getChatId(user.uid, selectedFriend) : null;
  const groupChatCollection = selectedGroup ? `groups/${selectedGroup.id}/messages` : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-950 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-blue-900 via-blue-800 to-blue-950 overflow-hidden">

      {/* Active Call */}
      {activeCall && (
        <VideoCallModal
          callDoc={activeCall.callDoc}
          isCaller={activeCall.isCaller}
          currentUser={userProfile}
          otherUser={activeCall.otherUser}
          onClose={() => setActiveCall(null)}
        />
      )}

      {/* Incoming Call Banner */}
      {incomingCall && !activeCall && (
        <motion.div
          initial={{ y: -120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="fixed inset-x-0 top-0 z-[500] flex flex-col items-center"
        >
          {/* Full-width banner on mobile, card on desktop */}
          <div className="w-full sm:max-w-sm sm:mx-auto sm:mt-4 sm:rounded-2xl bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 border-b sm:border border-yellow-400/60 shadow-2xl px-5 py-4">
            {/* Pulse ring animation */}
            <div className="flex items-center gap-4">
              <div className="relative flex-shrink-0">
                <div className="absolute inset-0 rounded-full bg-green-400/30 animate-ping" style={{width:56,height:56}}></div>
                <Avatar user={incomingCall.callerProfile} size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-base truncate">{incomingCall.callerProfile?.fullName}</p>
                <p className="text-green-300 text-sm font-medium animate-pulse">
                  {incomingCall.isGroup ? `📹 Group call: ${incomingCall.groupName}` : '📹 Incoming video call...'}
                </p>
              </div>
            </div>
            {/* Big centered buttons */}
            <div className="flex gap-4 mt-4 justify-center">
              <button onClick={declineCall}
                className="flex-1 max-w-[140px] h-14 rounded-2xl bg-red-500 hover:bg-red-600 active:scale-95 text-white flex items-center justify-center gap-2 font-bold text-sm transition-all shadow-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
                </svg>
                Decline
              </button>
              <button onClick={answerCall}
                className="flex-1 max-w-[140px] h-14 rounded-2xl bg-green-500 hover:bg-green-600 active:scale-95 text-white flex items-center justify-center gap-2 font-bold text-sm transition-all shadow-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                </svg>
                Answer
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Edit Group Modal */}
      {editingGroup && (
        <EditGroupModal
          group={editingGroup}
          friends={friends}
          currentUser={user}
          onClose={() => setEditingGroup(null)}
          onSave={(updated) => {
            setGroups(prev => prev.map(g => g.id === updated.id ? updated : g));
            if (selectedGroup?.id === updated.id) setSelectedGroup(updated);
          }}
        />
      )}

      {/* Delete Group Confirm */}
      {deletingGroup && (
        <DeleteGroupConfirm
          group={deletingGroup}
          onClose={() => setDeletingGroup(null)}
          onDeleted={(id) => {
            setGroups(prev => prev.filter(g => g.id !== id));
            if (selectedGroup?.id === id) { setSelectedGroup(null); setGroupMessages([]); setShowSidebar(true); }
          }}
        />
      )}

      {/* Create Group Modal */}
      {showCreateGroup && (
        <CreateGroupModal
          friends={friends}
          currentUser={user}
          onClose={() => setShowCreateGroup(false)}
          onCreate={(group) => { setGroups(prev => [group, ...prev]); selectGroup(group); }}
        />
      )}

      {/* BG */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-red-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Navbar */}
      <nav className="relative z-10 bg-blue-900/80 backdrop-blur-lg border-b border-white/10 shadow-xl flex-shrink-0">
        <div className="px-4 py-3 flex items-center justify-between max-w-6xl mx-auto">
          <Link href="/feed" className="flex items-center gap-1.5 text-blue-200 hover:text-white transition-colors text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
            <span className="hidden sm:inline">Feed</span>
          </Link>

          <div className="flex items-center gap-2">
            <Image src="/tsok-logo.png" alt="TSOK" width={32} height={32} />
            <div>
              <h1 className="text-white font-bold text-base leading-none">Messages</h1>
              <p className="text-yellow-400 text-xs">TSOK Community</p>
            </div>
            {(totalDmUnread + totalGroupUnread) > 0 && (
              <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full font-bold">
                {totalDmUnread + totalGroupUnread}
              </span>
            )}
          </div>
          <Avatar user={userProfile} size={8} />
        </div>
      </nav>

      {/* Body */}
      <div className="relative z-10 flex flex-1 overflow-hidden max-w-6xl w-full mx-auto">

        {/* ── Sidebar ── */}
        <div className={`flex flex-col bg-white/5 backdrop-blur-lg border-r border-white/10 flex-shrink-0 transition-all duration-300
          ${showSidebar ? 'w-full' : 'w-0 overflow-hidden'} sm:w-72 sm:overflow-visible`}>

          {/* Tab switcher */}
          <div className="flex border-b border-white/10 flex-shrink-0">
            <button onClick={() => setActiveTab('dm')}
              className={`flex-1 py-3 text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'dm' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-blue-300 hover:text-white'
              }`}>
              💬 DMs
              {totalDmUnread > 0 && <span className="px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full font-bold">{totalDmUnread}</span>}
            </button>
            <button onClick={() => setActiveTab('groups')}
              className={`flex-1 py-3 text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'groups' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-blue-300 hover:text-white'
              }`}>
              👥 Groups
              {totalGroupUnread > 0 && <span className="px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full font-bold">{totalGroupUnread}</span>}
            </button>
          </div>

          {/* Search + create */}
          <div className="p-3 border-b border-white/10 flex-shrink-0 flex gap-2">
            <input type="text" placeholder={activeTab === 'dm' ? 'Search friends...' : 'Search groups...'}
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder-blue-300 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
            {activeTab === 'groups' && (
              <button onClick={() => setShowCreateGroup(true)} title="New Group"
                className="w-9 h-9 bg-yellow-400 hover:bg-yellow-300 text-blue-900 rounded-xl flex items-center justify-center transition-all font-bold text-lg flex-shrink-0">
                +
              </button>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'dm' ? (
              loadingFriends ? (
                <div className="flex justify-center py-8"><div className="animate-spin w-7 h-7 border-4 border-yellow-400 border-t-transparent rounded-full" /></div>
              ) : filteredFriends.length === 0 ? (
                <div className="text-center px-4 py-10">
                  <div className="text-4xl mb-3">👥</div>
                  <p className="text-blue-300 text-sm font-semibold">No friends yet</p>
                  <Link href="/feed" className="mt-3 inline-block px-4 py-2 bg-yellow-400 text-blue-900 text-xs font-bold rounded-xl hover:bg-yellow-300 transition-colors">Go to Feed →</Link>
                </div>
              ) : filteredFriends.map(friend => {
                const unread = unreadCounts[friend.uid] || 0;
                const isSelected = selectedFriend === friend.uid;
                const friendOnline = onlineStatuses[friend.uid]?.isOnline || false;
                const friendLastSeen = onlineStatuses[friend.uid]?.lastSeen;
                return (
                  <button key={friend.uid} onClick={() => selectFriend(friend.uid)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all border-b border-white/5 ${
                      isSelected ? 'bg-yellow-400/20 border-l-4 border-l-yellow-400' : 'hover:bg-white/10'
                    }`}>
                    <div className="relative flex-shrink-0">
                      <Avatar user={friend} size={10} showStatus isOnline={friendOnline} />
                      {unread > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center font-bold border border-blue-900" style={{ fontSize: 9 }}>
                          {unread > 9 ? '9+' : unread}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${isSelected ? 'text-yellow-300' : 'text-white'}`}>{friend.fullName}</p>
                      <p className={`text-xs truncate ${friendOnline ? 'text-green-400 font-medium' : 'text-blue-400'}`}>
                        {friendOnline
                          ? '● Online'
                          : friendLastSeen
                            ? `Last seen ${formatLastSeen(friendLastSeen)}`
                            : (friend.school || 'TSOK Member')
                        }
                      </p>
                    </div>
                    {unread > 0 && <span className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0"></span>}
                  </button>
                );
              })
            ) : (
              loadingGroups ? (
                <div className="flex justify-center py-8"><div className="animate-spin w-7 h-7 border-4 border-yellow-400 border-t-transparent rounded-full" /></div>
              ) : filteredGroups.length === 0 ? (
                <div className="text-center px-4 py-10">
                  <div className="text-4xl mb-3">💬</div>
                  <p className="text-blue-300 text-sm font-semibold">No groups yet</p>
                  <button onClick={() => setShowCreateGroup(true)}
                    className="mt-3 px-4 py-2 bg-yellow-400 text-blue-900 text-xs font-bold rounded-xl hover:bg-yellow-300 transition-colors">
                    + Create Group
                  </button>
                </div>
              ) : filteredGroups.map(group => {
                const unread = groupUnreads[group.id] || 0;
                const isSelected = selectedGroup?.id === group.id;
                const isCreator = group.createdBy === user.uid;
                return (
                  <div key={group.id}
                    className={`flex items-center border-b border-white/5 transition-all group/item ${
                      isSelected ? 'bg-yellow-400/20 border-l-4 border-l-yellow-400' : 'hover:bg-white/10'
                    }`}>
                    <button onClick={() => selectGroup(group)} className="flex items-center gap-3 px-4 py-3 text-left flex-1 min-w-0">
                      <div className="relative flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm border-2 border-yellow-400">
                          {group.name?.charAt(0).toUpperCase()}
                        </div>
                        {unread > 0 && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center font-bold border border-blue-900" style={{ fontSize: 9 }}>
                            {unread > 9 ? '9+' : unread}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${isSelected ? 'text-yellow-300' : 'text-white'}`}>{group.name}</p>
                        <p className="text-blue-400 text-xs">{group.members?.length || 0} members</p>
                      </div>
                      {unread > 0 && <span className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0"></span>}
                    </button>

                    {/* Edit/Delete — creator only, show on hover */}
                    {isCreator && (
                      <div className="flex gap-1 pr-2 opacity-0 group-hover/item:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingGroup(group); }}
                          title="Edit group"
                          className="w-6 h-6 rounded-full bg-white/10 hover:bg-blue-500/50 text-blue-300 hover:text-white flex items-center justify-center transition-all">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                          </svg>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeletingGroup(group); }}
                          title="Delete group"
                          className="w-6 h-6 rounded-full bg-white/10 hover:bg-red-500/50 text-blue-300 hover:text-red-300 flex items-center justify-center transition-all">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Chat Window ── */}
        <div className={`flex-col flex-1 overflow-hidden ${showSidebar ? 'hidden sm:flex' : 'flex'}`}>
          {!selectedFriend && !selectedGroup ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 3, repeat: Infinity }} className="text-6xl mb-4">💬</motion.div>
              <h3 className="text-white text-xl font-bold mb-2">Start a Conversation</h3>
              <p className="text-blue-300 text-sm">Select a friend or group from the list</p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="flex items-center gap-3 px-4 py-3 bg-white/5 backdrop-blur-lg border-b border-white/10 flex-shrink-0">
                <button onClick={goBack} className="sm:hidden text-blue-300 hover:text-white transition-colors p-1 -ml-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
                  </svg>
                </button>

                {selectedFriend ? (
                  <Avatar user={selectedFriendProfile} size={9} showStatus isOnline={onlineStatuses[selectedFriend]?.isOnline || false} />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold flex-shrink-0 border-2 border-yellow-400">
                    {selectedGroup?.name?.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm truncate">
                    {selectedFriend ? selectedFriendProfile?.fullName : selectedGroup?.name}
                  </p>
                  <p className={`text-xs truncate ${selectedFriend && onlineStatuses[selectedFriend]?.isOnline ? 'text-green-400 font-medium' : 'text-blue-400'}`}>
                    {selectedFriend
                      ? onlineStatuses[selectedFriend]?.isOnline
                        ? '● Online now'
                        : onlineStatuses[selectedFriend]?.lastSeen
                          ? `Last seen ${formatLastSeen(onlineStatuses[selectedFriend].lastSeen)}`
                          : (selectedFriendProfile?.school || 'TSOK Member')
                      : `${selectedGroup?.members?.length || 0} members`}
                  </p>
                </div>

                {/* Video Call Button — DM & Group */}
                <button onClick={startVideoCall} disabled={startingCall}
                  title="Start Video Call"
                  className="w-8 h-8 rounded-xl bg-green-500/20 hover:bg-green-500/40 text-green-400 hover:text-green-300 flex items-center justify-center transition-all disabled:opacity-50 flex-shrink-0">
                  {startingCall ? (
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                    </svg>
                  )}
                </button>

                {selectedFriend && (
                  <Link href={`/profile/${selectedFriend}`}
                    className="text-blue-300 hover:text-yellow-400 text-xs px-2.5 py-1.5 bg-white/10 rounded-xl hover:bg-white/20 transition-all whitespace-nowrap">
                    Profile
                  </Link>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3">
                {loadingMessages ? (
                  <div className="flex justify-center py-10">
                    <div className="animate-spin w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full" />
                  </div>
                ) : currentMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-10">
                    <div className="text-5xl mb-3">{selectedGroup ? '👥' : '👋'}</div>
                    <p className="text-white font-semibold">
                      {selectedGroup ? `Welcome to ${selectedGroup.name}!` : `Say hi to ${selectedFriendProfile?.firstName || 'your friend'}!`}
                    </p>
                    <p className="text-blue-300 text-sm mt-1">Be the first to send a message.</p>
                  </div>
                ) : currentMessages.map((msg, idx) => {
                  const isMe = msg.senderId === user.uid;
                  const prevMsg = currentMessages[idx - 1];
                  const showAvatar = !isMe && (!prevMsg || prevMsg.senderId !== msg.senderId);
                  const isConsecutive = prevMsg && prevMsg.senderId === msg.senderId;
                  const senderProfile = selectedFriend
                    ? (isMe ? userProfile : selectedFriendProfile)
                    : (isMe ? userProfile : groupMemberProfiles[msg.senderId]);

                  return (
                    <MessageBubble
                      key={msg.id}
                      msg={msg}
                      isMe={isMe}
                      showAvatar={showAvatar}
                      isConsecutive={isConsecutive}
                      senderProfile={senderProfile}
                      chatId={selectedFriend ? getChatId(user.uid, selectedFriend) : `groups/${selectedGroup.id}/messages`}
                      isGroup={!!selectedGroup}
                      currentUserId={user.uid}
                    />
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="px-3 sm:px-4 py-3 bg-white/5 backdrop-blur-lg border-t border-white/10 flex-shrink-0">
                <form onSubmit={sendMessage} className="flex items-end gap-2">
                  <textarea ref={inputRef} value={newMessage}
                    onChange={e => {
                      setNewMessage(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
                    }}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e); } }}
                    placeholder={selectedGroup ? `Message ${selectedGroup.name}...` : `Message ${selectedFriendProfile?.firstName || ''}...`}
                    rows={1}
                    className="flex-1 px-4 py-2.5 rounded-2xl bg-white/10 border border-white/20 text-white placeholder-blue-300 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none overflow-hidden"
                    style={{ minHeight: 44, maxHeight: 100 }} />
                  <button type="submit" disabled={!newMessage.trim() || sending}
                    className="w-11 h-11 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 text-blue-900 rounded-2xl flex items-center justify-center transition-all shadow-lg flex-shrink-0 active:scale-95">
                    {sending ? (
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                      </svg>
                    )}
                  </button>
                </form>
                <p className="text-blue-500 text-xs mt-1 text-center hidden sm:block">Enter to send · Shift+Enter for new line</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
