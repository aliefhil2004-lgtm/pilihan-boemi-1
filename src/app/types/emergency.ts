export type ServiceType = 'ambulance' | 'fire' | 'police';
export type ReportStatus = 'pending' | 'responding' | 'arrived' | 'resolved';

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
  action: 'report_created' | 'unit_dispatched' | 'unit_arrived' | 'report_resolved';
  label: string;
  timestamp: string;
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

export interface StoredEmergencyReport {
  id: string;
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
  serviceStatuses?: Partial<Record<ServiceType, ReportStatus>>;
  assignedUnits?: Partial<Record<ServiceType, UnitAssignment>>;
  auditTrail?: AuditEntry[];
  reporterPhone?: string;
  detectedIndicators?: string[];
  privacyRegions?: PrivacyRegion[];
  countryCode?: string;
}

export function getReportServices(
  report: Pick<StoredEmergencyReport, 'service' | 'services'>
): ServiceType[] {
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

export function getOverallStatus(
  statuses: Partial<Record<ServiceType, ReportStatus>>,
  fallback: ReportStatus = 'pending'
): ReportStatus {
  const values = Object.values(statuses);
  if (!values.length) return fallback;
  if (values.every(status => status === 'resolved')) return 'resolved';
  if (
    values.some(status => status === 'arrived') &&
    values.every(status => status === 'arrived' || status === 'resolved')
  ) {
    return 'arrived';
  }
  if (values.some(status => status === 'responding' || status === 'arrived' || status === 'resolved')) {
    return 'responding';
  }
  return 'pending';
}
