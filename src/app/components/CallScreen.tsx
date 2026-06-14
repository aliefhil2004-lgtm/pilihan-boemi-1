import { useEffect, useMemo, useRef } from 'react';
import { Ambulance, ArrowLeft, Flame, Grid3X3, LockKeyhole, MicOff, PhoneOff, Shield, User, Volume2 } from 'lucide-react';
import type { ServiceType } from '../types/emergency';
import { getServiceDisplayLabel } from '../utils/serviceLabels';

interface CallScreenProps {
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

export function CallScreen({ contactName, contactRole, serviceType, serviceTypes, callerRole, phoneNumber, onBack }: CallScreenProps) {
  const hasDialedRef = useRef(false);
  const activeServices = useMemo(() => uniqueServices(serviceTypes, serviceType), [serviceType, serviceTypes]);
  const responderLabels = activeServices.map(service => getServiceDisplayLabel(service)).join(' & ');
  const title = callerRole === 'civilian' ? 'Emergency Dispatch' : contactName;
  const subtitle = callerRole === 'civilian' ? responderLabels : contactRole;
  const groupMembers = callerRole === 'civilian' ? ['Citizen', ...activeServices.map(service => getServiceDisplayLabel(service))] : [contactName, contactRole];

  useEffect(() => {
    if (!phoneNumber || hasDialedRef.current) return;
    hasDialedRef.current = true;
    const timer = window.setTimeout(() => {
      window.location.href = `tel:${phoneNumber}`;
    }, 350);
    return () => window.clearTimeout(timer);
  }, [phoneNumber]);

  return (
    <div className="absolute inset-0 z-[90] flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#08344f_0%,#6da5c4_100%)] px-8 pb-8 pt-[46px] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_33%,rgba(255,255,255,0.22),transparent_34%),radial-gradient(circle_at_95%_8%,rgba(255,255,255,0.12),transparent_28%)]" />
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="relative flex h-10 w-10 items-center justify-center rounded-full text-white" aria-label="Back">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div className="relative flex flex-1 items-center justify-center gap-2 pr-10">
          <LockKeyhole className="h-3 w-3" />
          <span className="text-[11px] font-bold uppercase leading-4 tracking-[1.6px]">End-to-end encrypted</span>
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
        <div className="mt-5 rounded-full border border-white/45 bg-white/10 px-7 py-2 text-[18px] font-bold leading-6 tracking-[3px] shadow-inner">
          00:12
        </div>
      </div>

      <div className="relative grid grid-cols-3 gap-10">
        {[
          { label: 'Mute', icon: MicOff },
          { label: 'Keypad', icon: Grid3X3 },
          { label: 'Speaker', icon: Volume2 }
        ].map(item => {
          const Icon = item.icon;
          return (
            <button key={item.label} className={`flex flex-col items-center gap-3 ${item.label === 'Speaker' ? 'text-[#0b3850]' : 'text-white/70'}`}>
              <span className={`flex h-16 w-16 items-center justify-center rounded-full border border-white/35 ${item.label === 'Speaker' ? 'bg-[#1e5a78]/80' : 'bg-white/10'}`}>
                <Icon className="h-6 w-6 text-white" />
              </span>
              <span className="text-[13px] font-medium leading-5">{item.label}</span>
            </button>
          );
        })}
      </div>

      <button onClick={onBack} className="relative mx-auto mt-12 flex h-20 w-20 items-center justify-center rounded-full bg-[#c9161d] shadow-[0_14px_30px_rgba(0,0,0,0.18)]" aria-label="End call">
        <PhoneOff className="h-8 w-8 fill-white text-white" />
      </button>
    </div>
  );
}
