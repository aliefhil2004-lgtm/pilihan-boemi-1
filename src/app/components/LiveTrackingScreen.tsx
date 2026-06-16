import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Ambulance, ArrowLeft, Crosshair, Flame, Layers, MessageSquare, Shield } from 'lucide-react';
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet';
import { fetchLiveGps } from '../services/liveGps';
import { getReportMarkerIcon, serviceMarkerIcons } from '../utils/mapMarkers';
import { cleanupExpiredReports } from '../services/reportStorage';
import { getReportServices, getServiceStatus, type ServiceType, type StoredEmergencyReport, type UnitAssignment } from '../types/emergency';
import { fetchDrivingRoute } from '../services/routing';
import { serviceUnitConfig } from '../config/serviceUnits';
import { dangerZones, getVisibleDangerZones } from '../config/dangerZones';

interface LiveTrackingScreenProps {
  reportId: string;
  serviceTypes: ServiceType[];
  userLocation: { lat: number; lng: number };
  userRole: 'civilian' | 'service' | null;
  currentUserId?: string;
  onOpenChat: () => void;
  onBack?: () => void;
  servicePhoneNumber: string;
}

const serviceConfig = {
  ambulance: { icon: Ambulance, name: 'Medical', unit: serviceUnitConfig.ambulance.unit, color: '#6da5c4' },
  fire: { icon: Flame, name: 'Fire', unit: serviceUnitConfig.fire.unit, color: '#ff7a1a' },
  police: { icon: Shield, name: 'Police', unit: serviceUnitConfig.police.unit, color: '#2563eb' }
};

interface RouteSummary {
  etaMinutes: number;
  distanceKm: number;
  liveGps: boolean;
  trafficLevel?: 'light' | 'moderate' | 'heavy' | 'severe';
}

const inactiveStatuses = ['done', 'resolved', 'declined'] as const;

function getActiveServicesForReport(report: StoredEmergencyReport) {
  return getReportServices(report).filter(service => !inactiveStatuses.includes(getServiceStatus(report, service) as typeof inactiveStatuses[number]));
}

function getPrimaryReportService(report: StoredEmergencyReport): ServiceType {
  const services = getActiveServicesForReport(report);
  if (services.includes('fire')) return 'fire';
  if (services.includes('police')) return 'police';
  return services[0] ?? report.service ?? 'ambulance';
}

function hasDangerZoneService(report: StoredEmergencyReport) {
  return getActiveServicesForReport(report).some(service => service === 'fire' || service === 'police');
}

function ResponderRoute({
  serviceType,
  reportId,
  userLocation,
  assignment,
  onRouteUpdate
}: {
  serviceType: ServiceType;
  reportId: string;
  userLocation: { lat: number; lng: number };
  assignment?: UnitAssignment;
  onRouteUpdate: (service: ServiceType, summary: RouteSummary) => void;
}) {
  const index = ['ambulance', 'fire', 'police'].indexOf(serviceType) + 1;
  const [position, setPosition] = useState({
    lat: assignment?.origin.lat ?? userLocation.lat - 0.006 * index,
    lng: assignment?.origin.lng ?? userLocation.lng - 0.0045 * index
  });
  const positionRef = useRef(position);
  const [routePositions, setRoutePositions] = useState<Array<[number, number]>>([]);
  const [hasSharedGps, setHasSharedGps] = useState(false);

  useEffect(() => {
    const update = async () => {
      const gps = await fetchLiveGps(serviceType, reportId);
      const hasGps = Boolean(gps);
      const liveGps = Boolean(gps && Date.now() - gps.updatedAt < 30000);
      setHasSharedGps(hasGps);
      if (!hasGps) {
        setRoutePositions([]);
        onRouteUpdate(serviceType, {
          etaMinutes: 0,
          distanceKm: 0,
          liveGps: false
        });
        return;
      }
      const nextPosition = { lat: gps!.lat, lng: gps!.lng };

      positionRef.current = nextPosition;
      setPosition(nextPosition);

      const route = await fetchDrivingRoute(nextPosition, userLocation);
      if (!route) return;
      setRoutePositions(route.coordinates.map(([lng, lat]) => [lat, lng]));
      onRouteUpdate(serviceType, {
        etaMinutes: Math.max(1, Math.ceil(route.durationSeconds / 60)),
        distanceKm: route.distanceMeters / 1000,
        liveGps: hasGps,
        trafficLevel: route.trafficLevel
      });
    };

    void update();
    const interval = window.setInterval(update, 10000);
    window.addEventListener('storage', update);
    window.addEventListener('emergency-gps-updated', update);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('storage', update);
      window.removeEventListener('emergency-gps-updated', update);
    };
  }, [assignment?.unit, onRouteUpdate, reportId, serviceType, userLocation.lat, userLocation.lng]);

  return (
    hasSharedGps ? (
    <>
      <Polyline
        positions={routePositions}
        pathOptions={{ color: serviceConfig[serviceType].color, weight: 4, opacity: 0.72, dashArray: '8 8' }}
      />
      <Marker position={[position.lat, position.lng]} icon={serviceMarkerIcons[serviceType]}>
        <Popup>{assignment?.unit ?? serviceConfig[serviceType].unit} {routePositions.length ? 'on the way' : 'last shared location'}</Popup>
      </Marker>
    </>
    ) : null
  );
}

export function LiveTrackingScreen({ reportId, serviceTypes, userLocation, userRole, currentUserId, onOpenChat, onBack }: LiveTrackingScreenProps) {
  const [report, setReport] = useState<StoredEmergencyReport | null>(null);
  const [otherReports, setOtherReports] = useState<StoredEmergencyReport[]>([]);
  const [routeSummaries, setRouteSummaries] = useState<Partial<Record<ServiceType, RouteSummary>>>({});
  const tomtomApiKey = import.meta.env.VITE_TOMTOM_API_KEY as string | undefined;
  const services = [...new Set(serviceTypes)];
  const activeServices = report
    ? services.filter(service => ['responding', 'arrived', 'resolved'].includes(getServiceStatus(report, service)))
    : [];
  const canAccessReport = userRole === 'service' || !report?.reporterUid || report.reporterUid === currentUserId;
  const visibleResponderServices = canAccessReport ? activeServices : [];
  const currentReportHasDangerZone = activeServices.some(service => service === 'fire' || service === 'police');
  const zoneScale = report?.injuryScale ?? 5;
  const reportLocation = report?.coords ?? userLocation;
  const locationParts = (report?.location ?? 'Report location').split(',').map(part => part.trim()).filter(Boolean);
  const locationTitle = locationParts[0] ?? 'Report location';
  const locationSubtitle = locationParts.slice(1, 3).join(', ');
  const visibleZones = currentReportHasDangerZone ? getVisibleDangerZones(zoneScale) : [];
  const visibleOtherReports = canAccessReport
    ? otherReports.filter(item => item.coords && getActiveServicesForReport(item).length > 0)
    : [];
  const routeList = visibleResponderServices
    .map(service => routeSummaries[service])
    .filter((summary): summary is RouteSummary => Boolean(summary?.liveGps));
  const closestEta = routeList.length ? Math.min(...routeList.map(summary => summary.etaMinutes)) : null;

  useEffect(() => {
    const refresh = () => {
      const reports = cleanupExpiredReports();
      const nextReport = reports.find(item => item.id === reportId) ?? null;
      setReport(nextReport);
      setOtherReports(reports.filter(item => item.id !== reportId));
    };
    refresh();
    const interval = window.setInterval(refresh, 1500);
    window.addEventListener('storage', refresh);
    window.addEventListener('emergency-reports-updated', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('emergency-reports-updated', refresh);
    };
  }, [reportId]);

  const handleRouteUpdate = useCallback((service: ServiceType, summary: RouteSummary) => {
    setRouteSummaries(current => ({ ...current, [service]: summary }));
  }, []);

  return (
    <div className="flex h-full flex-col bg-white text-[#0c3249]">
      <header className="z-20 flex h-[137px] shrink-0 items-end gap-4 border-b border-[#e5e7eb] bg-white px-8 pb-6 shadow-[0_4px_18px_rgba(15,23,42,0.06)]">
        {onBack && (
          <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full text-[#0c3249]" aria-label="Back">
            <ArrowLeft className="h-7 w-7" />
          </button>
        )}
        <h1 className="text-[22px] font-bold leading-7">Live Tracking</h1>
      </header>

      <div className="relative flex-1 overflow-hidden">
        {!canAccessReport && (
          <div className="absolute inset-0 z-[900] flex items-center justify-center bg-white px-8 text-center">
            <div>
              <p className="text-[20px] font-extrabold leading-7 text-[#0c3249]">Live tracking unavailable</p>
              <p className="mt-2 text-[14px] leading-5 text-[#64748b]">This report belongs to another citizen account.</p>
            </div>
          </div>
        )}
        <MapContainer key={`${reportLocation.lat}-${reportLocation.lng}`} center={[reportLocation.lat, reportLocation.lng]} zoom={15} className="h-full w-full">
          <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {tomtomApiKey && (
            <TileLayer
              attribution="Traffic &copy; TomTom"
              opacity={0.58}
              url={`https://api.tomtom.com/traffic/map/4/tile/flow/absolute/{z}/{x}/{y}.png?key=${tomtomApiKey}`}
            />
          )}
          {visibleZones.map(zone => (
            <Circle
              key={zone.label}
              center={[reportLocation.lat, reportLocation.lng]}
              radius={zone.radiusMeters}
              pathOptions={{ color: zone.stroke, fillColor: zone.color, fillOpacity: zone.fillOpacity, weight: 2.5 }}
            >
              <Popup>{zone.label} zone around the report location</Popup>
            </Circle>
          ))}
          {visibleOtherReports.flatMap(otherReport => (
            hasDangerZoneService(otherReport)
              ? getVisibleDangerZones(otherReport.injuryScale).map(zone => (
                  <Circle
                    key={`${otherReport.id}-${zone.label}`}
                    center={[otherReport.coords!.lat, otherReport.coords!.lng]}
                    radius={zone.radiusMeters}
                    pathOptions={{ color: zone.stroke, fillColor: zone.color, fillOpacity: Math.max(0.06, zone.fillOpacity * 0.55), weight: 1.7, dashArray: '6 7' }}
                  >
                    <Popup>{zone.label} zone around another emergency location</Popup>
                  </Circle>
                ))
              : []
          ))}
          {visibleOtherReports.map(otherReport => {
            const primaryService = getPrimaryReportService(otherReport);
            return (
              <Marker
                key={otherReport.id}
                position={[otherReport.coords!.lat, otherReport.coords!.lng]}
                icon={getReportMarkerIcon(otherReport, primaryService)}
              >
                <Popup>
                  Other emergency location<br />
                  {otherReport.emergencyType ?? 'Emergency Report'}<br />
                  {otherReport.location}
                </Popup>
              </Marker>
            );
          })}
          <Marker position={[reportLocation.lat, reportLocation.lng]} icon={getReportMarkerIcon(report ?? { description: '', emergencyType: '', detectedIndicators: [] }, services[0] ?? 'ambulance')}>
            <Popup>Report location</Popup>
          </Marker>
          {visibleResponderServices.map(service => (
            <ResponderRoute
              key={service}
              serviceType={service}
              reportId={reportId}
              userLocation={reportLocation}
              assignment={report?.assignedUnits?.[service]}
              onRouteUpdate={handleRouteUpdate}
            />
          ))}
        </MapContainer>

        {visibleZones.length > 0 && (
        <div className="absolute right-4 top-5 z-[500] w-[172px] rounded-2xl bg-[#2e344f]/95 p-4 text-white shadow-[0_16px_35px_rgba(15,23,42,0.28)] backdrop-blur">
          <div className="mb-3 flex items-center gap-2 text-[13px] font-bold">
            <AlertTriangle className="h-4 w-4 shrink-0 text-[#ff3b30]" />
            Danger Zones
          </div>
          <div className="space-y-2.5 text-[12px]">
            {[...dangerZones].reverse().map(zone => (
              <div key={zone.label} className="flex items-center gap-2.5">
                <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: zone.color }} />
                <span className="leading-4">{zone.label}</span>
              </div>
            ))}
          </div>
        </div>
        )}

        <div className="absolute left-1/2 top-[42%] z-[400] -translate-x-1/2 text-center">
          <p className="text-[30px] font-bold leading-8 text-[#42474d]/90 drop-shadow-sm">{locationTitle}</p>
          {locationSubtitle && <p className="text-[13px] font-bold uppercase tracking-[2px] text-[#42474d]/75">{locationSubtitle}</p>}
        </div>

        <div className="absolute bottom-[188px] right-4 z-[500] grid gap-2">
          <button className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-[#0c3249] shadow-[0_8px_20px_rgba(15,23,42,0.18)]" aria-label="Center map">
            <Crosshair className="h-5 w-5" />
          </button>
          <button className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-[#0c3249] shadow-[0_8px_20px_rgba(15,23,42,0.18)]" aria-label="Map layers">
            <Layers className="h-5 w-5" />
          </button>
        </div>

        <div className="absolute bottom-8 left-5 right-5 z-[500] space-y-2">
          {closestEta && (
            <div className="flex items-center justify-between rounded-xl bg-white/95 px-4 py-3 text-[12px] font-semibold text-[#0c3249] shadow-[0_10px_24px_rgba(15,23,42,0.18)] backdrop-blur">
              <span>{closestEta} min ETA</span>
              <span>{routeList[0]?.trafficLevel ? `Traffic ${routeList[0].trafficLevel}` : 'Traffic estimate'}</span>
            </div>
          )}

          <button
            type="button"
            onClick={onOpenChat}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white/95 px-4 text-[13px] font-extrabold text-[#0c3249] shadow-[0_10px_24px_rgba(15,23,42,0.18)] backdrop-blur active:scale-[0.99]"
          >
            <MessageSquare className="h-4 w-4" />
            Chat with Emergency Service
          </button>

          <div className="rounded-xl bg-[#2e344f]/95 px-4 py-4 text-white shadow-[0_14px_35px_rgba(15,23,42,0.26)] backdrop-blur">
            <div className="grid grid-cols-3 gap-3">
              {(['ambulance', 'fire', 'police'] as const).map(service => {
                const config = serviceConfig[service];
                const Icon = config.icon;
                const count = activeServices.includes(service) ? 1 : 0;
                return (
                  <div key={service} className="min-w-0">
                    <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: config.color }}>
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{config.name}</span>
                    </div>
                    <p className="text-[28px] font-bold leading-7">{count}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
