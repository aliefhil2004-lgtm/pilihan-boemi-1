import type { StoredEmergencyReport } from '../types/emergency';
import { deleteReportsFromFirebase, syncReportToFirebase, syncReportsToFirebase } from './firebaseSync';

const REPORT_STORAGE_KEY = 'emergencyReports';
const CHAT_STORAGE_KEY = 'emergencyChats';
const RESET_VERSION_KEY = 'emergencyHistoryResetVersion';
const CURRENT_RESET_VERSION = '2026-06-02-v1';
export const REPORT_RETENTION_MS = 60 * 60 * 1000;

function readReports(): StoredEmergencyReport[] {
  return JSON.parse(localStorage.getItem(REPORT_STORAGE_KEY) || '[]');
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
  localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify([report, ...reports]));
  window.dispatchEvent(new Event('emergency-reports-updated'));
  void syncReportToFirebase(report);
}

export function replaceReports(reports: StoredEmergencyReport[]) {
  localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(reports));
  window.dispatchEvent(new Event('emergency-reports-updated'));
  void syncReportsToFirebase(reports);
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
  void deleteReportsFromFirebase(reportIds);
}

export function resetPreviousHistoryOnce() {
  if (localStorage.getItem(RESET_VERSION_KEY) === CURRENT_RESET_VERSION) return;
  clearReportHistory();
  localStorage.setItem(RESET_VERSION_KEY, CURRENT_RESET_VERSION);
}
