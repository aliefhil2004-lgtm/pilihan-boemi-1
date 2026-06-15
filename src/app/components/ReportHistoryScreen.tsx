import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Clock, Eye, MapPin, MessageSquare, Phone, Radio, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { getReportServices, getServiceStatus, type StoredEmergencyReport } from '../types/emergency';
import { cleanupExpiredReports, deleteReports } from '../services/reportStorage';
import { PrivacyImage } from './PrivacyImage';
import { getServiceContactNumber } from '../config/contacts';
import { getServiceDisplayLabel } from '../utils/serviceLabels';

interface ReportHistoryScreenProps {
  initialReportId?: string | null;
  onOpenChat: (reportId: string) => void;
  onTrack: (report: StoredEmergencyReport) => void;
  canViewSensitiveMedia: boolean;
}

const severityStyles = {
  minor: 'border-green-300 bg-green-50 text-green-700',
  moderate: 'border-[#f7d36b] bg-[#fff5d8] text-[#e4a900]',
  severe: 'border-orange-300 bg-orange-50 text-orange-600',
  critical: 'border-red-300 bg-red-50 text-red-600'
};

const severityLabels = {
  minor: 'LOW',
  moderate: 'MEDIUM',
  severe: 'HIGH',
  critical: 'CRITICAL'
};

export function ReportHistoryScreen({ initialReportId, onOpenChat, onTrack, canViewSensitiveMedia }: ReportHistoryScreenProps) {
  const [reports, setReports] = useState<StoredEmergencyReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(initialReportId ?? null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [serviceFilter, setServiceFilter] = useState<'all' | 'pending' | 'responding'>('all');

  useEffect(() => {
    const refresh = () => setReports(cleanupExpiredReports());
    refresh();
    const interval = setInterval(refresh, 1500);
    window.addEventListener('storage', refresh);
    window.addEventListener('emergency-reports-updated', refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('emergency-reports-updated', refresh);
    };
  }, []);

  const selectedReport = reports.find(report => report.id === selectedReportId);
  const toggleSelected = (reportId: string) => {
    setSelectedIds(ids =>
      ids.includes(reportId) ? ids.filter(id => id !== reportId) : [...ids, reportId]
    );
  };

  const cancelSelection = () => {
    setIsSelecting(false);
    setSelectedIds([]);
  };

  const deleteSelected = () => {
    deleteReports(selectedIds);
    setReports(reports.filter(report => !selectedIds.includes(report.id)));
    cancelSelection();
  };

  const isReportAccepted = (report: StoredEmergencyReport) =>
    getReportServices(report).some(service => getServiceStatus(report, service) !== 'pending');

  const showWaitingToast = (feature: string) => {
    toast.info(`${feature} can be accessed after emergency services accept the report.`);
  };

  if (selectedReport) {
    const accepted = isReportAccepted(selectedReport);
    const reportServices = getReportServices(selectedReport);
    const primaryService = reportServices[0] ?? selectedReport.service ?? 'ambulance';
    const reportContext = `${selectedReport.emergencyType ?? ''} ${selectedReport.detectedIndicators?.join(' ') ?? ''} ${selectedReport.description}`;
    const reportTitle = selectedReport.emergencyType?.trim() || 'Emergency Report';
    const timelineEntries = selectedReport.auditTrail?.length
      ? selectedReport.auditTrail
      : [{
          id: `${selectedReport.id}-created`,
          label: 'Emergency report submitted',
          timestamp: new Date(selectedReport.timestamp).toISOString()
        }];
    const submittedTimeLabel = new Date(selectedReport.timestamp).toLocaleString();

    return (
      <div className="flex h-full flex-col bg-white pb-[104px] text-[#0b3850]">
        <div className="grid h-[94px] grid-cols-[40px_1fr] items-end gap-3 bg-white px-5 pb-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          <button
            onClick={() => setSelectedReportId(null)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[#0b3850] transition hover:bg-slate-50"
            aria-label="Back to history"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-[20px] font-extrabold leading-8">Report Detail</h1>
        </div>

        <main className="app-scrollbar flex-1 overflow-y-auto px-5 py-4">
          <div className="mx-auto max-w-sm space-y-4">
            <section className="relative overflow-hidden rounded-[10px] bg-[#14751b] px-5 py-4 text-center text-white">
              <span className="pointer-events-none absolute -right-3 -top-5 flex h-[76px] w-[76px] items-center justify-center rounded-full bg-white/15">
                <CheckCircle2 className="h-11 w-11 text-white/40" />
              </span>
              <div className="relative">
                <p className="text-[18px] font-bold leading-6">Report Sent</p>
                <p className="mx-auto mt-1 max-w-[290px] text-[14px] leading-5 text-white/85">
                  Report received. Stay safe and keep your phone available.
                </p>
              </div>
            </section>

            <article className="rounded-[16px] border border-[#e1e5ea] bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[22px] font-extrabold leading-7">{reportTitle}</h2>
                  <p className="mt-1 text-[13px] font-bold text-[#9aa3b1]">#RPT-001</p>
                </div>
                <span className={`rounded-full border px-3 py-1.5 text-[11px] font-bold ${severityStyles[selectedReport.severity]}`}>
                  {severityLabels[selectedReport.severity]}
                </span>
              </div>

              {selectedReport.photo && (
                <PrivacyImage
                  src={selectedReport.photo}
                  alt="Submitted emergency"
                  allowUnblurred={canViewSensitiveMedia}
                  wrapperClassName="mt-4"
                  className="h-[181px] w-full rounded-[11px] object-cover"
                  privacyRegions={selectedReport.privacyRegions}
                />
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                {reportServices.map(service => (
                  <span
                    key={service}
                    className={`rounded-full px-4 py-1.5 text-[16px] font-medium text-white ${
                      service === 'fire' ? 'bg-[#ff5a0a]' : service === 'ambulance' ? 'bg-[#6da5c4]' : 'bg-[#2563eb]'
                    }`}
                  >
                    {getServiceDisplayLabel(service, reportContext)}
                  </span>
                ))}
              </div>

              <div className="mt-5 space-y-3 text-[16px] leading-5">
                <p className="flex items-center gap-3"><MapPin className="h-[18px] w-[18px] shrink-0" /><span>{selectedReport.location}</span></p>
                <p className="flex items-center gap-3"><Clock className="h-[18px] w-[18px] shrink-0" /><span>{submittedTimeLabel}</span></p>
                <p>Severity scale: <span className="font-extrabold text-[#d21a25]">{selectedReport.injuryScale}/10</span></p>
              </div>

              <div className="mt-5 rounded-xl bg-[#f7f7f7] p-4 text-[13px] text-[#6f7785]">
                <p className="mb-2 text-[14px] font-extrabold text-[#0b3850]">Assessment Summary</p>
                {(selectedReport.detectedIndicators?.length ? selectedReport.detectedIndicators : ['Manual review recommended']).map(item => (
                  <p key={item} className="mt-2">- {item}</p>
                ))}
              </div>

              <div className="mt-5 rounded-xl bg-[#f7f7f7] p-4 text-[#0b3850]">
                <p className="mb-4 text-[20px] font-extrabold leading-7">Response Timeline</p>
                <div className="space-y-4">
                  {timelineEntries.map(entry => (
                    <div key={entry.id} className="border-l-4 border-[#0b3850] py-1 pl-7">
                      <p className="text-[16px] leading-6">{entry.label}</p>
                      <p className="text-[15px] leading-6">{new Date(entry.timestamp).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          </div>
        </main>

        <footer className="absolute bottom-20 left-0 right-0 z-30 grid grid-cols-[50px_50px_1fr] gap-2 bg-white px-5 pb-3 pt-2">
          <button
            onClick={() => {
              if (!accepted) {
                showWaitingToast('Chat');
                return;
              }
              onOpenChat(selectedReport.id);
            }}
            className="flex h-[50px] items-center justify-center rounded-lg bg-[#0b3850] text-white transition hover:bg-[#123f59]"
            aria-label="Open chat"
          >
            <MessageSquare className="h-[18px] w-[18px]" />
          </button>
          <button
            onClick={() => {
              if (!accepted) {
                showWaitingToast('Phone call');
                return;
              }
              toast.success(`Calling assigned responder at ${getServiceContactNumber(primaryService)}`);
              window.location.href = `tel:${getServiceContactNumber(primaryService)}`;
            }}
            className="flex h-[50px] items-center justify-center rounded-lg bg-[#0b3850] text-white transition hover:bg-[#123f59]"
            aria-label="Call responder"
          >
            <Phone className="h-[18px] w-[18px]" />
          </button>
          <button
            onClick={() => {
              if (!accepted) {
                showWaitingToast('Live tracking');
                return;
              }
              onTrack(selectedReport);
            }}
            className={`flex h-[50px] w-full items-center justify-center gap-2 rounded-lg px-3 text-[14px] font-bold text-white shadow-lg transition ${
              accepted ? 'bg-[#cc1420] hover:bg-red-700' : 'bg-[#8a94a6] hover:bg-[#7b8496]'
            }`}
          >
            <Radio className="h-[18px] w-[18px] shrink-0" />
            <span className="truncate">{accepted ? 'Live Track Location' : 'Waiting for Acceptance'}</span>
          </button>
        </footer>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white pb-20 text-[#0b3850]">
      <header className="px-5 pb-[26px] pt-[59px]">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[24px] font-bold leading-8 tracking-normal">{selectedReport ? 'Report Detail' : 'Report'}</h1>
            <p className="mt-1 max-w-[354px] text-[14px] leading-5 text-[#9aa3b1]">{selectedReport ? 'Response status and communication' : 'Reports and related chats are automatically removed after 1 hour.'}</p>
          </div>
          {!selectedReport && reports.length > 0 && (
            <button
              onClick={() => isSelecting ? cancelSelection() : setIsSelecting(true)}
              className="ml-auto flex h-[30px] shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#0c3249] px-4 text-[12px] font-bold leading-6 text-white hover:bg-[#123f59]"
            >
              {isSelecting && <X className="h-4 w-4" />}
              <span>{isSelecting ? 'Cancel' : 'Select'}</span>
            </button>
          )}
        </div>
      </header>
      <main className="app-scrollbar flex-1 space-y-4 overflow-y-auto px-4 pb-4">
        {!selectedReport && isSelecting && (
          <div className="relative flex h-[66px] items-center justify-between overflow-hidden rounded-lg bg-[#9fb0c3] px-5 text-white">
            <span className="pointer-events-none absolute -right-12 -top-9 h-32 w-32 rounded-full bg-white/10" />
            <span className="pointer-events-none absolute right-4 -top-8 h-28 w-28 rounded-full bg-white/10" />
            <span className="relative text-[14px] leading-5">{selectedIds.length} report selected</span>
            <button
              onClick={deleteSelected}
              disabled={selectedIds.length === 0}
              className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-[#d93a45] text-white disabled:cursor-not-allowed disabled:bg-white/70 disabled:text-white"
              aria-label="Delete selected reports"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        )}
        {selectedReport && (
          <div className="space-y-4">
            <button
              onClick={() => setSelectedReportId(null)}
              className="flex items-center gap-2 text-sm text-[#0b3850] hover:text-[#123f59]"
            >
              <ArrowLeft className="h-4 w-4" /> Back to history
            </button>

            <article className="rounded-[24px] border border-[#9fb0c3] bg-white p-5 shadow-[0_4px_10px_rgba(15,23,42,0.18)]">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[20px] font-bold leading-8">{selectedReport.emergencyType ?? 'Emergency Report'}</h2>
                  <p className="text-[10px] font-bold leading-3 text-[#0c3249]/50">#RPT-001</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-[10px] font-bold leading-[15px] tracking-[0.5px] ${severityStyles[selectedReport.severity]}`}>
                  {severityLabels[selectedReport.severity]}
                </span>
              </div>

              {selectedReport.photo && (
                <PrivacyImage
                  src={selectedReport.photo}
                  alt="Submitted emergency"
                  allowUnblurred={canViewSensitiveMedia}
                  wrapperClassName="mb-4"
                  className="max-h-64 w-full rounded-lg object-cover"
                  privacyRegions={selectedReport.privacyRegions}
                />
              )}

              <div className="mb-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {(['all', 'pending', 'responding'] as const).map(filter => (
                  <button
                    key={filter}
                    onClick={() => setServiceFilter(filter)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase leading-4 tracking-[0.5px] ${serviceFilter === filter ? 'bg-[#0b3850] text-white' : 'bg-[#eef2f7] text-[#6b7280]'}`}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              <div className="mb-4 overflow-hidden rounded-2xl border border-[#e5e7eb] bg-[#f8fafc] p-2.5">
                <div className="mb-2 flex items-end justify-between px-0.5">
                  <h3 className="text-[11px] font-semibold uppercase leading-4 tracking-[0.6px] text-[#6b7280]">Emergency Services</h3>
                  <span className="text-[10px] leading-4 text-[#9aa3b1]">Swipe</span>
                </div>
                <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {getReportServices(selectedReport).map(service => {
                    const status = selectedReport.serviceStatuses?.[service] ?? selectedReport.status;
                    if (serviceFilter !== 'all' && status !== serviceFilter) return null;
                    const label = getServiceDisplayLabel(service, `${selectedReport.emergencyType ?? ''} ${selectedReport.detectedIndicators?.join(' ') ?? ''} ${selectedReport.description}`);
                    const statusLabel = status === 'pending' ? 'Pending' : status === 'responding' ? 'Responding' : status === 'arrived' ? 'Arrived' : status === 'done' ? 'Done' : 'Resolved';
                    const active = status === 'responding' || status === 'done';
                    return (
                      <div
                        key={service}
                        className={`min-w-[124px] snap-start shrink-0 rounded-xl border px-3 py-3 ${active ? 'border-[#0c3249]/15 bg-white' : 'border-[#e5e7eb] bg-white/70'}`}
                      >
                        <div className="flex flex-col items-center text-center">
                          <p className="text-[12px] font-bold leading-4 text-[#0b3850]">{label}</p>
                          <span className="mt-1 rounded-full bg-[#f3f4f6] px-2 py-0.5 text-[9px] font-semibold uppercase leading-4 tracking-[0.4px] text-[#6b7280]">
                            {statusLabel}
                          </span>
                        </div>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e5e7eb]">
                          <div
                            className={`h-full rounded-full ${service === 'fire' ? 'bg-[#ff5a0a]' : service === 'ambulance' ? 'bg-[#6da5c4]' : 'bg-[#4f46e5]'}`}
                            style={{ width: status === 'done' ? '100%' : status === 'arrived' ? '82%' : status === 'responding' ? '60%' : '34%' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2 text-[#0b3850]">
                <p className="flex items-center gap-3 text-[12px] leading-5"><MapPin className="h-4 w-4" />{selectedReport.location}</p>
                <p className="flex items-center gap-3 text-[14px] leading-5"><Clock className="h-4 w-4" />{new Date(selectedReport.timestamp).toLocaleString()}</p>
                <p>Severity scale: <span className="font-bold">{selectedReport.injuryScale}/10</span></p>
              </div>

              {selectedReport.detectedIndicators?.length ? (
                <div className="mt-5 rounded-xl bg-[#f7f7f7] p-4">
                  <h3 className="mb-2 font-semibold">Assessment Summary</h3>
                  {selectedReport.detectedIndicators.map(indicator => (
                    <p key={indicator} className="text-sm text-[#6f7785]">- {indicator}</p>
                  ))}
                </div>
              ) : null}

              {selectedReport.assignedUnits && Object.keys(selectedReport.assignedUnits).length > 0 && (
                <div className="mt-5 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-2.5">
                  <h3 className="mb-2 px-0.5 text-[11px] font-semibold uppercase leading-4 tracking-[0.6px] text-blue-200">Assigned Responders</h3>
                  <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {Object.entries(selectedReport.assignedUnits).map(([service, assignment]) => (
                      <div key={service} className="min-w-[138px] snap-start shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-slate-200">
                        <div className="flex flex-col items-center text-center">
                          <p className="text-[11px] font-bold uppercase leading-4 tracking-[0.6px] text-white/70">{service}</p>
                          <span className="mt-1 rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-semibold uppercase leading-4 tracking-[0.4px] text-white/70">ETA</span>
                        </div>
                        <p className="mt-2 text-center text-[13px] font-bold leading-5 text-white">{assignment?.unit}</p>
                        <p className="mt-0.5 text-center text-[11px] leading-4 text-slate-300">{assignment?.etaMinutes} min</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedReport.auditTrail?.length ? (
                <div className="mt-5 rounded-xl bg-[#f7f7f7] p-4">
                  <h3 className="mb-3 text-[14px] font-extrabold text-[#0b3850]">Response Timeline</h3>
                  {selectedReport.auditTrail.map(entry => (
                    <div key={entry.id} className="border-l-2 border-[#0b3850] py-1 pl-4 text-[13px]">
                      <p className="text-[#0b3850]">{entry.label}</p>
                      <p className="mt-1 text-xs text-[#0b3850]">{new Date(entry.timestamp).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-6 border-t border-[#e5e7eb] pt-4" />

              <div className="mt-0 grid grid-cols-[50px_50px_1fr] gap-2 pb-1">
                <button
                  onClick={() => {
                    if (!isReportAccepted(selectedReport)) {
                      showWaitingToast('Chat');
                      return;
                    }
                    onOpenChat(selectedReport.id);
                  }}
                  className="flex h-[50px] items-center justify-center rounded-lg bg-[#0b3850] text-white hover:bg-[#123f59]"
                  aria-label="Open chat"
                >
                  <MessageSquare className="h-[18px] w-[18px]" />
                </button>
                <button
                  onClick={() => {
                    if (!isReportAccepted(selectedReport)) {
                      showWaitingToast('Phone call');
                      return;
                    }
                    if (selectedReport.reporterPhone) {
                      window.location.href = `tel:${selectedReport.reporterPhone}`;
                    }
                  }}
                  className="flex h-[50px] items-center justify-center rounded-lg bg-[#0b3850] text-white hover:bg-[#123f59]"
                  aria-label="Call reporter"
                >
                  <Phone className="h-[18px] w-[18px]" />
                </button>
                <button
                  onClick={() => {
                    if (!isReportAccepted(selectedReport)) {
                      showWaitingToast('Live tracking');
                      return;
                    }
                    onTrack(selectedReport);
                  }}
                  className={`flex h-[50px] w-full items-center justify-center gap-2 rounded-lg px-3 text-[14px] font-bold text-white ${
                    isReportAccepted(selectedReport) ? 'bg-[#cc1420] hover:bg-red-700' : 'bg-[#8a94a6] hover:bg-[#7b8496]'
                  }`}
                >
                  <Radio className="h-[18px] w-[18px] shrink-0" />
                  <span className="truncate">{isReportAccepted(selectedReport) ? 'Live Track Location' : 'Waiting for Acceptance'}</span>
                </button>
              </div>
            </article>
          </div>
        )}

        {!selectedReport && (
          <>
        {reports.length === 0 && (
          <div className="flex h-[118px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#c5cbd4] bg-white px-12 py-5 text-center">
            <p className="text-[18px] font-bold leading-7 text-[#c5cbd4]">No reports yet</p>
            <p className="mt-1 text-[14px] leading-5 text-[#c5cbd4]">Submitted emergency reports<br />will appear here.</p>
          </div>
        )}
        {reports.map(report => (
          <article
            key={report.id}
            className={`relative rounded-[24px] border bg-white p-5 ${
              selectedIds.includes(report.id) ? 'border-[#e1e5ea]' : 'border-[#e1e5ea]'
            }`}
          >
            {isSelecting && (
              <button
                onClick={() => toggleSelected(report.id)}
                className="absolute inset-0 z-10 rounded-[24px]"
                aria-label={`${selectedIds.includes(report.id) ? 'Deselect' : 'Select'} report`}
              />
            )}
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[20px] font-bold leading-8">{report.emergencyType ?? 'Emergency Report'}</h2>
                <p className="text-[10px] font-bold leading-3 text-[#0c3249]/50">#RPT-001</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full border px-3 py-1 text-[10px] font-bold leading-[15px] tracking-[0.5px] ${severityStyles[report.severity]}`}>
                  {severityLabels[report.severity]}
                </span>
                {isSelecting && (
                  <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                    selectedIds.includes(report.id) ? 'bg-[#0b3850] text-white' : 'bg-slate-300'
                  }`}>
                    {selectedIds.includes(report.id) && <span className="h-3 w-3 rounded-full bg-white" />}
                  </span>
                )}
              </div>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {getReportServices(report).map(service => (
                <span key={service} className={`rounded-full px-4 py-1.5 text-[12px] leading-5 text-white ${
                  service === 'fire' ? 'bg-[#ff5a0a]' : service === 'ambulance' ? 'bg-[#6da5c4]' : 'bg-[#2563eb]'
                }`}>
                  {getServiceDisplayLabel(service, `${report.emergencyType ?? ''} ${report.detectedIndicators?.join(' ') ?? ''} ${report.description}`)}
                </span>
              ))}
            </div>
            <div className="space-y-2 text-[#0b3850]">
              <p className="flex items-center gap-3 text-[12px] leading-5"><MapPin className="h-4 w-4 shrink-0" />{report.location}</p>
              <p className="flex items-center gap-3 text-[14px] leading-5"><Clock className="h-4 w-4 shrink-0" />{new Date(report.timestamp).toLocaleString()}</p>
            </div>
            <button
              onClick={() => setSelectedReportId(report.id)}
              disabled={isSelecting}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#0c3249] text-[16px] font-bold leading-6 text-white hover:bg-[#123f59] disabled:bg-slate-200"
            >
              <Eye className="h-5 w-5" /> Details
            </button>
          </article>
        ))}
          </>
        )}
      </main>
    </div>
  );
}
