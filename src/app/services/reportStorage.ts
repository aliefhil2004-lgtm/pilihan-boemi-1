import type { StoredEmergencyReport } from '../types/emergency';
import { deleteReportsFromFirebase, syncReportToFirebase, syncReportsToFirebase } from './firebaseSync';
import { createIncident, deleteIncidents } from './incidentsApi';

const REPORT_STORAGE_KEY = 'emergencyReports';
const CHAT_STORAGE_KEY = 'emergencyChats';
const RESET_VERSION_KEY = 'emergencyHistoryResetVersion';
const CURRENT_RESET_VERSION = '2026-06-02-v1';
export const REPORT_RETENTION_MS = 60 * 60 * 1000;
const MAX_SYNC_RETRIES = 5;

function readReports(): StoredEmergencyReport[] {
  return JSON.parse(localStorage.getItem(REPORT_STORAGE_KEY) || '[]');
}

export function createNextReportCode(): string {
  const reports = readReports();
  const maxNumber = reports.reduce((max, report) => {
    const value = report.reportCode?.match(/RPT-(\d+)/)?.[1];
    return value ? Math.max(max, Number(value)) : max;
  }, 0);

  return `RPT-${String(maxNumber + 1).padStart(3, '0')}`;
}

export function cleanupExpiredReports(now = Date.now()): StoredEmergencyReport[] {
  const reports = readReports();
  const activeReports = reports.filter(report => {
    const timestamp = new Date(report.timestamp).getTime();
    return Number.isFinite(timestamp) && now - timestamp < REPORT_RETENTION_MS;
  });

  if (activeReports.length !== reports.length) {
    const activeIds = new Set(activeReports.map(report => report.id));
    const expiredIds = reports.filter(report => !activeIds.has(report.id)).map(report => report.id);
    const chats = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || '{}') as Record<string, unknown>;
    const activeChats = Object.fromEntries(
      Object.entries(chats).filter(([reportId]) => activeIds.has(reportId))
    );
    localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(activeReports));
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(activeChats));
    window.dispatchEvent(new Event('emergency-reports-updated'));
    void deleteReportsFromFirebase(expiredIds);
  }

  return activeReports;
}

export function saveReport(report: StoredEmergencyReport) {
  const reports = cleanupExpiredReports();
  const nextReport = {
    ...report,
    reportCode: report.reportCode ?? createNextReportCode()
  };
  localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify([nextReport, ...reports]));
  window.dispatchEvent(new Event('emergency-reports-updated'));

  if (
    nextReport.offlineSyncStatus === 'queued-for-sync' ||
    (typeof navigator !== 'undefined' && !navigator.onLine)
  ) {
    return;
  }

  void syncOneReport(nextReport);
}

function updateReportSyncState(
  reportId: string,
  offlineSyncStatus: StoredEmergencyReport['offlineSyncStatus'],
  syncAttempts?: number
) {
  const reports = readReports();
  const updatedReports = reports.map(report =>
    report.id === reportId ? { ...report, offlineSyncStatus, syncAttempts: syncAttempts ?? report.syncAttempts } : report
  );
  localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(updatedReports));
  window.dispatchEvent(new Event('emergency-reports-updated'));
}

async function syncOneReport(report: StoredEmergencyReport) {
  const attempts = (report.syncAttempts ?? 0) + 1;
  updateReportSyncState(report.id, 'syncing', attempts);
  try {
    try {
      await createIncident({ ...report, syncAttempts: attempts, offlineSyncStatus: 'syncing' });
    } catch (error) {
      console.warn('Incident API unavailable; falling back to authenticated Firestore sync.', error);
    }
    await syncReportToFirebase({ ...report, syncAttempts: attempts, offlineSyncStatus: 'syncing' });
    updateReportSyncState(report.id, 'online-synced', attempts);
  } catch {
    updateReportSyncState(report.id, 'sync-failed', attempts);
    if (attempts < MAX_SYNC_RETRIES && typeof navigator !== 'undefined' && navigator.onLine) {
      window.setTimeout(() => {
        const latest = readReports().find(item => item.id === report.id);
        if (latest && latest.offlineSyncStatus !== 'online-synced') void syncOneReport(latest);
      }, Math.min(30_000, 1000 * 2 ** attempts));
    }
  }
}

export function syncQueuedReports() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  const queuedReports = cleanupExpiredReports().filter(report =>
    report.offlineSyncStatus === 'queued-for-sync' || report.offlineSyncStatus === 'sync-failed'
  );
  queuedReports.forEach(report => {
    void syncOneReport(report);
  });
}

export function replaceReports(reports: StoredEmergencyReport[], syncCloud = true) {
  localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(reports));
  window.dispatchEvent(new Event('emergency-reports-updated'));
  if (syncCloud) void syncReportsToFirebase(reports);
}

export function clearReportHistory() {
  localStorage.setItem(REPORT_STORAGE_KEY, '[]');
  localStorage.setItem(CHAT_STORAGE_KEY, '{}');
  window.dispatchEvent(new Event('emergency-reports-updated'));
  window.dispatchEvent(new Event('emergency-chat-updated'));
}

export function deleteReports(reportIds: string[]) {
  const ids = new Set(reportIds);
  const reports = readReports().filter(report => !ids.has(report.id));
  const chats = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || '{}') as Record<string, unknown>;
  const remainingChats = Object.fromEntries(
    Object.entries(chats).filter(([reportId]) => !ids.has(reportId))
  );

  localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(reports));
  localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(remainingChats));
  window.dispatchEvent(new Event('emergency-reports-updated'));
  window.dispatchEvent(new Event('emergency-chat-updated'));
  void deleteIncidents(reportIds).catch(() => deleteReportsFromFirebase(reportIds));
}

export function resetPreviousHistoryOnce() {
  if (localStorage.getItem(RESET_VERSION_KEY) === CURRENT_RESET_VERSION) return;
  clearReportHistory();
  localStorage.setItem(RESET_VERSION_KEY, CURRENT_RESET_VERSION);
}
