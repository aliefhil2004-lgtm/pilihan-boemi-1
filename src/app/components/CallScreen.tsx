import { useEffect, useMemo, useRef, useState } from 'react';
import { Ambulance, ArrowLeft, Flame, LockKeyhole, Mic, MicOff, PhoneCall, PhoneOff, Shield, User, Volume2 } from 'lucide-react';
import type { ServiceType } from '../types/emergency';
import { getServiceDisplayLabel } from '../utils/serviceLabels';
import { startWebRtcCall, subscribeToInAppCall, updateInAppCall } from '../services/inAppCall';

interface CallScreenProps {
  mode?: 'hotline' | 'in-app';
  callId?: string;
  reportId?: string;
  incoming?: boolean;
  contactName: string;
  contactRole: string;
  serviceType?: ServiceType;
  serviceTypes?: ServiceType[];
  callerRole: 'civilian' | 'service';
  phoneNumber?: string;
  onBack: () => void;
}

const serviceVisuals: Record<ServiceType, {
  Icon: typeof Ambulance;
  image: string;
  color: string;
}> = {
  ambulance: {
    Icon: Ambulance,
    image: 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&fit=crop&w=360&q=80',
    color: '#6da5c4'
  },
  fire: {
    Icon: Flame,
    image: 'https://images.unsplash.com/photo-1602417742134-45fd0d0d5208?auto=format&fit=crop&w=360&q=80',
    color: '#ff6b1a'
  },
  police: {
    Icon: Shield,
    image: 'https://images.unsplash.com/photo-1590999659195-e64a988eaf04?auto=format&fit=crop&w=360&q=80',
    color: '#2563eb'
  }
};

function uniqueServices(serviceTypes?: ServiceType[], fallback?: ServiceType) {
  return [...new Set(serviceTypes?.length ? serviceTypes : fallback ? [fallback] : ['fire' as ServiceType])];
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainingSeconds = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainingSeconds}`;
}

export function CallScreen({ mode = 'in-app', callId, incoming = false, contactName, contactRole, serviceType, serviceTypes, callerRole, phoneNumber, onBack }: CallScreenProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [hotlineState, setHotlineState] = useState<'ready' | 'dialing' | 'phone-app'>('ready');
  const [inAppState, setInAppState] = useState<'requesting-mic' | 'calling' | 'ringing' | 'connecting' | 'connected' | 'declined' | 'ended' | 'failed'>('requesting-mic');
  const [isMuted, setIsMuted] = useState(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const cleanupWebRtcRef = useRef<null | (() => Promise<void>)>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const activeServices = useMemo(() => uniqueServices(serviceTypes, serviceType), [serviceType, serviceTypes]);
  const responderLabels = activeServices.map(service => getServiceDisplayLabel(service)).join(' & ');
  const title = callerRole === 'civilian' ? 'Emergency Dispatch' : contactName;
  const subtitle = callerRole === 'civilian' ? responderLabels : contactRole;
  const groupMembers = callerRole === 'civilian' ? ['Citizen', ...activeServices.map(service => getServiceDisplayLabel(service))] : [contactName, contactRole];
  const dialNumber = phoneNumber?.replace(/[^+\d*#]/g, '');
  const isHotline = mode === 'hotline';
  const callConnected = inAppState === 'connected';

  useEffect(() => {
    if ((isHotline && hotlineState === 'ready') || (!isHotline && !callConnected)) return undefined;
    const timer = window.setInterval(() => {
      setElapsedSeconds(seconds => seconds + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [callConnected, hotlineState, isHotline]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && hotlineState === 'dialing') {
        setHotlineState('phone-app');
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [hotlineState]);

  useEffect(() => {
    if (isHotline || !callId) return undefined;
    let cancelled = false;

    const stopStatus = subscribeToInAppCall(callId, call => {
      if (call.status === 'declined') setInAppState('declined');
      if (call.status === 'ended') setInAppState('ended');
      if (!incoming && call.status === 'ringing') setInAppState('ringing');
      if (call.status === 'connecting') setInAppState('connecting');
    });

    void navigator.mediaDevices?.getUserMedia({ audio: true, video: false })
      .then(async stream => {
        if (cancelled) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        localStreamRef.current = stream;
        setInAppState(incoming ? 'connecting' : 'calling');
        cleanupWebRtcRef.current = await startWebRtcCall({
          callId,
          incoming,
          localStream: stream,
          onRemoteStream: remoteStream => {
            if (!remoteAudioRef.current) return;
            remoteAudioRef.current.srcObject = remoteStream;
            void remoteAudioRef.current.play().catch(() => undefined);
          },
          onStateChange: state => {
            if (state === 'connected') {
              setElapsedSeconds(0);
              setInAppState('connected');
              void updateInAppCall(callId, { status: 'connected' });
            } else if (state === 'failed' || state === 'disconnected') {
              setInAppState('failed');
            } else if (state === 'connecting') {
              setInAppState('connecting');
            }
          }
        });
      })
      .catch(() => setInAppState('failed'));

    return () => {
      cancelled = true;
      stopStatus();
      void cleanupWebRtcRef.current?.();
    };
  }, [callId, incoming, isHotline]);

  const startRealCall = () => {
    if (!dialNumber) return;
    setElapsedSeconds(0);
    setHotlineState('dialing');
    window.location.href = `tel:${dialNumber}`;
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    localStreamRef.current?.getAudioTracks().forEach(track => {
      track.enabled = !nextMuted;
    });
    setIsMuted(nextMuted);
  };

  const endCall = () => {
    if (!isHotline && callId) void updateInAppCall(callId, { status: 'ended' });
    void cleanupWebRtcRef.current?.();
    onBack();
  };

  return (
    <div className="absolute inset-0 z-[90] flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#08344f_0%,#6da5c4_100%)] px-8 pb-8 pt-[46px] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_33%,rgba(255,255,255,0.22),transparent_34%),radial-gradient(circle_at_95%_8%,rgba(255,255,255,0.12),transparent_28%)]" />
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="relative flex h-10 w-10 items-center justify-center rounded-full text-white" aria-label="Back">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div className="relative flex flex-1 items-center justify-center gap-2 pr-10">
          <LockKeyhole className="h-3 w-3" />
          <span className="text-[11px] font-bold uppercase leading-4 tracking-[1.6px]">
            {isHotline ? 'Universal emergency hotline' : 'ResponAI secure audio'}
          </span>
        </div>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center pb-12">
        <div className="relative flex h-[178px] w-[230px] items-center justify-center">
          {callerRole === 'civilian' ? (
            activeServices.slice(0, 3).map((service, index) => {
              const visual = serviceVisuals[service];
              const offset = activeServices.length === 1 ? 0 : index * 56 - Math.min(activeServices.length - 1, 2) * 28;
              return (
                <div
                  key={service}
                  className="absolute flex h-[132px] w-[132px] items-center justify-center overflow-hidden rounded-full border-2 border-white/20 bg-white/10 shadow-[0_12px_28px_rgba(0,0,0,0.16)]"
                  style={{ transform: `translateX(${offset}px)`, zIndex: 10 + index }}
                >
                  <img src={visual.image} alt={getServiceDisplayLabel(service)} className="h-full w-full object-cover" />
                  <span className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full border border-white/60" style={{ backgroundColor: visual.color }}>
                    <visual.Icon className="h-4 w-4 text-white" />
                  </span>
                </div>
              );
            })
          ) : (
            <div className="flex h-[142px] w-[142px] items-center justify-center rounded-full border border-white/25 bg-white/15">
              <User className="h-20 w-20 text-white" strokeWidth={1.6} />
            </div>
          )}
        </div>

        <h1 className="mt-5 text-center text-[30px] font-extrabold leading-9 tracking-normal">{title}</h1>
        <p className="mt-2 text-center text-[15px] font-semibold leading-6 text-white/88">{subtitle}</p>
        <div className="mt-3 max-w-[285px] text-center text-[11px] font-semibold leading-4 text-white/65">
          Group call: {groupMembers.join(', ')}
        </div>
        {isHotline && dialNumber && (
          <div className="mt-2 text-center text-[11px] font-semibold leading-4 text-white/55">
            Calling {dialNumber}
          </div>
        )}
        <div className="mt-5 rounded-full border border-white/45 bg-white/10 px-7 py-2 text-[14px] font-bold leading-6 shadow-inner">
          {isHotline
            ? hotlineState === 'ready'
              ? 'Ready to open Phone app'
              : hotlineState === 'dialing'
            ? `Opening dialer • ${formatDuration(elapsedSeconds)}`
              : `Phone app active • ${formatDuration(elapsedSeconds)}`
            : inAppState === 'requesting-mic'
            ? 'Requesting microphone permission'
            : inAppState === 'calling'
            ? 'Starting secure call'
            : inAppState === 'ringing'
            ? 'Ringing service unit'
            : inAppState === 'connecting'
            ? 'Connecting audio'
            : inAppState === 'connected'
            ? `Connected • ${formatDuration(elapsedSeconds)}`
            : inAppState === 'declined'
            ? 'Call declined'
            : inAppState === 'ended'
            ? 'Call ended'
            : 'Unable to connect audio'}
        </div>
        <p className="mt-3 max-w-[300px] text-center text-[11px] leading-4 text-white/65">
          {isHotline
            ? '112 is the universal emergency hotline. Ringing and answer status are controlled by your device.'
            : 'This call stays inside ResponAI. Both citizen and service unit must keep the app open and allow microphone access.'}
        </p>
      </div>

      <audio ref={remoteAudioRef} autoPlay playsInline />

      {isHotline ? (
        <button
          type="button"
          onClick={startRealCall}
          disabled={!dialNumber}
          className="relative mx-auto flex h-16 w-full max-w-[300px] items-center justify-center gap-3 rounded-2xl bg-[#16a34a] px-5 text-[16px] font-extrabold text-white shadow-[0_14px_30px_rgba(0,0,0,0.18)] disabled:cursor-not-allowed disabled:bg-white/20"
        >
          <PhoneCall className="h-6 w-6" />
          {hotlineState === 'ready' ? `Call ${dialNumber ?? 'unavailable'}` : 'Open Phone app again'}
        </button>
      ) : (
        <div className="relative mx-auto flex items-center justify-center gap-10">
          <button
            type="button"
            onClick={toggleMute}
            className={`flex h-16 w-16 items-center justify-center rounded-full border border-white/35 ${isMuted ? 'bg-white text-[#0b3850]' : 'bg-white/10 text-white'}`}
            aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </button>
          <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/35 bg-white/10 text-white" title="Audio plays through the device output">
            <Volume2 className="h-6 w-6" />
          </span>
        </div>
      )}

      <button onClick={endCall} className="relative mx-auto mt-8 flex h-16 w-16 items-center justify-center rounded-full bg-[#c9161d] shadow-[0_14px_30px_rgba(0,0,0,0.18)]" aria-label="End call">
        <PhoneOff className="h-8 w-8 fill-white text-white" />
      </button>
    </div>
  );
}
