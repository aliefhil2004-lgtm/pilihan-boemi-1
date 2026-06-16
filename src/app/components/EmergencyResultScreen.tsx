import { ArrowLeft, CheckCircle2, Clock, MapPin, MessageSquare, Phone, Radio } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { cleanupExpiredReports } from '../services/reportStorage';
import { fetchLiveGps } from '../services/liveGps';
import { formatReportCode, getReportServices, getServiceStatus, type ServiceType } from '../types/emergency';
import type { PrivacyRegion } from '../types/emergency';
import type { Language } from '../i18n';
import { PrivacyImage } from './PrivacyImage';
import { getServiceDisplayLabel } from '../utils/serviceLabels';
import { formatReportDateTime } from '../utils/date';

interface EmergencyResultScreenProps {
  emergencyType: string;
  priority: 'High' | 'Medium' | 'Low';
  recommendedService: ServiceType;
  recommendedServices: ServiceType[];
  reportId?: string;
  reportCode?: string;
  submittedAt?: string;
  injuryScale: number;
  location: string;
  detectedIndicators?: string[];
  annotatedImage?: string;
  privacyRegions?: PrivacyRegion[];
  isFalseReport: boolean;
  falseReportReason?: string;
  servicePhoneNumber: string;
  canViewSensitiveMedia: boolean;
  onCancelReport: () => void;
  onBackHome: () => void;
  onOpenChat: () => void;
  onCallResponder: () => void;
  onViewDetails: () => void;
  onFalseReportDone: () => void;
  language: Language;
}

export function EmergencyResultScreen({
  emergencyType,
  priority,
  recommendedServices,
  reportId,
  reportCode,
  submittedAt,
  injuryScale,
  location,
  detectedIndicators,
  annotatedImage,
  privacyRegions,
  isFalseReport,
  falseReportReason,
  servicePhoneNumber,
  canViewSensitiveMedia,
  onCancelReport,
  onBackHome,
  onOpenChat,
  onCallResponder,
  onViewDetails,
  onFalseReportDone
}: EmergencyResultScreenProps) {
  const [isAccepted, setIsAccepted] = useState(false);
  const [canLiveTrack, setCanLiveTrack] = useState(false);
  const [trackingRequested, setTrackingRequested] = useState(false);
  const reportTitle = emergencyType?.trim() || 'Emergency Report';
  const submittedTimeLabel = formatReportDateTime(submittedAt);
  const priorityClassName =
    priority === 'High'
      ? 'border-red-300 bg-red-50 text-red-600'
      : priority === 'Medium'
      ? 'border-yellow-300 bg-yellow-50 text-yellow-700'
      : 'border-blue-300 bg-blue-50 text-blue-700';

  useEffect(() => {
    if (!isFalseReport) return undefined;
    const timer = window.setTimeout(onFalseReportDone, 1800);
    return () => window.clearTimeout(timer);
  }, [isFalseReport, onFalseReportDone]);

  useEffect(() => {
    if (!reportId || isFalseReport) {
      setIsAccepted(false);
      setCanLiveTrack(false);
      return undefined;
    }

    const refreshStatus = async () => {
      const report = cleanupExpiredReports().find(item => item.id === reportId);
      if (!report) {
        setIsAccepted(false);
        setCanLiveTrack(false);
        return;
      }
      const services = getReportServices(report);
      setIsAccepted(services.some(service => ['responding', 'arrived', 'resolved', 'done'].includes(getServiceStatus(report, service))));
      const liveLocations = await Promise.all(services.map(service => fetchLiveGps(service, report.id)));
      setCanLiveTrack(liveLocations.some(Boolean));
    };

    void refreshStatus();
    const interval = window.setInterval(() => void refreshStatus(), 1500);
    window.addEventListener('storage', refreshStatus);
    window.addEventListener('emergency-reports-updated', refreshStatus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('storage', refreshStatus);
      window.removeEventListener('emergency-reports-updated', refreshStatus);
    };
  }, [isFalseReport, reportId]);

  const notifyWaitingForAcceptance = (feature = 'This feature') => {
    toast.info(`${feature} can be accessed after emergency services accept the report.`);
  };

  const notifyWaitingForLiveGps = () => {
    toast.info('Live tracking can be accessed after emergency services share live GPS.');
  };

  const handleOpenChat = () => {
    if (isFalseReport) return;
    if (!isAccepted) {
      notifyWaitingForAcceptance('Chat');
      return;
    }
    onOpenChat();
  };

  const handleCallResponder = () => {
    if (isFalseReport) return;
    if (!isAccepted) {
      notifyWaitingForAcceptance('Phone call');
      return;
    }
    toast.success(`Calling assigned responder at ${servicePhoneNumber}`);
    onCallResponder();
  };

  const handleLiveTrack = () => {
    if (isFalseReport) return;
    if (!canLiveTrack) {
      setTrackingRequested(true);
      notifyWaitingForLiveGps();
      return;
    }
    onViewDetails();
  };

  return (
    <div className="flex h-full flex-col bg-white pb-[104px] text-[#0b3850]">
      <div className="grid h-[94px] grid-cols-[40px_1fr_auto] items-end gap-3 bg-white px-5 pb-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
        <button
          onClick={onBackHome}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-[#0b3850] transition hover:bg-slate-50"
          aria-label="Cancel report"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-[20px] font-extrabold leading-8">Report Detail</h1>
        <button
          onClick={onCancelReport}
          className="mb-1 rounded-lg px-2 py-1 text-[12px] font-bold text-[#cc1420] transition hover:bg-red-50"
        >
          Cancel
        </button>
      </div>

      <main className="app-scrollbar flex-1 overflow-y-auto px-5 py-4">
        <div className="mx-auto max-w-sm space-y-4">
          <section className={`relative overflow-hidden rounded-[10px] px-5 py-4 text-center text-white ${isFalseReport ? 'bg-[#7a4b00]' : 'bg-[#14751b]'}`}>
            {!isFalseReport && (
              <span className="pointer-events-none absolute -right-3 -top-5 flex h-[76px] w-[76px] items-center justify-center rounded-full bg-white/15">
                <CheckCircle2 className="h-11 w-11 text-white/40" />
              </span>
            )}
            <div className="relative">
              <p className="text-[18px] font-bold leading-6">{isFalseReport ? 'False Report Detected' : 'Report Sent'}</p>
              <p className="mx-auto mt-1 max-w-[290px] text-[14px] leading-5 text-white/85">
                {isFalseReport
                  ? falseReportReason ?? 'No clear emergency evidence was detected.'
                  : 'Report received. Stay safe and keep your phone available.'}
              </p>
            </div>
          </section>

          <article className="rounded-[16px] border border-[#e1e5ea] bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[22px] font-extrabold leading-7">{reportTitle}</h2>
                <p className="mt-1 text-[13px] font-bold text-[#9aa3b1]">#{reportCode ?? (reportId ? formatReportCode({ id: reportId }) : 'RPT-001')}</p>
              </div>
              <span className={`rounded-full border px-3 py-1.5 text-[11px] font-bold ${priorityClassName}`}>
                {priority}
              </span>
            </div>

            {annotatedImage && (
              <PrivacyImage
                src={annotatedImage}
                alt="Emergency assessment"
                allowUnblurred={canViewSensitiveMedia}
                wrapperClassName="mt-4"
                className="h-[181px] w-full rounded-[11px] object-cover"
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
                  {getServiceDisplayLabel(service, `${emergencyType} ${detectedIndicators?.join(' ') ?? ''}`)}
                </span>
              ))}
            </div>

            <div className="mt-5 space-y-3 text-[16px] leading-5">
              <p className="flex items-center gap-3"><MapPin className="h-[18px] w-[18px] shrink-0" /><span>{location}</span></p>
              <p className="flex items-center gap-3"><Clock className="h-[18px] w-[18px] shrink-0" /><span>{submittedTimeLabel}</span></p>
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

            <div className="mt-5 rounded-xl bg-[#f7f7f7] p-4 text-[#0b3850]">
              <p className="mb-4 text-[20px] font-extrabold leading-7">Response Timeline</p>
              <div className="border-l-4 border-[#0b3850] py-1 pl-7">
                <p className="text-[16px] leading-6">Emergency report submitted</p>
                <p className="text-[15px] leading-6">{submittedTimeLabel}</p>
              </div>
            </div>
          </article>
        </div>
      </main>

      <footer className="absolute bottom-20 left-0 right-0 z-30 grid grid-cols-[50px_50px_1fr] gap-2 bg-white px-5 pb-3 pt-2">
        <button
          onClick={handleOpenChat}
          className="flex h-[50px] items-center justify-center rounded-lg bg-[#0b3850] text-white transition hover:bg-[#123f59]"
          aria-label="Open chat"
        >
          <MessageSquare className="h-[18px] w-[18px]" />
        </button>
        <button
          onClick={handleCallResponder}
          className="flex h-[50px] items-center justify-center rounded-lg bg-[#0b3850] text-white transition hover:bg-[#123f59]"
          aria-label="Call responder"
        >
          <Phone className="h-[18px] w-[18px]" />
        </button>
        <button
          onClick={handleLiveTrack}
          className={`flex h-[50px] w-full items-center justify-center gap-2 rounded-lg px-3 text-[14px] font-bold text-white shadow-lg transition disabled:cursor-not-allowed disabled:bg-slate-300 ${
            !canLiveTrack && trackingRequested ? 'bg-[#8a94a6] hover:bg-[#7b8496]' : 'bg-[#cc1420] hover:bg-red-700'
          }`}
          disabled={isFalseReport}
        >
          <Radio className="h-[18px] w-[18px] shrink-0" />
          <span className="truncate">{!canLiveTrack && trackingRequested ? 'Waiting for Live GPS' : 'Live Track Location'}</span>
        </button>
      </footer>
    </div>
  );
}
