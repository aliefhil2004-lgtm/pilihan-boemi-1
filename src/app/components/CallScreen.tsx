import { ArrowLeft, Grid3X3, LockKeyhole, MicOff, PhoneOff, User, Volume2 } from 'lucide-react';
import type { ServiceType } from '../types/emergency';

interface CallScreenProps {
  contactName: string;
  contactRole: string;
  serviceType?: ServiceType;
  callerRole: 'civilian' | 'service';
  onBack: () => void;
}

const callThemes: Record<ServiceType | 'civilian', string> = {
  ambulance: 'linear-gradient(180deg, #6da5c4 0%, #a6dbfe 100%)',
  fire: 'linear-gradient(180deg, #ff4b00 0%, #ff9a3d 100%)',
  police: 'linear-gradient(180deg, #1647b9 0%, #2563eb 100%)',
  civilian: 'linear-gradient(180deg, #6da5c4 0%, #a6dbfe 100%)'
};

export function CallScreen({ contactName, contactRole, serviceType, callerRole, onBack }: CallScreenProps) {
  const themeKey = callerRole === 'service' ? serviceType ?? 'fire' : serviceType ?? 'civilian';
  const background = callThemes[themeKey];

  return (
    <div className="absolute inset-0 z-[90] flex h-full flex-col overflow-hidden px-8 pb-12 pt-[46px] text-white" style={{ background }}>
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full text-white" aria-label="Back">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div className="flex flex-1 items-center justify-center gap-2 pr-10">
          <LockKeyhole className="h-3 w-3" />
          <span className="text-[11px] font-bold uppercase leading-4 tracking-[1.6px]">End-to-end encrypted</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center pb-20">
        <div className="flex h-48 w-48 items-center justify-center rounded-full bg-black/10">
          <User className="h-28 w-28 text-white" strokeWidth={1.6} />
        </div>

        <h1 className="mt-10 text-center text-[30px] font-extrabold leading-9 tracking-normal">{contactName}</h1>
        <p className="mt-2 text-center text-[16px] font-semibold leading-6 text-white/85">{contactRole}</p>
        <div className="mt-5 rounded-full border border-white/50 bg-white/10 px-7 py-2 text-[20px] font-bold leading-6 tracking-[3px]">
          00:12
        </div>
      </div>

      <div className="grid grid-cols-3 gap-12">
        {[
          { label: 'Mute', icon: MicOff },
          { label: 'Keypad', icon: Grid3X3 },
          { label: 'Speaker', icon: Volume2 }
        ].map(item => {
          const Icon = item.icon;
          return (
            <button key={item.label} className="flex flex-col items-center gap-3 text-white/70">
              <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/40 bg-white/10">
                <Icon className="h-6 w-6 text-white" />
              </span>
              <span className="text-[13px] font-medium leading-5">{item.label}</span>
            </button>
          );
        })}
      </div>

      <button onClick={onBack} className="mx-auto mt-12 flex h-20 w-20 items-center justify-center rounded-full bg-[#c9161d] shadow-[0_14px_30px_rgba(0,0,0,0.18)]" aria-label="End call">
        <PhoneOff className="h-8 w-8 fill-white text-white" />
      </button>
    </div>
  );
}
