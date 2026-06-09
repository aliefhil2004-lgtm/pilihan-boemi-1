import { BatteryFull, Wifi } from 'lucide-react';

interface IPhoneStatusBarProps {
  dark?: boolean;
}

export function IPhoneStatusBar({ dark = false }: IPhoneStatusBarProps) {
  const colorClass = dark ? 'text-white' : 'text-black';

  return (
    <div className={`pointer-events-none absolute inset-x-0 top-0 z-[60] h-[47px] ${colorClass}`}>
      <span className="absolute left-[21px] top-[15px] w-[54px] text-center text-[15px] font-bold leading-none tracking-normal">9:41</span>
      <div className="absolute left-[302px] top-[19px] flex h-3 w-[70px] items-center gap-1.5">
        <div className="flex h-[11px] items-end gap-[2px]" aria-hidden="true">
          <span className="block h-[5px] w-[3px] rounded-sm bg-current" />
          <span className="block h-[8px] w-[3px] rounded-sm bg-current" />
          <span className="block h-[11px] w-[3px] rounded-sm bg-current" />
          <span className="block h-[11px] w-[3px] rounded-sm bg-current" />
        </div>
        <Wifi className="h-[16px] w-[16px] stroke-[3]" />
        <BatteryFull className="h-[24px] w-[24px] stroke-[2.5]" />
      </div>
    </div>
  );
}
