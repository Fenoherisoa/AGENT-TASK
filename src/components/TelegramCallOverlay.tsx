import React, { useState, useEffect, useRef } from 'react';
import {
  Phone,
  PhoneOff,
  PhoneIncoming,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Settings2,
  ShieldAlert,
  Wifi,
  Sparkles,
  User,
  Clock
} from 'lucide-react';
import { TelegramCallRecord, TelegramCallCapability } from '../types/task';
import { api } from '../services/api';

interface TelegramCallOverlayProps {
  activeCall: TelegramCallRecord | null;
  capabilities?: TelegramCallCapability;
  onCallStateChanged?: () => void;
}

export const TelegramCallOverlay: React.FC<TelegramCallOverlayProps> = ({
  activeCall,
  capabilities,
  onCallStateChanged
}) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showDeviceSettings, setShowDeviceSettings] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Available Media Devices
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoInputDevices, setVideoInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState<string>('');
  const [selectedAudioOutput, setSelectedAudioOutput] = useState<string>('');
  const [selectedVideoInput, setSelectedVideoInput] = useState<string>('');

  // Local & Remote Video refs
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Format seconds to mm:ss
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Enumerate Media Devices
  const loadMediaDevices = async () => {
    if (!navigator?.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioInputDevices(devices.filter(d => d.kind === 'audioinput'));
      setAudioOutputDevices(devices.filter(d => d.kind === 'audiooutput'));
      setVideoInputDevices(devices.filter(d => d.kind === 'videoinput'));
    } catch {}
  };

  // Request browser permissions & setup local media stream
  const initializeMedia = async (withVideo: boolean) => {
    setPermissionError(null);
    if (!navigator?.mediaDevices?.getUserMedia) {
      setPermissionError("L'API média du navigateur n'est pas disponible.");
      return null;
    }

    try {
      const constraints: MediaStreamConstraints = {
        audio: selectedAudioInput ? { deviceId: { exact: selectedAudioInput } } : true,
        video: withVideo ? (selectedVideoInput ? { deviceId: { exact: selectedVideoInput } } : true) : false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      setCamEnabled(withVideo);
      setMicEnabled(true);
      await loadMediaDevices();
      return stream;
    } catch (err: any) {
      console.error('Media permission error:', err);
      let errorMsg = 'Erreur d\'accès aux périphériques multimédias.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = withVideo ? 'Camera or Microphone permission denied' : 'Microphone permission denied';
      } else if (err.name === 'NotFoundError') {
        errorMsg = 'Aucun microphone ou caméra détecté.';
      }
      setPermissionError(errorMsg);
      return null;
    }
  };

  // Attach local stream to video element when available
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, activeCall?.state, isMinimized]);

  // Clean up local media stream when call ends or unmounts
  const cleanupMedia = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch {}
      });
      setLocalStream(null);
    }
  };

  useEffect(() => {
    if (!activeCall || activeCall.state === 'ENDED' || activeCall.state === 'MISSED' || activeCall.state === 'DECLINED' || activeCall.state === 'FAILED') {
      cleanupMedia();
    } else if (activeCall.state === 'CONNECTED' || activeCall.state === 'VIDEO_CONNECTED') {
      if (!localStream) {
        initializeMedia(activeCall.type === 'VIDEO');
      }
    }
  }, [activeCall?.state, activeCall?.callId]);

  // Handle Accept Call
  const handleAcceptCall = async (withVideo = false) => {
    if (!activeCall) return;
    setIsProcessingAction(true);
    try {
      const stream = await initializeMedia(withVideo || activeCall.type === 'VIDEO');
      if (!stream && permissionError) {
        setIsProcessingAction(false);
        return; // Don't fake connected call if permission denied
      }

      await api.acceptTelegramCall(activeCall.callId, withVideo || activeCall.type === 'VIDEO');
      onCallStateChanged?.();
    } catch (err: any) {
      setPermissionError(err.message || 'Échec de l\'acceptation de l\'appel Telegram');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Handle Decline Call
  const handleDeclineCall = async () => {
    if (!activeCall) return;
    setIsProcessingAction(true);
    try {
      cleanupMedia();
      await api.declineTelegramCall(activeCall.callId);
      onCallStateChanged?.();
    } catch (err: any) {
      console.error('Error declining call:', err);
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Handle End Call
  const handleEndCall = async () => {
    if (!activeCall) return;
    setIsProcessingAction(true);
    try {
      cleanupMedia();
      await api.endTelegramCall(activeCall.callId);
      onCallStateChanged?.();
    } catch (err: any) {
      console.error('Error ending call:', err);
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Toggle Microphone Mute
  const handleToggleMic = () => {
    if (!localStream) return;
    const newMicState = !micEnabled;
    localStream.getAudioTracks().forEach(track => {
      track.enabled = newMicState;
    });
    setMicEnabled(newMicState);
    if (activeCall) {
      api.updateTelegramCallControls(activeCall.callId, { microphoneEnabled: newMicState });
    }
  };

  // Toggle Camera
  const handleToggleCam = async () => {
    const newCamState = !camEnabled;
    if (newCamState) {
      // Re-initialize with video track
      const stream = await initializeMedia(true);
      if (stream) {
        setCamEnabled(true);
        if (activeCall) {
          api.updateTelegramCallControls(activeCall.callId, { cameraEnabled: true });
        }
      }
    } else {
      if (localStream) {
        localStream.getVideoTracks().forEach(track => {
          track.stop();
          localStream.removeTrack(track);
        });
      }
      setCamEnabled(false);
      if (activeCall) {
        api.updateTelegramCallControls(activeCall.callId, { cameraEnabled: false });
      }
    }
  };

  // Toggle Speaker Output
  const handleToggleSpeaker = () => {
    const newSpeaker = !speakerEnabled;
    setSpeakerEnabled(newSpeaker);
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = !newSpeaker;
    }
    if (activeCall) {
      api.updateTelegramCallControls(activeCall.callId, { speakerEnabled: newSpeaker });
    }
  };

  if (!activeCall || activeCall.state === 'NONE') {
    return null;
  }

  const isIncoming = activeCall.state === 'INCOMING';
  const isRinging = activeCall.state === 'RINGING' || activeCall.state === 'CONNECTING';
  const isConnected = activeCall.state === 'CONNECTED' || activeCall.state === 'VIDEO_CONNECTED';
  const isEnded = activeCall.state === 'ENDED' || activeCall.state === 'MISSED' || activeCall.state === 'DECLINED' || activeCall.state === 'FAILED';
  const isVideoCall = activeCall.type === 'VIDEO';

  // 1. Minimized Floating Pill (When operator collapses call to view background tasks)
  if (isMinimized && isConnected) {
    return (
      <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 border border-indigo-500/40 backdrop-blur-xl rounded-2xl shadow-2xl p-3 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5">
        <div className="relative">
          <div className={`w-10 h-10 rounded-full bg-gradient-to-tr ${activeCall.userAvatarColor || 'from-indigo-600 to-purple-600'} flex items-center justify-center text-white font-bold text-sm shadow-md`}>
            {activeCall.userName.charAt(0).toUpperCase()}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse" />
        </div>

        <div className="flex flex-col">
          <span className="text-xs font-bold text-white max-w-[120px] truncate">{activeCall.userName}</span>
          <span className="text-[11px] font-mono text-emerald-400 font-semibold">{formatDuration(activeCall.duration)}</span>
        </div>

        <div className="flex items-center gap-1.5 ml-2">
          <button
            onClick={handleToggleMic}
            className={`p-2 rounded-xl text-xs transition ${micEnabled ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-rose-500/20 text-rose-400'}`}
            title={micEnabled ? 'Couper micro' : 'Activer micro'}
          >
            {micEnabled ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={handleEndCall}
            className="p-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition shadow-md"
            title="Raccrocher"
          >
            <PhoneOff className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsMinimized(false)}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
            title="Agrandir la fenêtre"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // 2. Main Global Overlay / Modal
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className={`relative w-full ${isVideoCall && isConnected ? 'max-w-4xl' : 'max-w-md'} bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300`}>
        
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              RFC TASK AGENT • TELEGRAM {isVideoCall ? 'VIDEO' : 'VOICE'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isConnected && (
              <>
                <button
                  onClick={() => setShowDeviceSettings(!showDeviceSettings)}
                  className="p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl transition text-xs"
                  title="Paramètres périphériques"
                >
                  <Settings2 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setIsMinimized(true)}
                  className="p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl transition text-xs"
                  title="Réduire"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Permission Denied / Error Banner */}
        {permissionError && (
          <div className="px-6 py-3 bg-rose-500/15 border-b border-rose-500/30 flex items-center gap-2.5 text-rose-300 text-xs">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
            <span className="font-medium">{permissionError}</span>
          </div>
        )}

        {/* Device Settings Panel Dropdown */}
        {showDeviceSettings && (
          <div className="p-4 bg-slate-950/90 border-b border-slate-800 text-xs space-y-3">
            <div className="font-semibold text-slate-200">Sélection des Périphériques Audio & Vidéo</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Microphone</label>
                <select
                  value={selectedAudioInput}
                  onChange={e => setSelectedAudioInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-slate-200 text-xs focus:outline-none"
                >
                  <option value="">Par défaut</option>
                  {audioInputDevices.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0, 5)}`}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Haut-parleurs</label>
                <select
                  value={selectedAudioOutput}
                  onChange={e => setSelectedAudioOutput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-slate-200 text-xs focus:outline-none"
                >
                  <option value="">Par défaut</option>
                  {audioOutputDevices.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || `Haut-parleur ${d.deviceId.slice(0, 5)}`}</option>
                  ))}
                </select>
              </div>

              {isVideoCall && (
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Caméra</label>
                  <select
                    value={selectedVideoInput}
                    onChange={e => setSelectedVideoInput(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-slate-200 text-xs focus:outline-none"
                  >
                    <option value="">Par défaut</option>
                    {videoInputDevices.map(d => (
                      <option key={d.deviceId} value={d.deviceId}>{d.label || `Caméra ${d.deviceId.slice(0, 5)}`}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Central Content Area */}
        <div className="p-8 flex flex-col items-center justify-center text-center relative min-h-[320px]">

          {/* 1. Video Call Active View */}
          {isVideoCall && isConnected ? (
            <div className="relative w-full h-[400px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center shadow-inner">
              {/* Remote Video Stream Area */}
              <div className="flex flex-col items-center justify-center text-slate-400">
                <div className={`w-24 h-24 rounded-full bg-gradient-to-tr ${activeCall.userAvatarColor || 'from-indigo-600 to-purple-600'} flex items-center justify-center text-white font-bold text-3xl shadow-xl mb-3`}>
                  {activeCall.userName.charAt(0).toUpperCase()}
                </div>
                <div className="text-sm font-semibold text-white">{activeCall.userName}</div>
                <span className="text-xs text-slate-500 mt-1">Flux vidéo distant chiffré MTProto</span>
              </div>

              {/* Local Video Picture-in-Picture Preview (Top Right) */}
              <div className="absolute top-4 right-4 w-36 h-28 bg-slate-900 border-2 border-indigo-500/50 rounded-xl overflow-hidden shadow-2xl flex items-center justify-center group">
                {camEnabled && localStream ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-500 p-2">
                    <VideoOff className="w-5 h-5 mb-1 text-slate-400" />
                    <span className="text-[10px]">Caméra désactivée</span>
                  </div>
                )}
                <div className="absolute bottom-1 left-2 text-[9px] font-mono text-slate-300 bg-black/60 px-1 rounded">
                  Vous
                </div>
              </div>

              {/* Remote Audio element (Real Media) */}
              <audio ref={remoteAudioRef} autoPlay />
            </div>
          ) : (
            /* 2. Voice Call / Connecting / Incoming View */
            <div className="flex flex-col items-center space-y-4 my-4">
              {/* Pulsing Avatar */}
              <div className="relative">
                {isIncoming && (
                  <div className="absolute -inset-4 rounded-full bg-indigo-500/20 animate-ping duration-1000" />
                )}
                {isRinging && (
                  <div className="absolute -inset-3 rounded-full bg-cyan-500/20 animate-pulse duration-700" />
                )}
                {isConnected && (
                  <div className="absolute -inset-2 rounded-full bg-emerald-500/20 animate-pulse duration-1500" />
                )}

                <div className={`relative w-28 h-28 rounded-full bg-gradient-to-tr ${activeCall.userAvatarColor || 'from-indigo-600 to-purple-600'} flex items-center justify-center text-white font-bold text-4xl shadow-2xl border-4 border-slate-900`}>
                  {activeCall.userName.charAt(0).toUpperCase()}
                </div>
              </div>

              {/* Caller Name & Handle */}
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-white">{activeCall.userName}</h2>
                {activeCall.userUsername && (
                  <p className="text-xs font-mono text-indigo-400">@{activeCall.userUsername}</p>
                )}
              </div>

              {/* Status / Duration Display */}
              <div className="flex items-center justify-center gap-2">
                {isIncoming && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-medium border border-indigo-500/30">
                    <PhoneIncoming className="w-3.5 h-3.5 animate-bounce" />
                    Appel {isVideoCall ? 'vidéo' : 'audio'} entrant...
                  </span>
                )}

                {isRinging && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-medium border border-cyan-500/30">
                    <Wifi className="w-3.5 h-3.5 animate-pulse" />
                    Connexion en cours...
                  </span>
                )}

                {isConnected && (
                  <div className="flex flex-col items-center gap-1">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-mono font-bold border border-emerald-500/30">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDuration(activeCall.duration)}
                    </span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Wifi className="w-2.5 h-2.5 text-emerald-400" />
                      Qualité: {activeCall.quality || 'Excellente'}
                    </span>
                  </div>
                )}

                {isEnded && (
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                    activeCall.state === 'MISSED' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                    activeCall.state === 'DECLINED' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                    'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}>
                    {activeCall.state === 'MISSED' ? 'Appel manqué' :
                     activeCall.state === 'DECLINED' ? 'Appel décliné' :
                     activeCall.state === 'FAILED' ? 'Échec de connexion' :
                     `Appel terminé (${formatDuration(activeCall.duration)})`}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Controls Bar */}
          <div className="w-full pt-6 mt-2 border-t border-slate-800/80 flex items-center justify-center gap-4">
            {/* 1. Incoming Actions (Decline / Accept) */}
            {isIncoming && (
              <>
                <button
                  type="button"
                  disabled={isProcessingAction}
                  onClick={handleDeclineCall}
                  className="flex-1 max-w-[140px] py-3.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-semibold text-xs transition shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <PhoneOff className="w-4 h-4" />
                  Décliner
                </button>

                <button
                  type="button"
                  disabled={isProcessingAction}
                  onClick={() => handleAcceptCall(isVideoCall)}
                  className="flex-1 max-w-[140px] py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-semibold text-xs transition shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 disabled:opacity-50 animate-pulse"
                >
                  {isVideoCall ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                  Accepter
                </button>
              </>
            )}

            {/* 2. Connected / In-Call Controls */}
            {(isConnected || isRinging) && (
              <>
                {/* Microphone Mute */}
                <button
                  type="button"
                  onClick={handleToggleMic}
                  className={`p-3.5 rounded-2xl transition border ${
                    micEnabled
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                      : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border-rose-500/40'
                  }`}
                  title={micEnabled ? 'Couper micro' : 'Activer micro'}
                >
                  {micEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </button>

                {/* Camera Toggle for Video Calls */}
                {isVideoCall && (
                  <button
                    type="button"
                    onClick={handleToggleCam}
                    className={`p-3.5 rounded-2xl transition border ${
                      camEnabled
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                        : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border-rose-500/40'
                    }`}
                    title={camEnabled ? 'Couper caméra' : 'Activer caméra'}
                  >
                    {camEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                  </button>
                )}

                {/* Speaker Toggle */}
                <button
                  type="button"
                  onClick={handleToggleSpeaker}
                  className={`p-3.5 rounded-2xl transition border ${
                    speakerEnabled
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                      : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border-rose-500/40'
                  }`}
                  title={speakerEnabled ? 'Couper haut-parleur' : 'Activer haut-parleur'}
                >
                  {speakerEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                </button>

                {/* End Call Button */}
                <button
                  type="button"
                  disabled={isProcessingAction}
                  onClick={handleEndCall}
                  className="py-3.5 px-6 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-bold text-xs transition shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
                  title="Terminer l'appel"
                >
                  <PhoneOff className="w-5 h-5" />
                  Raccrocher
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
