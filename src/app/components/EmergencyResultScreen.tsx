import { ArrowLeft, CheckCircle2, Clock, MapPin, MessageSquare, Phone, Radio, ShieldCheck, WifiOff } from 'lucide-react';
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
import { formatSeverityScore } from '../utils/severity';

interface EmergencyResultScreenProps {
  emergencyType: string;
  priority: 'High' | 'Medium' | 'Low';
  recommendedService: ServiceType;
  recommendedServices: ServiceType[];
  countryName?: string;
  emergencyNumbers?: Partial<Record<ServiceType, string>>;
  reportId?: string;
  reportCode?: string;
  submittedAt?: string;
  injuryScale: number;
  location: string;
  detectedIndicators?: string[];
  assessmentSummary?: string;
  annotatedImage?: string;
  privacyRegions?: PrivacyRegion[];
  aiConfidence?: number;
  reviewStatus?: 'auto-routed' | 'needs-human-review' | 'operator-confirmed';
  reviewReason?: string;
  responseMetrics?: {
    submittedSeconds: number;
    aiTriageSeconds: number;
    routedSeconds: number;
    dispatchTargetSeconds: number;
    estimatedTriageSecondsSaved: number;
    jakartaBaselineSeconds: number;
    simulatedTotalSeconds: number;
    measuredAt: string;
    stepSavings?: Array<{
      step: string;
      manualSeconds: number;
      automatedSeconds: number;
      savedSeconds: number;
    }>;
  };
  evidenceVerification?: {
    score: number;
    checks: Array<{ label: string; passed: boolean; points: number }>;
  };
  anonymizationStatus?: 'not-needed' | 'queued' | 'anonymized';
  offlineSyncStatus?: 'online-synced' | 'queued-for-sync' | 'syncing' | 'sync-failed';
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
  countryName,
  emergencyNumbers,
  reportId,
  reportCode,
  submittedAt,
  injuryScale,
  location,
  detectedIndicators,
  assessmentSummary,
  annotatedImage,
  privacyRegions,
  aiConfidence,
  reviewStatus,
  reviewReason,
  responseMetrics,
  evidenceVerification,
  anonymizationStatus,
  offlineSyncStatus,
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

  const notifyWaitingForLiveGps = () => {
    toast.info('Live tracking can be accessed after emergency services share live GPS.');
  };

  const handleOpenChat = () => {
    if (isFalseReport) return;
    onOpenChat();
  };

  const handleCallResponder = () => {
    if (isFalseReport) return;
    toast.success(`Opening emergency hotline ${servicePhoneNumber}`);
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

            {assessmentSummary && (
              <div className="mt-4 rounded-xl border border-[#dbeafe] bg-[#f8fbff] p-4 text-[13px] text-[#0b3850]">
                <p className="text-[14px] font-extrabold">Assessment summary</p>
                <p className="mt-2 leading-6">{assessmentSummary}</p>
              </div>
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

            {emergencyNumbers && (
              <div className="mt-3 rounded-xl bg-[#eef8ff] p-3 text-[12px] leading-5 text-[#0b3850]">
                <p className="font-extrabold">Local emergency routing{countryName ? ` - ${countryName}` : ''}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(recommendedServices.length ? recommendedServices : ['fire' as ServiceType]).map(service => (
                    <span key={service} className="rounded-full bg-white px-2.5 py-1 font-bold text-[#475569]">
                      {getServiceDisplayLabel(service)}: {emergencyNumbers[service] ?? 'N/A'}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 space-y-3 text-[16px] leading-5">
              <p className="flex items-center gap-3"><MapPin className="h-[18px] w-[18px] shrink-0" /><span>{location}</span></p>
              <p className="flex items-center gap-3"><Clock className="h-[18px] w-[18px] shrink-0" /><span>{submittedTimeLabel}</span></p>
              <p>Severity scale: <span className="font-extrabold text-[#d21a25]">{formatSeverityScore(injuryScale)}/10</span></p>
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

            <div className="mt-5 rounded-xl border border-[#dbeafe] bg-[#f8fbff] p-4 text-[#0b3850]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-[#2563eb]" />
                  <p className="text-[15px] font-extrabold">AI Triage Control</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  reviewStatus === 'needs-human-review'
                    ? 'bg-amber-100 text-amber-800'
                    : reviewStatus === 'operator-confirmed'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {reviewStatus === 'needs-human-review'
                    ? 'Human Review'
                    : reviewStatus === 'operator-confirmed'
                    ? 'Operator Confirmed'
                    : 'Auto Routed'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[12px]">
                <div className="rounded-lg bg-white p-3">
                  <p className="text-[#64748b]">AI confidence</p>
                  <p className="mt-1 text-[20px] font-extrabold">{aiConfidence ?? 0}%</p>
                </div>
                <div className="rounded-lg bg-white p-3">
                  <p className="text-[#64748b]">Evidence score</p>
                  <p className="mt-1 text-[20px] font-extrabold">{evidenceVerification?.score ?? 0}/100</p>
                </div>
              </div>
              {reviewReason && (
                <p className="mt-3 text-[12px] leading-5 text-[#475569]">{reviewReason}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
                <span className="rounded-full bg-white px-2.5 py-1 text-[#475569]">
                  Anonymization: {anonymizationStatus === 'queued' ? 'Queued' : anonymizationStatus === 'anonymized' ? 'Done' : 'Not needed'}
                </span>
                <span className="rounded-full bg-white px-2.5 py-1 text-[#475569]">
                  Sync: {offlineSyncStatus === 'queued-for-sync'
                    ? 'Pending signal'
                    : offlineSyncStatus === 'syncing'
                    ? 'Syncing'
                    : offlineSyncStatus === 'sync-failed'
                    ? 'Retry queued'
                    : 'Verified online'}
                </span>
              </div>
            </div>

            <div className="mt-5 rounded-xl bg-[#f7f7f7] p-4 text-[#0b3850]">
              <p className="mb-4 text-[20px] font-extrabold leading-7">Response Timeline</p>
              <div className="space-y-3 border-l-4 border-[#0b3850] py-1 pl-7">
                <div>
                  <p className="text-[16px] font-bold leading-6">Emergency report submitted</p>
                  <p className="text-[15px] leading-6">{submittedTimeLabel}</p>
                </div>
                {responseMetrics && (
                  <>
                    <div>
                      <p className="text-[14px] font-bold leading-5">AI triage completed</p>
                      <p className="text-[13px] text-[#64748b]">+{responseMetrics.aiTriageSeconds}s from submission</p>
                    </div>
                    <div>
                      <p className="text-[14px] font-bold leading-5">Routed to service dashboard</p>
                      <p className="text-[13px] text-[#64748b]">+{responseMetrics.routedSeconds}s, estimated {responseMetrics.estimatedTriageSecondsSaved}s saved in triage</p>
                    </div>
                    <div>
                      <p className="text-[14px] font-bold leading-5">Dispatch target</p>
                      <p className="text-[13px] text-[#64748b]">Operator decision target: {responseMetrics.dispatchTargetSeconds}s</p>
                    </div>
                    <div className="rounded-lg bg-white p-2">
                      <p className="text-[14px] font-bold leading-5">Jakarta response simulation</p>
                      <p className="text-[13px] text-[#64748b]">
                        24-minute baseline compared with {responseMetrics.simulatedTotalSeconds}s submission-to-dispatch target.
                        This is a prototype estimate, not an operational SLA.
                      </p>
                    </div>
                    {responseMetrics.stepSavings?.map(step => (
                      <div key={step.step} className="rounded-lg bg-white p-2">
                        <p className="text-[13px] font-bold">{step.step}</p>
                        <p className="text-[12px] text-[#64748b]">
                          {step.automatedSeconds}s automated vs {step.manualSeconds}s simulated manual; {step.savedSeconds}s estimated saved
                        </p>
                      </div>
                    ))}
                  </>
                )}
                {offlineSyncStatus === 'queued-for-sync' && (
                  <p className="flex items-center gap-2 rounded-lg bg-amber-50 p-2 text-[12px] font-bold text-amber-800">
                    <WifiOff className="h-4 w-4" />
                    Offline-first queue active. Report syncs when signal returns.
                  </p>
                )}
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
