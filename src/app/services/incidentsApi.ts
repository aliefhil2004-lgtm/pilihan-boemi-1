import type { ReportStatus, ServiceType, StoredEmergencyReport, UnitAssignment } from '../types/emergency';
import { firebaseAuth } from './firebase';

async function request(path: string, options?: RequestInit) {
  const token = await firebaseAuth?.currentUser?.getIdToken();
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {})
    }
  });
  if (!response.ok) throw new Error((await response.json()).error ?? 'Incident API request failed');
  return response.json();
}

export async function createIncident(report: StoredEmergencyReport) {
  return request('/api/incidents', {
    method: 'POST',
    body: JSON.stringify({ report: { ...report, photo: report.photo?.startsWith('data:') ? null : report.photo } })
  });
}

export async function updateIncidentStatus(
  reportId: string,
  service: ServiceType,
  status: ReportStatus,
  assignment?: UnitAssignment
) {
  return request('/api/incidents', {
    method: 'PATCH',
    body: JSON.stringify({ reportId, service, status, assignment })
  });
}

export async function deleteIncidents(reportIds: string[]) {
  return request('/api/incidents', { method: 'DELETE', body: JSON.stringify({ reportIds }) });
}
