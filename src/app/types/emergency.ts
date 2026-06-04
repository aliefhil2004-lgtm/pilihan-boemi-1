export type ServiceType = 'ambulance' | 'fire' | 'police';
export type ReportStatus = 'pending' | 'responding' | 'resolved';

export interface StoredEmergencyReport {
  id: string;
  photo: string | null;
  description: string;
  location: string;
  emergencyType?: string;
  severity: 'minor' | 'moderate' | 'severe' | 'critical';
  injuryScale: number;
  timestamp: string | Date;
  status: ReportStatus;
  service?: ServiceType;
  services?: ServiceType[];
  serviceStatuses?: Partial<Record<ServiceType, ReportStatus>>;
  reporterPhone?: string;
  detectedIndicators?: string[];
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
  if (values.some(status => status === 'responding' || status === 'resolved')) {
    return 'responding';
  }
  return 'pending';
}
