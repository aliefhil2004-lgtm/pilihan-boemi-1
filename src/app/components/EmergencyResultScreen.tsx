import { Flame, MapPin, MessageSquare, Phone, Radio } from 'lucide-react';
import { useEffect } from 'react';
import type { ServiceType } from '../types/emergency';
import type { PrivacyRegion } from '../types/emergency';
import type { Language } from '../i18n';
import { PrivacyImage } from './PrivacyImage';

interface EmergencyResultScreenProps {
  emergencyType: string;
  priority: 'Critical' | 'Medium' | 'Low';
  recommendedService: ServiceType;
  recommendedServices: ServiceType[];
  injuryScale: number;
  location: string;
  detectedIndicators?: string[];
  annotatedImage?: string;
  privacyRegions?: PrivacyRegion[];
  isFalseReport: boolean;
  falseReportReason?: string;
  servicePhoneNumber: string;
  canViewSensitiveMedia: boolean;
  onViewDetails: () => void;
  onFalseReportDone: () => void;
  language: Language;
}

export function EmergencyResultScreen({
  priority,
  recommendedServices,
  injuryScale,
  location,
  detectedIndicators,
  annotatedImage,
  privacyRegions,
  isFalseReport,
  falseReportReason,
  servicePhoneNumber,
  canViewSensitiveMedia,
  onViewDetails,
  onFalseReportDone
}: EmergencyResultScreenProps) {
  useEffect(() => {
    if (!isFalseReport) return undefined;
    const timer = window.setTimeout(onFalseReportDone, 1800);
    return () => window.clearTimeout(timer);
  }, [isFalseReport, onFalseReportDone]);

  return (
    <div className="flex h-full flex-col bg-white pb-24 text-[#0b3850]">
      <div className="flex h-[88px] items-center gap-5 bg-white px-7 pt-[36px] shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <h1 className="text-[17px] font-extrabold">Report Detail</h1>
      </div>

      <main className="app-scrollbar flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto max-w-sm space-y-5">
          <section className={`rounded-lg p-4 text-center text-white ${isFalseReport ? 'bg-[#7a4b00]' : 'bg-[#14751b]'}`}>
            <p className="text-[16px] font-bold">{isFalseReport ? 'False Report Detected' : 'Report Sent'}</p>
            <p className="mt-1.5 text-[13px] leading-5 text-white/85">
              {isFalseReport
                ? falseReportReason ?? 'No clear emergency evidence was detected.'
                : 'Report received. Stay safe and keep your phone available.'}
            </p>
          </section>

          <article className="rounded-2xl border border-[#e1e5ea] bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[18px] font-extrabold">Building Fire Report</h2>
                <p className="mt-1 text-[13px] font-bold text-[#9aa3b1]">#RPT-001</p>
              </div>
              <span className="rounded-full border border-[#f7d36b] bg-[#fff5d8] px-3 py-1.5 text-[11px] font-bold text-[#e4a900]">
                {priority}
              </span>
            </div>

            {annotatedImage && (
              <PrivacyImage
                src={annotatedImage}
                alt="Emergency assessment"
                allowUnblurred={canViewSensitiveMedia}
                wrapperClassName="mt-4"
                className="h-[150px] w-full rounded-xl object-cover"
                privacyRegions={privacyRegions}
              />
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              {(recommendedServices.length ? recommendedServices : ['fire' as ServiceType]).map(service => (
                <span
                  key={service}
                  className={`rounded-full px-4 py-1.5 text-[13px] font-medium text-white ${
                    service === 'fire' ? 'bg-[#ff5a0a]' : service === 'ambulance' ? 'bg-[#6da5c4]' : 'bg-[#2563eb]'
                  }`}
                >
                  {service === 'ambulance' ? 'Medic' : service[0].toUpperCase() + service.slice(1)}
                </span>
              ))}
            </div>

            <div className="mt-5 space-y-3 text-[13px]">
              <p className="flex items-center gap-2.5"><MapPin className="h-[18px] w-[18px]" /><span>{location}</span></p>
              <p>Severity scale: <span className="font-extrabold text-[#d21a25]">{injuryScale}/10</span></p>
            </div>

            <div className="mt-5 rounded-xl bg-[#f7f7f7] p-4 text-[13px] text-[#6f7785]">
              <p className="mb-2 text-[14px] font-extrabold">{isFalseReport ? 'Why it was marked false' : 'Assessment Summary'}</p>
              {(isFalseReport
                ? [falseReportReason ?? 'No clear emergency evidence was detected.']
                : (detectedIndicators?.length ? detectedIndicators : ['Manual review recommended'])
              ).map(item => (
                <p key={item} className="mt-2">- {item}</p>
              ))}
            </div>
          </article>
        </div>
      </main>

      <footer className="grid grid-cols-[50px_50px_1fr] gap-2 bg-white px-5 pb-3">
        <button className="flex h-[50px] items-center justify-center rounded-lg bg-[#0b3850] text-white" aria-label="Open chat" disabled={isFalseReport}>
          <MessageSquare className="h-[18px] w-[18px]" />
        </button>
        <button
          onClick={() => { window.location.href = `tel:${servicePhoneNumber}`; }}
          className="flex h-[50px] items-center justify-center rounded-lg bg-[#0b3850] text-white disabled:opacity-50"
          aria-label="Call responder"
          disabled={isFalseReport}
        >
          <Phone className="h-[18px] w-[18px]" />
        </button>
        <button
          onClick={onViewDetails}
          className="flex h-[50px] w-full items-center justify-center gap-2 rounded-lg bg-[#cc1420] px-3 text-[14px] font-bold text-white shadow-lg transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={isFalseReport}
        >
          <Radio className="h-[18px] w-[18px] shrink-0" />
          <span className="truncate">Live Track Location</span>
        </button>
      </footer>
    </div>
  );
}
