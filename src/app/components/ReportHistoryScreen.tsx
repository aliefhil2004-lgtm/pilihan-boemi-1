import { useEffect, useState } from 'react';
import { ArrowLeft, Clock, Eye, MapPin, MessageSquare, Navigation, Trash2, X } from 'lucide-react';
import { getReportServices, type StoredEmergencyReport } from '../types/emergency';
import { cleanupExpiredReports, deleteReports } from '../services/reportStorage';

interface ReportHistoryScreenProps {
  initialReportId?: string | null;
  onOpenChat: (reportId: string) => void;
  onTrack: (report: StoredEmergencyReport) => void;
}

const statusStyles = {
  pending: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300',
  responding: 'border-blue-500/40 bg-blue-500/10 text-blue-300',
  resolved: 'border-green-500/40 bg-green-500/10 text-green-300'
};

export function ReportHistoryScreen({ initialReportId, onOpenChat, onTrack }: ReportHistoryScreenProps) {
  const [reports, setReports] = useState<StoredEmergencyReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(initialReportId ?? null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-gray-900 to-black pb-20 text-white">
      <header className="border-b border-gray-800 px-5 py-5 sm:px-6">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold">{selectedReport ? 'Report Details' : 'Report History'}</h1>
            <p className="text-sm text-gray-400">{selectedReport ? 'Response status and communication' : 'Review submitted emergency reports'}</p>
          </div>
          {!selectedReport && reports.length > 0 && (
            <button
              onClick={() => isSelecting ? cancelSelection() : setIsSelecting(true)}
              className="ml-auto flex h-10 items-center justify-center gap-2 rounded-lg bg-gray-800 px-3 text-gray-200 hover:bg-gray-700"
            >
              {isSelecting && <X className="h-4 w-4" />}
              <span className="text-sm">{isSelecting ? 'Cancel' : 'Select'}</span>
            </button>
          )}
        </div>
        <p className="mt-3 text-xs text-gray-500">Reports and related chats are automatically removed after 1 hour.</p>
      </header>
      <main className="app-scrollbar flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        {!selectedReport && isSelecting && (
          <div className="flex items-center justify-between rounded-xl border border-gray-700 bg-gray-800/80 p-3">
            <span className="text-sm text-gray-300">{selectedIds.length} report selected</span>
            <button
              onClick={deleteSelected}
              disabled={selectedIds.length === 0}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-500"
            >
              <Trash2 className="h-4 w-4" /> Delete Selected
            </button>
          </div>
        )}
        {selectedReport && (
          <div className="space-y-4">
            <button
              onClick={() => setSelectedReportId(null)}
              className="flex items-center gap-2 text-sm text-blue-300 hover:text-blue-200"
            >
              <ArrowLeft className="h-4 w-4" /> Back to history
            </button>

            <article className="rounded-xl border border-gray-700/80 bg-gray-800/70 p-4 sm:p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">{selectedReport.emergencyType ?? 'Emergency Report'}</h2>
                  <p className="mt-1 text-sm text-gray-300">{selectedReport.description || 'Image-based emergency report'}</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-bold capitalize ${statusStyles[selectedReport.status]}`}>
                  {selectedReport.status}
                </span>
              </div>

              {selectedReport.photo && (
                <img src={selectedReport.photo} alt="Submitted emergency" className="mb-4 max-h-64 w-full rounded-xl object-cover" />
              )}

              <div className="mb-4 flex flex-wrap gap-2">
                {getReportServices(selectedReport).map(service => (
                  <span key={service} className="rounded-full bg-gray-700 px-3 py-1 text-xs capitalize">{service}</span>
                ))}
              </div>

              <div className="space-y-2 text-sm text-gray-300">
                <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-green-400" />{selectedReport.location}</p>
                <p className="flex items-center gap-2"><Clock className="h-4 w-4 text-orange-400" />{new Date(selectedReport.timestamp).toLocaleString()}</p>
                <p>Severity scale: <span className="font-bold">{selectedReport.injuryScale}/10</span></p>
              </div>

              {selectedReport.detectedIndicators?.length ? (
                <div className="mt-5 rounded-xl border border-gray-700 bg-gray-900/50 p-4">
                  <h3 className="mb-2 font-semibold">Assessment Summary</h3>
                  {selectedReport.detectedIndicators.map(indicator => (
                    <p key={indicator} className="text-sm text-gray-400">- {indicator}</p>
                  ))}
                </div>
              ) : null}

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button onClick={() => onOpenChat(selectedReport.id)} className="flex items-center justify-center gap-2 rounded-xl bg-gray-700 py-3 text-sm font-semibold hover:bg-gray-600">
                  <MessageSquare className="h-4 w-4" /> Chat
                </button>
                <button
                  onClick={() => onTrack(selectedReport)}
                  disabled={selectedReport.status === 'pending'}
                  className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
                >
                  <Navigation className="h-4 w-4" />
                  {selectedReport.status === 'pending' ? 'Waiting for Acceptance' : 'Emergency Response'}
                </button>
              </div>
            </article>
          </div>
        )}

        {!selectedReport && (
          <>
        {reports.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900/40 px-5 py-16 text-center">
            <p className="font-medium text-gray-300">No reports yet</p>
            <p className="mt-1 text-sm text-gray-500">Submitted emergency reports will appear here.</p>
          </div>
        )}
        {reports.map(report => (
          <article
            key={report.id}
            className={`relative rounded-xl border bg-gray-800/70 p-4 ${
              selectedIds.includes(report.id) ? 'border-blue-500 ring-1 ring-blue-500/50' : 'border-gray-700'
            }`}
          >
            {isSelecting && (
              <button
                onClick={() => toggleSelected(report.id)}
                className="absolute inset-0 z-10 rounded-lg"
                aria-label={`${selectedIds.includes(report.id) ? 'Deselect' : 'Select'} report`}
              />
            )}
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold">{report.emergencyType ?? 'Emergency Report'}</h2>
                <p className="mt-1 text-sm text-gray-300">{report.description || 'Image-based emergency report'}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full border px-3 py-1 text-xs font-bold capitalize ${statusStyles[report.status]}`}>
                  {report.status}
                </span>
                {isSelecting && (
                  <span className={`flex h-6 w-6 items-center justify-center rounded border ${
                    selectedIds.includes(report.id) ? 'border-blue-400 bg-blue-500 text-white' : 'border-gray-500'
                  }`}>
                    {selectedIds.includes(report.id) && <span className="h-2.5 w-2.5 rounded-full bg-white" />}
                  </span>
                )}
              </div>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              {getReportServices(report).map(service => (
                <span key={service} className="rounded-full bg-gray-700 px-3 py-1 text-xs capitalize">{service}</span>
              ))}
            </div>
            <div className="space-y-1 text-xs text-gray-400">
              <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" />{report.location}</p>
              <p className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" />{new Date(report.timestamp).toLocaleString()}</p>
            </div>
            <button
              onClick={() => setSelectedReportId(report.id)}
              disabled={isSelecting}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold hover:bg-blue-700 disabled:bg-gray-700"
            >
              <Eye className="h-4 w-4" /> Details
            </button>
          </article>
        ))}
          </>
        )}
      </main>
    </div>
  );
}
