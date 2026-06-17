import { BatteryFull, Wifi } from 'lucide-react';
import { useEffect, useState } from 'react';

interface IPhoneStatusBarProps {
  dark?: boolean;
}

export function IPhoneStatusBar({ dark = false }: IPhoneStatusBarProps) {
  const colorClass = dark ? 'text-white' : 'text-black';
  const [timeLabel, setTimeLabel] = useState(() => getDeviceTimeParts());

  useEffect(() => {
    const updateTime = () => setTimeLabel(getDeviceTimeParts());
    updateTime();
    const interval = window.setInterval(updateTime, 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className={`pointer-events-none absolute inset-x-0 top-0 z-[60] h-[47px] ${colorClass}`}>
      <span className="absolute left-[21px] top-[14px] flex w-[68px] items-baseline justify-center gap-[2px] whitespace-nowrap font-bold tracking-normal">
        <span className="text-[16px] leading-none">{timeLabel.time}</span>
        {timeLabel.period && (
          <span className="text-[10px] uppercase leading-none">{timeLabel.period}</span>
        )}
      </span>
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

function getDeviceTimeParts() {
  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  });
  const parts = formatter.formatToParts(new Date());
  const hour = parts.find(part => part.type === 'hour')?.value ?? '';
  const minute = parts.find(part => part.type === 'minute')?.value ?? '';
  const literal = parts.find(part => part.type === 'literal')?.value ?? ':';
  const period = parts.find(part => part.type === 'dayPeriod')?.value ?? '';
  return {
    time: `${hour}${literal}${minute}`.trim(),
    period
  };
}
