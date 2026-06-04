import { useEffect, useState } from 'react';
import { ArrowLeft, Clock, Eye, MapPin, MessageSquare, Navigation, ShieldCheck, Trash2 } from 'lucide-react';
import { getReportServices, type StoredEmergencyReport } from '../types/emergency';
import { cleanupExpiredReports, clearReportHistory } from '../services/reportStorage';

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

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-gray-900 to-black pb-20 text-white">
      <header className="border-b border-gray-800 py-5 pl-20 pr-5 sm:pr-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold">{selectedReport ? 'Report Details' : 'Report History'}</h1>
            <p className="text-sm text-gray-400">{selectedReport ? 'Response status and communication' : 'Review submitted emergency reports'}</p>
          </div>
          {!selectedReport && <button
            onClick={() => {
              clearReportHistory();
              setReports([]);
            }}
            className="ml-auto flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/15 text-red-300 hover:bg-red-500/25 sm:w-auto sm:px-3"
            aria-label="Clear report history"
          >
            <Trash2 className="h-4 w-4" /> <span className="hidden sm:inline">Clear History</span>
          </button>}
        </div>
        <p className="mt-3 text-xs text-gray-500">Reports and related chats are automatically removed after 1 hour.</p>
      </header>
      <main className="app-scrollbar flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        {selectedReport && (
          <div className="space-y-4">
            <button
              onClick={() => setSelectedReportId(null)}
              className="flex items-center gap-2 text-sm text-blue-300 hover:text-blue-200"
            >
              <ArrowLeft className="h-4 w-4" /> Back to history
            </button>

            <article className="rounded-lg border border-gray-700 bg-gray-800/70 p-5">
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
                  className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold hover:bg-blue-700"
                >
                  <Navigation className="h-4 w-4" /> Emergency Response
                </button>
              </div>
            </article>
          </div>
        )}

        {!selectedReport && (
          <>
        {reports.length === 0 && <p className="py-20 text-center text-gray-500">No reports yet</p>}
        {reports.map(report => (
          <article key={report.id} className="rounded-lg border border-gray-700 bg-gray-800/70 p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold">{report.emergencyType ?? 'Emergency Report'}</h2>
                <p className="mt-1 text-sm text-gray-300">{report.description || 'Image-based emergency report'}</p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-bold capitalize ${statusStyles[report.status]}`}>
                {report.status}
              </span>
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
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold hover:bg-blue-700"
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
