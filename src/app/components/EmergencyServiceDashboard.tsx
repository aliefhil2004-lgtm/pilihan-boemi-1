import { useRef, useState, useEffect } from 'react';
import { Ambulance, Flame, Shield, Clock, MapPin, AlertTriangle, Phone, Navigation, Filter, Radio, Edit, MessageSquare, ImageOff, ArrowLeft, User, CheckCircle2, Siren, Camera, Upload, ChevronDown, Home, XCircle } from 'lucide-react';
import { EmergencyMap } from './EmergencyMap.tsx';
import { IPhoneStatusBar } from './IPhoneStatusBar';
import { toast } from 'sonner';
import { clearLiveGps, publishLiveGps } from '../services/liveGps';
import { LocationPicker } from './LocationPicker';
import { createServiceStatuses, formatReportCode, getOverallStatus, getReportServices, getServiceStatus, type AuditEntry, type ReportStatus, type ServiceType, type StoredEmergencyReport, type UnitAssignment } from '../types/emergency';
import { cleanupExpiredReports, replaceReports } from '../services/reportStorage';
import type { AseanCountry } from '../config/asean';
import { citizenContactNumber } from '../config/contacts';
import { serviceUnitConfig } from '../config/serviceUnits';
import { fetchDrivingRoute } from '../services/routing';
import type { DrivingRoute } from '../services/routing';
import { updateIncidentStatus } from '../services/incidentsApi';
import { PrivacyImage } from './PrivacyImage';
import { getServiceDisplayLabel } from '../utils/serviceLabels';
import { formatReportDateTime } from '../utils/date';

type EmergencyReport = Omit<StoredEmergencyReport, 'timestamp'> & {
  timestamp: Date;
};

interface UnitCandidate extends UnitAssignment {
  recommended?: boolean;
}

interface EmergencyServiceDashboardProps {
  serviceType: ServiceType;
  onOpenChat: (reportId: string) => void;
  onCallCitizen: (report: EmergencyReport) => void;
  onBack: () => void;
  country: AseanCountry;
  currentLocation: string;
  currentCoords: { lat: number; lng: number };
  canViewSensitiveMedia: boolean;
  serviceDisplayName?: string;
  onOpenProfile?: () => void;
}

export function EmergencyServiceDashboard({ serviceType, onOpenChat, onCallCitizen, onBack, country, currentLocation, currentCoords, canViewSensitiveMedia, serviceDisplayName, onOpenProfile }: EmergencyServiceDashboardProps) {
  const [reports, setReports] = useState<EmergencyReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<EmergencyReport | null>(null);
  const [detailMode, setDetailMode] = useState<'detail' | 'closure'>('detail');
  const [filter, setFilter] = useState<'all' | 'pending' | 'responding'>('pending');
  const [isSelectingReports, setIsSelectingReports] = useState(false);
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);
  const [declineReason, setDeclineReason] = useState('');
  const [sharingGpsReportId, setSharingGpsReportId] = useState<string | null>(null);
  const [detailRoute, setDetailRoute] = useState<DrivingRoute | null>(null);
  const [closureOutcome, setClosureOutcome] = useState('resolved');
  const [closureSummary, setClosureSummary] = useState('');
  const [closurePhoto, setClosurePhoto] = useState<string | null>(null);
  const [isClosureCameraOpen, setIsClosureCameraOpen] = useState(false);
  const closurePhotoInputRef = useRef<HTMLInputElement>(null);
  const closureVideoRef = useRef<HTMLVideoElement>(null);
  const closureCameraStreamRef = useRef<MediaStream | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [unitCandidates, setUnitCandidates] = useState<UnitCandidate[]>([]);
  const [isCalculatingUnits, setIsCalculatingUnits] = useState(false);
  const [serviceLocation, setServiceLocation] = useState({
    address: currentLocation,
    coords: currentCoords
  });

  useEffect(() => {
    setServiceLocation({
      address: currentLocation,
      coords: currentCoords
    });
  }, [currentCoords.lat, currentCoords.lng, currentLocation]);

  useEffect(() => {
  const loadReports = () => {
    const savedReports = cleanupExpiredReports();

    // convert timestamp string jadi Date lagi
    const formattedReports = savedReports.map((report: any) => ({
      ...report,
      timestamp: new Date(report.timestamp)
    }));

    setReports(formattedReports);
  };

  // load pertama kali
  loadReports();

  // auto refresh tiap 2 detik
  const interval = setInterval(loadReports, 2000);

  return () => clearInterval(interval);
}, []);

  const serviceIcons = {
    ambulance: Ambulance,
    fire: Flame,
    police: Shield
  };

  const serviceColors = {
    ambulance: { bg: 'bg-blue-600', gradient: 'from-blue-500 to-blue-700', text: 'text-blue-400', border: 'border-blue-500' },
    fire: { bg: 'bg-orange-600', gradient: 'from-orange-500 to-orange-700', text: 'text-orange-400', border: 'border-orange-500' },
    police: { bg: 'bg-indigo-600', gradient: 'from-indigo-500 to-indigo-700', text: 'text-indigo-400', border: 'border-indigo-500' }
  };
  const serviceTheme = {
    ambulance: {
      header: 'linear-gradient(180deg, #679CBC 0%, #A6DBFE 100%)',
      accent: '#679CBC',
      iconBg: 'rgba(255,255,255,0.2)',
      title: 'Ambulance Response'
    },
    fire: {
      header: 'linear-gradient(180deg, #FF7A1A 0%, #FFB272 100%)',
      accent: '#FF5C00',
      iconBg: 'rgba(255,255,255,0.2)',
      title: 'Fire Response'
    },
    police: {
      header: 'linear-gradient(180deg, #2563EB 0%, #93C5FD 100%)',
      accent: '#2563EB',
      iconBg: 'rgba(255,255,255,0.2)',
      title: 'Police Response'
    }
  };

  const ServiceIcon = serviceIcons[serviceType];
  const colors = serviceColors[serviceType];
  const theme = serviceTheme[serviceType];
  const serviceTitle = serviceDisplayName?.trim() || theme.title;
  const unitIds = {
    ambulance: serviceUnitConfig.ambulance.unit,
    fire: serviceUnitConfig.fire.unit,
    police: serviceUnitConfig.police.unit
  };
  const unitPrefixes = {
    ambulance: serviceUnitConfig.ambulance.prefix,
    fire: serviceUnitConfig.fire.prefix,
    police: serviceUnitConfig.police.prefix
  };
  const allServiceReports = reports.filter(r =>
    getReportServices(r).includes(serviceType) &&
    (!r.countryCode || r.countryCode === country.code)
  );
  const serviceReports = allServiceReports.filter(r => !['done', 'declined'].includes(getServiceStatus(r, serviceType)));

  const filteredReports = serviceReports.filter(r =>
    filter === 'all'
      ? true
      : filter === 'responding'
      ? ['responding', 'arrived'].includes(getServiceStatus(r, serviceType))
      : getServiceStatus(r, serviceType) === filter
  ).sort((a, b) => b.injuryScale - a.injuryScale);
  const doneReportsCount = allServiceReports.filter(r => getServiceStatus(r, serviceType) === 'done').length;

  const getInjuryScaleColor = (scale: number) => {
    if (scale >= 8) return 'text-red-500';
    if (scale >= 5) return 'text-yellow-500';
    return 'text-blue-500';
  };

  const getInjuryScaleHex = (scale: number) => {
    if (scale >= 8) return '#dc2626';
    if (scale >= 5) return '#eab308';
    return '#2563eb';
  };

  const getInjuryScaleLabel = (scale: number) => {
    if (scale >= 8) return 'HIGH';
    if (scale >= 5) return 'MEDIUM';
    return 'LOW';
  };

  const getScaleLevelLabel = (scale: number) => {
    if (scale >= 8) return 'High';
    if (scale >= 5) return 'Medium';
    return 'Low';
  };

  const createAuditEntry = (
    action: AuditEntry['action'],
    label: string
  ): AuditEntry => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    service: serviceType,
    action,
    label,
    timestamp: new Date().toISOString()
  });

  const persistStatusUpdate = (
    updatedReports: EmergencyReport[],
    reportId: string,
    status: ReportStatus,
    assignment?: UnitAssignment
  ) => {
    setReports(updatedReports);
    replaceReports(updatedReports, false);
    void updateIncidentStatus(reportId, serviceType, status, assignment)
      .catch(() => replaceReports(updatedReports));
  };

  const calculateNearestUnits = async (report: EmergencyReport) => {
    setIsCalculatingUnits(true);
    const destination = report.coords ?? country.center;
    const offsets = [
      { lat: 0, lng: 0 },
      { lat: 0.018, lng: -0.012 },
      { lat: -0.014, lng: 0.016 }
    ];
    const candidates = await Promise.all(offsets.map(async (offset, index) => {
      const origin = {
        lat: serviceLocation.coords.lat + offset.lat,
        lng: serviceLocation.coords.lng + offset.lng
      };
      const route = await fetchDrivingRoute(origin, destination);
      const unitNumber = serviceUnitConfig[serviceType].baseNumber + index;
      return {
        unit: `${unitPrefixes[serviceType]}-${String(unitNumber).padStart(2, '0')}`,
        assignedAt: new Date().toISOString(),
        etaMinutes: route ? Math.max(1, Math.ceil(route.durationSeconds / 60)) : 99,
        distanceKm: route ? route.distanceMeters / 1000 : 99,
        origin
      };
    }));
    candidates.sort((a, b) => a.etaMinutes - b.etaMinutes);
    setUnitCandidates(candidates.map((candidate, index) => ({ ...candidate, recommended: index === 0 })));
    setIsCalculatingUnits(false);
  };

  const openReport = (report: EmergencyReport) => {
    setSelectedReport(report);
    setDetailMode('detail');
    setUnitCandidates([]);
    if (getServiceStatus(report, serviceType) === 'pending') void calculateNearestUnits(report);
  };

  const openClosureReport = (report: EmergencyReport) => {
    setSelectedReport(report);
    setDetailMode('closure');
    const existingClosure = report.serviceClosureReports?.[serviceType];
    setClosureOutcome(existingClosure?.outcome ?? 'resolved');
    setClosureSummary(existingClosure?.summary ?? '');
    setClosurePhoto(existingClosure?.photo ?? null);
  };

  const handleRespond = (reportId: string, assignment?: UnitAssignment) => {
    const selectedAssignment = assignment ?? unitCandidates[0];
    const updatedReports = reports.map(r =>
      r.id === reportId
        ? updateUnitStatus(r, 'responding', selectedAssignment, createAuditEntry(
            'unit_dispatched',
            `${selectedAssignment?.unit ?? unitIds[serviceType]} dispatched`
          ))
        : r
    );
    persistStatusUpdate(updatedReports, reportId, 'responding', selectedAssignment);
    setSelectedReport(updatedReports.find(report => report.id === reportId) ?? null);
    toast.success(`${selectedAssignment?.unit ?? unitIds[serviceType]} dispatched`);
  };

  const handleResolve = (reportId: string) => {
    if (!closurePhoto) {
      toast.error('Upload a closure photo before closing the incident');
      return;
    }
    if (!closureSummary.trim()) {
      toast.error('Write a resolution summary before closing the incident');
      return;
    }

    const updatedReports = reports.map(r =>
      r.id === reportId
        ? {
            ...updateUnitStatus(r, 'done', undefined, createAuditEntry('report_resolved', 'Report marked done')),
            serviceClosureReports: {
              ...r.serviceClosureReports,
              [serviceType]: {
                outcome: closureOutcome,
                summary: closureSummary.trim(),
                photo: closurePhoto,
                closedAt: new Date().toISOString()
              }
            }
          }
        : r
    );
    persistStatusUpdate(updatedReports, reportId, 'done');
    setSelectedReport(null);
    setDetailMode('detail');
    setFilter('all');
    toast.success('Incident closed and counted as Done');
  };

  const handleArrived = (reportId: string) => {
    const updatedReports = reports.map(r =>
      r.id === reportId
        ? updateUnitStatus(r, 'arrived', undefined, createAuditEntry('unit_arrived', 'Assigned unit arrived on scene'))
        : r
    );
    persistStatusUpdate(updatedReports, reportId, 'arrived');
    setSelectedReport(updatedReports.find(report => report.id === reportId) ?? null);
  };

  const updateUnitStatus = (
    report: EmergencyReport,
    status: ReportStatus,
    assignment?: UnitAssignment,
    auditEntry?: AuditEntry
  ) => {
    const serviceStatuses = {
      ...createServiceStatuses(getReportServices(report), report.status),
      ...report.serviceStatuses,
      [serviceType]: status
    };
    return {
      ...report,
      serviceStatuses,
      status: getOverallStatus(serviceStatuses, report.status),
      assignedUnits: assignment
        ? { ...report.assignedUnits, [serviceType]: assignment }
        : report.assignedUnits,
      auditTrail: auditEntry ? [...(report.auditTrail ?? []), auditEntry] : report.auditTrail
    };
  };

  const toggleReportSelection = (reportId: string) => {
    setSelectedReportIds(ids =>
      ids.includes(reportId) ? ids.filter(id => id !== reportId) : [...ids, reportId]
    );
  };

  const cancelReportSelection = () => {
    setIsSelectingReports(false);
    setSelectedReportIds([]);
    setDeclineReason('');
  };

  const handleDeclineSelectedReports = () => {
    if (!selectedReportIds.length) {
      toast.info('Select at least one report to decline');
      return;
    }
    const reason = declineReason.trim();
    if (!reason) {
      toast.info('Add a reason before declining selected reports');
      return;
    }

    const selected = new Set(selectedReportIds);
    const declinedAt = new Date().toISOString();
    const updatedReports = reports.map(report => {
      if (!selected.has(report.id)) return report;
      const declinedReport = updateUnitStatus(
        report,
        'declined',
        undefined,
        createAuditEntry('report_declined', `${serviceLabel} declined this report: ${reason}`)
      );
      return {
        ...declinedReport,
        declineReasons: {
          ...declinedReport.declineReasons,
          [serviceType]: reason
        },
        declinedAt
      };
    });

    setReports(updatedReports);
    replaceReports(updatedReports);
    void Promise.all(
      updatedReports
        .filter(report => selected.has(report.id))
        .map(report => updateIncidentStatus(report.id, serviceType, 'declined'))
    ).catch(() => replaceReports(updatedReports));
    cancelReportSelection();
    toast.info('Selected report declined');
  };

  useEffect(() => {
    return () => closureCameraStreamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  const getGpsTargetReport = (report?: EmergencyReport | null) => report ?? selectedReport;

  const toggleGpsSharing = (report?: EmergencyReport) => {
    const targetReport = getGpsTargetReport(report);
    if (!targetReport) {
      toast.error('Open or select a report before sharing live GPS');
      return;
    }

    if (sharingGpsReportId === targetReport.id) {
      clearLiveGps(serviceType, targetReport.id);
      setSharingGpsReportId(null);
      toast.info(`Live GPS sharing stopped for #${formatReportCode(targetReport)}`);
      return;
    }

    if (sharingGpsReportId) {
      clearLiveGps(serviceType, sharingGpsReportId);
    }

    const publishServiceLocation = (coords: { lat: number; lng: number }) => {
      publishLiveGps({
        service: serviceType,
        reportId: targetReport.id,
        unit: unitIds[serviceType],
        ...coords,
        updatedAt: Date.now()
      });
      setSharingGpsReportId(targetReport.id);
    };

    publishServiceLocation(serviceLocation.coords);
    toast.success(`Live GPS sharing enabled for #${formatReportCode(targetReport)}`);

    if (!navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setServiceLocation(location => ({ ...location, coords }));
        publishServiceLocation(coords);
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 8000 }
    );
  };

  const handleServiceLocationChange = (
    address: string,
    coords: { lat: number; lng: number }
  ) => {
    setServiceLocation({ address, coords });
    const activeReportId = sharingGpsReportId ?? selectedReport?.id;
    if (!activeReportId) return;

    publishLiveGps({
      service: serviceType,
      reportId: activeReportId,
      unit: unitIds[serviceType],
      ...coords,
      updatedAt: Date.now()
    });
    toast.success('Service location updated on live tracking');
  };

  const refreshServiceLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Location is not available on this device');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        void import('../services/geocoding').then(async ({ reverseGeocode }) => {
          const address = await reverseGeocode(coords.lat, coords.lng, serviceLocation.address || currentLocation);
          handleServiceLocationChange(address, coords);
          toast.success('Service location refreshed');
        }).catch(() => {
          handleServiceLocationChange(serviceLocation.address || currentLocation, coords);
          toast.success('Service location refreshed');
        });
      },
      () => toast.error('Unable to refresh service location. Please allow location access.'),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 }
    );
  };

  const handleClosurePhotoChange = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setClosurePhoto(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
  };

  const closeClosureCamera = () => {
    closureCameraStreamRef.current?.getTracks().forEach(track => track.stop());
    closureCameraStreamRef.current = null;
    if (closureVideoRef.current) closureVideoRef.current.srcObject = null;
    setIsClosureCameraOpen(false);
  };

  useEffect(() => {
    if (!isClosureCameraOpen || !closureVideoRef.current || !closureCameraStreamRef.current) return;
    const video = closureVideoRef.current;
    video.srcObject = closureCameraStreamRef.current;
    void video.play().catch(() => undefined);
  }, [isClosureCameraOpen]);

  const openClosureCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      closurePhotoInputRef.current?.click();
      toast.error('Camera is not available on this device. Upload a photo instead.');
      return;
    }

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      closureCameraStreamRef.current = stream;
      setIsClosureCameraOpen(true);
    } catch {
      closurePhotoInputRef.current?.click();
      toast.error('Unable to open camera. Please allow camera access or upload a photo.');
    }
  };

  const takeClosurePhoto = () => {
    const video = closureVideoRef.current;
    if (!video?.videoWidth || !video.videoHeight) {
      toast.error('Camera is still loading');
      return;
    }

    const canvas = document.createElement('canvas');
    const maxDimension = 1600;
    const scale = Math.min(1, maxDimension / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    setClosurePhoto(canvas.toDataURL('image/jpeg', 0.82));
    closeClosureCamera();
    toast.success('Closure photo captured');
  };

  useEffect(() => {
    if (!sharingGpsReportId || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      position => publishLiveGps({
        service: serviceType,
        reportId: sharingGpsReportId,
        unit: unitIds[serviceType],
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        updatedAt: Date.now()
      }),
      () => toast.error('Unable to refresh live GPS'),
      { enableHighAccuracy: true, maximumAge: 3000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [serviceType, sharingGpsReportId]);

  useEffect(() => {
    if (!sharingGpsReportId) return;
    const activeReport = reports.find(report => report.id === sharingGpsReportId);
    if (!activeReport || !['responding', 'arrived'].includes(getServiceStatus(activeReport, serviceType))) {
      clearLiveGps(serviceType, sharingGpsReportId);
      setSharingGpsReportId(null);
    }
  }, [reports, serviceType, sharingGpsReportId]);

  useEffect(() => {
    if (!selectedReport?.coords) {
      setDetailRoute(null);
      return;
    }

    let cancelled = false;
    const assignedUnit = selectedReport.assignedUnits?.[serviceType];
    const origin = assignedUnit?.origin ?? serviceLocation.coords;
    void fetchDrivingRoute(origin, selectedReport.coords).then(route => {
      if (!cancelled) setDetailRoute(route);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedReport?.id, selectedReport?.coords?.lat, selectedReport?.coords?.lng, selectedReport?.assignedUnits, serviceLocation.coords.lat, serviceLocation.coords.lng, serviceType]);

  const serviceLabel = getServiceDisplayLabel(serviceType);
  const serviceUnit = unitIds[serviceType].replace('-', ' ');
  const severityLabel = selectedReport ? getInjuryScaleLabel(selectedReport.injuryScale) : 'MEDIUM';
  const severityBadge = severityLabel === 'HIGH'
    ? 'border-red-200 bg-red-100 text-red-600'
    : severityLabel === 'MEDIUM'
    ? 'border-yellow-300 bg-yellow-100 text-yellow-700'
    : 'border-blue-200 bg-blue-100 text-blue-700';
  const reporterName = selectedReport?.reporterName?.trim() || 'Citizen Reporter';
  const reporterPhone = selectedReport?.reporterPhone?.trim() || citizenContactNumber;

  if (selectedReport && detailMode === 'closure') {
    return (
      <div className="absolute inset-0 z-[70] flex h-full flex-col bg-white pb-20 text-[#0c3249]">
        <IPhoneStatusBar dark={false} />
        <header className="flex h-[111px] shrink-0 items-end bg-white px-6 pb-4 shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setSelectedReport(null);
                setDetailMode('detail');
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full"
              aria-label="Back to service command"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="text-[18px] font-semibold leading-7">Incident Closure Report</h1>
          </div>
        </header>

        <main className="app-scrollbar flex-1 space-y-[17px] overflow-y-auto px-4 py-4">
          <section className="rounded-lg p-4 text-white" style={{ backgroundColor: theme.accent }}>
            <div className="mb-4 flex items-start justify-between">
              <p className="text-[12px] font-semibold uppercase leading-4 tracking-[0.6px]">Incident Information</p>
              <span className={`rounded-full border px-3 py-0.5 text-[8px] font-bold uppercase tracking-[0.5px] ${severityBadge}`}>
                {severityLabel.toLowerCase()}
              </span>
            </div>
            <h2 className="text-[20px] font-bold leading-8">{selectedReport.emergencyType ?? 'Emergency Report'}</h2>
            <p className="text-[10px] font-bold leading-3">#{formatReportCode(selectedReport)}</p>
            <div className="mt-4 space-y-3 text-[14px] leading-5">
              <p className="flex items-center gap-2"><MapPin className="h-4 w-4" />{selectedReport.location}</p>
              <p className="flex items-center gap-2"><Clock className="h-4 w-4" />{formatReportDateTime(selectedReport.timestamp)}</p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-[14px] font-bold leading-5">Photo</h2>
            <button
              type="button"
              onClick={openClosureCamera}
              className="flex h-40 w-full flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-[#e5e7eb] bg-[#f9fafb] text-[#9ca3af]"
            >
              {isClosureCameraOpen ? (
                <video ref={closureVideoRef} className="h-full w-full object-cover" autoPlay playsInline muted />
              ) : closurePhoto ? (
                <img src={closurePhoto} alt="Closure evidence" className="h-full w-full object-cover" />
              ) : (
                <>
                  <span className="mb-2 rounded-full bg-white p-2"><Camera className="h-6 w-6" /></span>
                  <p className="text-[12px] leading-4">Take a Photo</p>
                </>
              )}
            </button>
            <input
              ref={closurePhotoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(event) => handleClosurePhotoChange(event.target.files?.[0])}
            />
            <button
              type="button"
              onClick={isClosureCameraOpen ? takeClosurePhoto : () => closurePhotoInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0c3249] px-2 py-3 text-[12px] font-bold leading-4 text-white"
            >
              {isClosureCameraOpen ? <Camera className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
              {isClosureCameraOpen ? 'Capture Photo' : 'Upload Photo'}
            </button>
            {isClosureCameraOpen && (
              <button
                type="button"
                onClick={closeClosureCamera}
                className="flex w-full items-center justify-center rounded-lg border border-[#e5e7eb] px-2 py-3 text-[12px] font-bold leading-4 text-[#0c3249]"
              >
                Cancel Camera
              </button>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-[14px] font-bold leading-5">Emergency Resources</h2>
            <div className="flex flex-wrap gap-2">
              {(['ambulance', 'fire', 'police'] as const).map(service => {
                const active = getReportServices(selectedReport).includes(service);
                const Icon = serviceIcons[service];
                const label = getServiceDisplayLabel(service, `${selectedReport.emergencyType ?? ''} ${selectedReport.detectedIndicators?.join(' ') ?? ''} ${selectedReport.description}`);
                return (
                  <span
                    key={service}
                    className={`flex h-9 items-center gap-2 rounded-xl px-3 text-[14px] leading-5 ${active ? 'text-white' : 'bg-[#f9fafb] text-[#9ca3af]'}`}
                    style={active ? { backgroundColor: serviceTheme[service].accent } : undefined}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </span>
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-[14px] font-bold leading-5">Incident Outcome</h2>
            <div className="relative">
              <select
                value={closureOutcome}
                onChange={(event) => setClosureOutcome(event.target.value)}
                className="h-11 w-full appearance-none rounded-[10px] border border-[#e5e7eb] bg-[#f9fafb] px-4 text-[12px] font-semibold uppercase leading-4 outline-none"
              >
                <option value="resolved">Resolved</option>
                <option value="continued-monitoring">Continue Monitoring</option>
                <option value="transferred">Transferred</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-[14px] font-bold leading-5">Resolution Summary</h2>
            <textarea
              value={closureSummary}
              onChange={(event) => setClosureSummary(event.target.value)}
              className="h-28 w-full resize-none rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-4 text-[12px] leading-5 outline-none placeholder:text-[#9ca3af]"
              placeholder="Describe how the incident was handled and its final status."
            />
          </section>

          <button
            onClick={() => handleResolve(selectedReport.id)}
            className="flex h-14 w-full items-center justify-center rounded-xl bg-[#186a17] text-[16px] font-bold leading-6 text-white"
          >
            Close Incident
          </button>
        </main>

        <div className="absolute bottom-0 left-0 right-0 flex h-20 items-center justify-between rounded-t-[24px] bg-white px-20 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
          <button onClick={() => setSelectedReport(null)} className="flex flex-col items-center gap-1 text-[#ef4444]"><Home className="h-6 w-6 fill-current" /><span className="text-[10px] font-bold leading-[15px]">Home</span></button>
          <button onClick={onOpenProfile} className="flex flex-col items-center gap-1 text-[#9ca3af]"><User className="h-6 w-6" /><span className="text-[10px] font-medium leading-[15px]">Profile</span></button>
        </div>
      </div>
    );
  }

  if (selectedReport) {
    const status = getServiceStatus(selectedReport, serviceType);
    const assignedUnit = selectedReport.assignedUnits?.[serviceType];
    return (
      <div className="absolute inset-0 z-[70] flex h-full flex-col bg-white pb-20 text-[#0c3249]">
        <IPhoneStatusBar dark={false} />
        <header className="flex h-[111px] shrink-0 items-end bg-white px-6 pb-4 shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedReport(null)} className="flex h-8 w-8 items-center justify-center rounded-full" aria-label="Back to command">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="text-[18px] font-semibold leading-7">Report Detail</h1>
          </div>
        </header>

        <main className="app-scrollbar flex-1 space-y-[17px] overflow-y-auto px-4 py-4">
          <div className="flex h-11 items-start justify-between">
            <div>
              <h2 className="text-[20px] font-bold leading-8">{selectedReport.emergencyType ?? 'Emergency Report'}</h2>
              <p className="text-[10px] font-bold leading-3 text-[#0c3249]/50">#{formatReportCode(selectedReport)}</p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase leading-[15px] tracking-[0.5px] ${severityBadge}`}>
              {severityLabel}
            </span>
          </div>

          {selectedReport.photo ? (
            <PrivacyImage
              src={selectedReport.photo}
              alt="Emergency"
              allowUnblurred={canViewSensitiveMedia}
              className="h-[166px] w-full rounded-xl object-cover"
              privacyRegions={selectedReport.privacyRegions}
            />
          ) : (
            <div className="flex h-[166px] w-full items-center justify-center rounded-xl bg-[#f4f8fb] text-[#9ca3af]">
              <ImageOff className="h-8 w-8" />
            </div>
          )}

          <section className="rounded-lg border-l-[5px] border-[#0c3249] bg-white p-4 shadow-[0_4px_12px_rgba(0,0,0,0.10)]">
            <h3 className="mb-4 text-[12px] font-semibold uppercase leading-4 tracking-[0.6px] text-[#42474d]">Reporter Information</h3>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0c3249] text-white">
                  <User className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[16px] font-bold leading-6">{reporterName}</p>
                  <p className="flex items-center gap-1 text-[14px] leading-5 text-[#0c3249]/50">
                    <CheckCircle2 className="h-[13px] w-[13px] fill-[#4caf50] text-[#4caf50]" />
                    Verified User
                  </p>
                  {reporterPhone && (
                    <p className="mt-0.5 text-[12px] leading-4 text-[#0c3249]/45">{reporterPhone}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => onOpenChat(selectedReport.id)} className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0c3249] text-white" aria-label="Message reporter">
                  <MessageSquare className="h-5 w-5" />
                </button>
                <button
                  onClick={() => onCallCitizen(selectedReport)}
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0c3249] text-white"
                  aria-label="Call reporter"
                >
                  <Phone className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="mt-4 space-y-3 border-t border-[#0c3249]/10 pt-3 text-[14px] leading-5">
              <p className="flex items-center gap-2"><MapPin className="h-4 w-4" />{selectedReport.location}</p>
              <p className="flex items-center gap-2"><Clock className="h-4 w-4" />{formatReportDateTime(selectedReport.timestamp)}</p>
            </div>
          </section>

          <section className="rounded-lg border-l-[5px] bg-white p-4 shadow-[0_4px_12px_rgba(0,0,0,0.10)]" style={{ borderLeftColor: theme.accent }}>
            <div className="flex items-center justify-between text-xs">
              <h3 className="font-semibold uppercase leading-4 tracking-[0.6px] text-[#42474d]">Priority Scale</h3>
              <span className="font-bold" style={{ color: getInjuryScaleHex(selectedReport.injuryScale) }}>{selectedReport.injuryScale.toFixed(1)}/10</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full border border-[#0c324a]/10 bg-[#eef3f7]">
              <div
                className="h-full transition-all"
                style={{ width: `${selectedReport.injuryScale * 10}%`, backgroundColor: getInjuryScaleHex(selectedReport.injuryScale) }}
              />
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-[12px] font-semibold uppercase leading-4 tracking-[0.6px]">Incident Description</h3>
            <div className="rounded-lg border-l-[5px] border-[#c11720] bg-white p-4 shadow-[0_4px_12px_rgba(0,0,0,0.10)]">
              <p className="text-[16px] leading-[26px] text-[#0c3249]">
                {selectedReport.description || 'Emergency report submitted by the citizen. Review dispatch recommendations and confirm responder assignment.'}
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[12px] font-semibold uppercase leading-4 tracking-[0.6px]">Recommended Dispatch</h3>
              <span className="text-[12px] font-semibold leading-4 tracking-[0.6px] text-[#c2c7cd]">{status === 'pending' ? '1 Unit Selected' : 'Unit Assigned'}</span>
            </div>

            <div className="space-y-2">
              {(status === 'pending' ? unitCandidates.slice(0, 1) : [assignedUnit].filter(Boolean)).map((candidate, index) => {
                const unit = candidate?.unit ?? unitIds[serviceType];
                const distance = candidate?.distanceKm ?? 1.2;
                return (
                  <button
                    key={unit}
                    onClick={() => status === 'pending' && handleRespond(selectedReport.id, candidate)}
                    className="flex w-full items-center justify-between rounded-lg p-4 text-left text-white"
                    style={{ backgroundColor: index === 0 ? theme.accent : '#0c3249' }}
                  >
                    <span className="flex items-center gap-4">
                      <span className="flex h-10 w-10 items-center justify-center rounded-[5px] bg-white text-[#0c3249]">
                        <ServiceIcon className="h-5 w-5" style={{ color: index === 0 ? theme.accent : '#0c3249' }} />
                      </span>
                      <span>
                        <span className="block text-[16px] font-bold leading-6">{serviceLabel}</span>
                        <span className="block text-[14px] leading-5">{unit.replace('-', ' ')} • {distance.toFixed(1)} km</span>
                      </span>
                    </span>
                    <CheckCircle2 className="h-5 w-5 fill-white text-white" />
                  </button>
                );
              })}
              {status === 'pending' && isCalculatingUnits && (
                <div className="rounded-lg border border-[#0c3249]/10 bg-[#f9fafb] p-4 text-[13px] text-[#42474d]">
                  Calculating nearest unit...
                </div>
              )}
            </div>
          </section>

          {selectedReport.coords && (
            <div className="overflow-hidden rounded-xl border border-[#0c3249]/10">
              <EmergencyMap
                lat={selectedReport.coords.lat}
                lng={selectedReport.coords.lng}
                serviceType={serviceType}
                serviceLocation={assignedUnit?.origin ?? serviceLocation.coords}
                route={detailRoute}
                report={selectedReport}
              />
            </div>
          )}

          {status === 'pending' && (
            <button
              onClick={() => handleRespond(selectedReport.id)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#c11720] p-4 text-[16px] font-bold leading-6 text-white"
            >
              <Siren className="h-5 w-5" />
              Dispatch Unit
            </button>
          )}
          {status === 'responding' && (
            <div className="grid grid-cols-1 gap-3">
              <button onClick={() => toggleGpsSharing()} className={`flex items-center justify-center gap-2 rounded-xl p-4 text-[16px] font-bold leading-6 text-white ${sharingGpsReportId === selectedReport.id ? 'bg-green-600' : 'bg-[#0c3249]'}`}>
                <Radio className={`h-5 w-5 ${sharingGpsReportId === selectedReport.id ? 'animate-pulse' : ''}`} />
                {sharingGpsReportId === selectedReport.id ? 'Live GPS ON' : 'Share Live GPS'}
              </button>
            </div>
          )}
          {status === 'arrived' && (
              <button onClick={() => openClosureReport(selectedReport)} className="flex w-full items-center justify-center rounded-xl bg-[#186a17] p-4 text-[16px] font-bold leading-6 text-white">
              Create Closure Report
            </button>
          )}
          {status === 'done' && (
            <section className="rounded-xl border border-[#186a17]/20 bg-[#186a17]/10 p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#186a17] text-white">
                  <CheckCircle2 className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[16px] font-bold leading-6 text-[#186a17]">Incident Closed</p>
                  <p className="text-[12px] leading-4 text-[#0c3249]/60">This report is now counted in Done.</p>
                </div>
              </div>
              <button
                onClick={() => openClosureReport(selectedReport)}
                className="mt-4 flex w-full items-center justify-center rounded-xl bg-[#186a17] p-4 text-[16px] font-bold leading-6 text-white"
              >
                View Closure Report
              </button>
            </section>
          )}
        </main>

        <div className="absolute bottom-0 left-0 right-0 flex h-20 items-center justify-between rounded-t-[24px] bg-white px-20 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
          <button onClick={() => setSelectedReport(null)} className="flex flex-col items-center gap-1 text-[#ef4444]"><Home className="h-6 w-6 fill-current" /><span className="text-[10px] font-bold leading-[15px]">Home</span></button>
          <button onClick={onOpenProfile} className="flex flex-col items-center gap-1 text-[#9ca3af]"><User className="h-6 w-6" /><span className="text-[10px] font-medium leading-[15px]">Profile</span></button>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="flex h-full flex-col bg-white pb-20 text-[#0c324a]">
      {/* Header */}
      <div className="shrink-0 px-5 pb-8 pt-[47px] text-white shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-4px_rgba(0,0,0,0.1)]" style={{ background: theme.header }}>
        <div className="mx-auto max-w-sm">
        <div className="mb-6 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex h-7 items-center gap-2 rounded-lg bg-white/10 px-3 text-[12px] font-semibold leading-4 tracking-[0.6px] text-white transition hover:bg-white/20"
        >
          <ArrowLeft className="h-2.5 w-2.5" />
          Back
        </button>
        <button
          onClick={() => isSelectingReports ? cancelReportSelection() : setIsSelectingReports(true)}
          className="h-7 rounded-lg bg-white/10 px-3 text-[12px] font-semibold leading-4 tracking-[0.6px] text-white"
        >
          {isSelectingReports ? 'Cancel' : 'Select'}
        </button>
        </div>
        <div className="mb-6 flex items-start gap-4">
          <div className="flex h-[51px] w-[51px] items-center justify-center rounded-2xl border border-white/20 bg-white/20 backdrop-blur-sm">
            <ServiceIcon className="h-[25px] w-[25px] text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-[22px] font-bold leading-7 tracking-[-0.55px]">{serviceTitle}</h1>
            <p className="text-[14px] leading-5 text-white/80">Emergency Response Dashboard</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 pt-2">
          <div className="flex h-[90px] flex-col items-start gap-1 rounded-lg border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
            <p className="text-[12px] font-semibold uppercase leading-4 tracking-[0.6px] text-white/70">Done</p>
            <p className="text-[30px] font-bold leading-9">{doneReportsCount}</p>
          </div>
          <div className="flex h-[90px] flex-col items-start gap-1 rounded-lg border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
            <p className="text-[12px] font-semibold uppercase leading-4 tracking-[0.6px] text-white/70">Pending</p>
            <p className="text-[30px] font-bold leading-9">{serviceReports.filter(r => getServiceStatus(r, serviceType) === 'pending').length}</p>
          </div>
          <div className="flex h-[90px] flex-col items-start gap-1 rounded-lg border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
            <p className="text-[12px] font-semibold uppercase leading-4 tracking-[0.6px] text-white/70">En Route</p>
            <p className="text-[30px] font-bold leading-9">{serviceReports.filter(r => getServiceStatus(r, serviceType) === 'responding').length}</p>
          </div>
        </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white px-5 py-2">
        <div className="mx-auto max-w-sm space-y-3">
        <div className="hidden items-center gap-3 rounded-lg border border-[#0c324a]/10 bg-white px-3 py-2.5">
          <MapPin className="h-4 w-4 text-[#0c324a]" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[#42474d]">Service GPS Location</p>
            <p className="truncate text-xs text-[#0c324a]">{serviceLocation.address}</p>
          </div>
          <button
            onClick={() => setShowLocationPicker(true)}
            className="rounded-lg p-2 transition"
            style={{ backgroundColor: `${theme.accent}22` }}
            aria-label="Change service location"
          >
            <Edit className="h-4 w-4" style={{ color: theme.accent }} />
          </button>
        </div>
        <button
          onClick={() => toggleGpsSharing()}
          className="hidden h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#0c324a] text-xs font-semibold text-white transition hover:bg-[#123f59]"
        >
          <Radio className="h-4 w-4" />
          Share Live GPS
        </button>
        <div className="flex h-14 items-center gap-3 pt-2">
          <button className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[#0c324a]/10 bg-white" aria-label="Filter reports">
            <Filter className="h-[18px] w-[18px] text-[#0c324a]" />
          </button>
          <div className="grid flex-1 grid-cols-3 gap-0 rounded-lg border border-[#0c324a]/10 bg-white p-1">
            {(['all', 'pending', 'responding'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded px-2 py-2 text-[12px] font-semibold leading-4 tracking-[0.6px] transition ${
                  filter === f
                    ? 'text-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-2px_rgba(0,0,0,0.1)]'
                    : 'text-[#42474d] hover:bg-slate-50'
                }`}
                style={filter === f ? { backgroundColor: `${theme.accent}b3` } : undefined}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
        </div>
      </div>

      {/* Reports List */}
      <div className="app-scrollbar flex-1 overflow-y-auto px-5 pb-4 pt-[58px]">
        <div className="mx-auto grid max-w-sm gap-4">
        {isSelectingReports && (
          <div className="space-y-3 rounded-2xl border border-[#ef4444]/20 bg-[#fff1f2] p-4">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-[#991b1b]">{selectedReportIds.length} selected</span>
              <button
                onClick={handleDeclineSelectedReports}
                disabled={selectedReportIds.length === 0}
                className="flex h-10 items-center gap-2 rounded-xl bg-[#c11720] px-4 text-[12px] font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <XCircle className="h-4 w-4" />
                Decline
              </button>
            </div>
            <textarea
              value={declineReason}
              onChange={event => setDeclineReason(event.target.value)}
              placeholder="Reason for citizen notification..."
              className="min-h-[74px] w-full resize-none rounded-xl border border-[#fecdd3] bg-white px-3 py-2 text-[13px] font-medium leading-5 text-[#0c324a] outline-none placeholder:text-[#9ca3af]"
            />
            <p className="text-[11px] leading-4 text-[#991b1b]/75">This reason will be sent to the citizen, then the report is removed from their report list.</p>
          </div>
        )}
        {filteredReports.length === 0 ? (
          <div className="flex h-[277px] flex-col items-center justify-center px-0 pb-20 pt-24 text-center opacity-40">
            <AlertTriangle className="mb-4 h-[57px] w-[66px] text-[#c2c7cd]" />
            <p className="text-[22px] font-semibold leading-7 text-[#c2c7cd]">No active reports</p>
          </div>
        ) : (
          filteredReports.map((report) => (
            <div
              key={report.id}
              onClick={() => isSelectingReports ? toggleReportSelection(report.id) : openReport(report)}
              className="group cursor-pointer overflow-hidden rounded-[24px] border border-[#0c324a]/10 bg-white shadow-[0_4px_10px_rgba(15,23,42,0.10)] transition hover:border-[#0c324a]/25"
            >
              <div className="p-5">
                {/* Header */}
                <div className="mb-4 flex items-start gap-3">
                  {report.photo ? (
                  <PrivacyImage
                      src={report.photo}
                      alt="Emergency"
                      allowUnblurred={canViewSensitiveMedia}
                      className="h-16 w-16 rounded-lg border border-[#0c324a]/10 object-cover"
                      privacyRegions={report.privacyRegions}
                    />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-[#0c324a]/10 bg-[#f4f8fb]">
                      <ImageOff className="h-6 w-6 text-[#9ca3af]" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className={`text-[14px] font-bold uppercase leading-5 ${getInjuryScaleColor(report.injuryScale)}`}>
                        {getInjuryScaleLabel(report.injuryScale)}
                      </div>
                      {isSelectingReports ? (
                        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                          selectedReportIds.includes(report.id) ? 'bg-[#c11720] text-white' : 'bg-slate-200 text-transparent'
                        }`}>
                          <span className="h-3 w-3 rounded-full bg-current" />
                        </div>
                      ) : getServiceStatus(report, serviceType) === 'done' ? (
                        <div className="rounded-full bg-[#186a17]/10 px-2.5 py-1 text-[11px] font-bold text-[#186a17]">
                          Done
                        </div>
                      ) : (
                        <div className="rounded-full bg-[#f3f6f8] px-2.5 py-1 text-[11px] font-bold text-[#6b7280]">
                          Scale: {getScaleLevelLabel(report.injuryScale)}
                        </div>
                      )}
                    </div>

                    <p className="mb-3 line-clamp-2 text-[13px] leading-5 text-[#42474d]">
                      {report.description}
                    </p>

                    <div className="mb-3 flex items-center gap-1.5 text-[12px] text-[#42474d]">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="truncate font-mono">{report.location}</span>
                    </div>

                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <div className={`grid gap-2 ${getServiceStatus(report, serviceType) === 'responding' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {getServiceStatus(report, serviceType) === 'pending' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isSelectingReports) {
                            toggleReportSelection(report.id);
                            return;
                          }
                          openReport(report);
                        }}
                        className="flex items-center justify-center gap-2 rounded-2xl bg-[#c11720] py-3 text-[16px] font-bold leading-6 text-white shadow-lg transition hover:opacity-90"
                      >
                        <Siren className="h-5 w-5" />
                        Dispatch Unit
                      </button>
                    )}
                    {getServiceStatus(report, serviceType) === 'responding' && (
                      <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isSelectingReports) {
                            toggleReportSelection(report.id);
                            return;
                          }
                          toggleGpsSharing(report);
                        }}
                        className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold text-white shadow-lg transition hover:opacity-90 ${sharingGpsReportId === report.id ? 'bg-green-600' : 'bg-[#0c324a]'}`}
                      >
                        <Radio className={`h-4 w-4 ${sharingGpsReportId === report.id ? 'animate-pulse' : ''}`} />
                        {sharingGpsReportId === report.id ? 'Live GPS ON' : 'Share Live GPS'}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isSelectingReports) {
                            toggleReportSelection(report.id);
                            return;
                          }
                          openClosureReport(report);
                        }}
                        className="rounded-lg bg-[#186a17] py-2.5 text-xs font-semibold text-white shadow-lg transition hover:opacity-90"
                      >
                        Done
                      </button>
                      </>
                    )}
                    {getServiceStatus(report, serviceType) === 'arrived' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isSelectingReports) {
                            toggleReportSelection(report.id);
                            return;
                          }
                          openClosureReport(report);
                        }}
                        className="rounded-lg bg-emerald-600 py-2.5 text-xs font-semibold text-white shadow-lg transition hover:opacity-90"
                      >
                        Closure Report
                      </button>
                    )}
                    {getServiceStatus(report, serviceType) === 'done' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isSelectingReports) {
                            toggleReportSelection(report.id);
                            return;
                          }
                          openClosureReport(report);
                        }}
                        className="rounded-lg bg-[#186a17] py-2.5 text-xs font-semibold text-white shadow-lg transition hover:opacity-90"
                      >
                        View Closure Report
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
        </div>
      </div>

    </div>
    {showLocationPicker && (
      <LocationPicker
        currentLocation={serviceLocation.address}
        onLocationChange={handleServiceLocationChange}
        onRefreshLocation={refreshServiceLocation}
        onClose={() => setShowLocationPicker(false)}
        country={country}
      />
    )}
    </>
  );
}
