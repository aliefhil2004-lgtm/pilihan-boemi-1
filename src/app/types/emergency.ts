export type ServiceType = 'ambulance' | 'fire' | 'police';
export type ResponseRole = ServiceType | 'disaster-response';
export type ReportStatus = 'pending' | 'responding' | 'arrived' | 'resolved' | 'done' | 'declined';

export interface UnitAssignment {
  unit: string;
  assignedAt: string;
  etaMinutes: number;
  distanceKm: number;
  origin: { lat: number; lng: number };
}

export interface AuditEntry {
  id: string;
  service: ServiceType;
  action:
    | 'report_created'
    | 'ai_triage_completed'
    | 'manual_review_required'
    | 'human_override'
    | 'unit_dispatched'
    | 'unit_arrived'
    | 'report_resolved'
    | 'report_declined';
  label: string;
  timestamp: string;
  operatorId?: string;
  reason?: string;
}

export interface PrivacyRegion {
  label: string;
  left: number;
  top: number;
  width: number;
  height: number;
  confidence?: number;
  normalized?: boolean;
}

export interface EvidenceMetadata {
  source: 'camera' | 'upload' | 'unknown';
  capturedAt?: string;
  fileLastModifiedAt?: string;
  mimeType?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  gpsAccuracyMeters?: number;
  fingerprint?: string;
}

export interface StoredEmergencyReport {
  id: string;
  reportCode?: string;
  photo: string | null;
  description: string;
  location: string;
  coords?: { lat: number; lng: number };
  emergencyType?: string;
  severity: 'minor' | 'moderate' | 'severe' | 'critical';
  injuryScale: number;
  timestamp: string | Date;
  status: ReportStatus;
  service?: ServiceType;
  services?: ServiceType[];
  responsePlan?: ResponseRole[];
  priorityRole?: ResponseRole;
  serviceStatuses?: Partial<Record<ServiceType, ReportStatus>>;
  assignedUnits?: Partial<Record<ServiceType, UnitAssignment>>;
  auditTrail?: AuditEntry[];
  reporterUid?: string;
  reporterName?: string;
  reporterEmail?: string;
  reporterPhone?: string;
  declineReasons?: Partial<Record<ServiceType, string>>;
  declinedAt?: string;
  detectedIndicators?: string[];
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
  evidenceMetadata?: EvidenceMetadata;
  anonymizationStatus?: 'not-needed' | 'queued' | 'anonymized';
  offlineSyncStatus?: 'online-synced' | 'queued-for-sync' | 'syncing' | 'sync-failed';
  syncAttempts?: number;
  countryCode?: string;
  serviceClosureReports?: Partial<Record<ServiceType, {
    outcome: string;
    summary: string;
    photo: string | null;
    closedAt: string;
  }>>;
}

export function getReportServices(
  report: Pick<StoredEmergencyReport, 'service' | 'services' | 'responsePlan'>
): ServiceType[] {
  if (report.responsePlan?.length) {
    return report.responsePlan.filter((service): service is ServiceType => service === 'ambulance' || service === 'fire' || service === 'police');
  }
  if (report.services?.length) return [...new Set(report.services)];
  return [report.service ?? 'ambulance'];
}

export function createServiceStatuses(
  services: ServiceType[],
  status: ReportStatus = 'pending'
): Partial<Record<ServiceType, ReportStatus>> {
  return Object.fromEntries(services.map(service => [service, status]));
}

export function getServiceStatus(
  report: StoredEmergencyReport,
  service: ServiceType
): ReportStatus {
  return report.serviceStatuses?.[service] ?? report.status;
}

export function formatReportCode(report: Pick<StoredEmergencyReport, 'id' | 'reportCode'>): string {
  if (report.reportCode) return report.reportCode;
  const numericId = report.id.match(/\d+/)?.[0] ?? report.id;
  return `RPT-${numericId.slice(-3).padStart(3, '0')}`;
}

export function getOverallStatus(
  statuses: Partial<Record<ServiceType, ReportStatus>>,
  fallback: ReportStatus = 'pending'
): ReportStatus {
  const values = Object.values(statuses);
  if (!values.length) return fallback;
  if (values.every(status => status === 'resolved')) return 'resolved';
  if (values.every(status => status === 'done')) return 'done';
  if (values.every(status => status === 'declined')) return 'declined';
  if (
    values.some(status => status === 'arrived') &&
    values.every(status => status === 'arrived' || status === 'resolved')
  ) {
    return 'arrived';
  }
  if (values.some(status => status === 'responding' || status === 'arrived' || status === 'resolved' || status === 'done')) {
    return 'responding';
  }
  return 'pending';
}
