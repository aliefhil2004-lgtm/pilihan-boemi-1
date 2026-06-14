import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Ambulance, ArrowLeft, Crosshair, Flame, Layers, Shield } from 'lucide-react';
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet';
import { fetchLiveGps } from '../services/liveGps';
import { civilianMarkerIcon, serviceMarkerIcons } from '../utils/mapMarkers';
import { cleanupExpiredReports } from '../services/reportStorage';
import { getServiceStatus, type ServiceType, type StoredEmergencyReport, type UnitAssignment } from '../types/emergency';
import { fetchDrivingRoute } from '../services/routing';
import { serviceUnitConfig } from '../config/serviceUnits';

interface LiveTrackingScreenProps {
  reportId: string;
  serviceTypes: ServiceType[];
  userLocation: { lat: number; lng: number };
  onOpenChat: () => void;
  onBack?: () => void;
  servicePhoneNumber: string;
}

const serviceConfig = {
  ambulance: { icon: Ambulance, name: 'Medical', unit: serviceUnitConfig.ambulance.unit, color: '#6da5c4' },
  fire: { icon: Flame, name: 'Fire', unit: serviceUnitConfig.fire.unit, color: '#ff7a1a' },
  police: { icon: Shield, name: 'Police', unit: serviceUnitConfig.police.unit, color: '#2563eb' }
};

const dangerZoneConfig = [
  { label: 'Watch', minScale: 1, radius: 360, color: '#18b36b', fillOpacity: 0.16 },
  { label: 'Yellow caution', minScale: 3, radius: 250, color: '#ffc21a', fillOpacity: 0.16 },
  { label: 'High', minScale: 6, radius: 160, color: '#f97316', fillOpacity: 0.18 },
  { label: 'Critical', minScale: 8, radius: 85, color: '#dc2626', fillOpacity: 0.22 }
];

interface RouteSummary {
  etaMinutes: number;
  distanceKm: number;
  liveGps: boolean;
  trafficLevel?: 'light' | 'moderate' | 'heavy' | 'severe';
}

function ResponderRoute({
  serviceType,
  userLocation,
  assignment,
  onRouteUpdate
}: {
  serviceType: ServiceType;
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

  useEffect(() => {
    const update = async () => {
      const gps = await fetchLiveGps(serviceType);
      const liveGps = Boolean(gps && Date.now() - gps.updatedAt < 30000);
      const nextPosition = liveGps
        ? { lat: gps!.lat, lng: gps!.lng }
        : {
            lat: positionRef.current.lat + (userLocation.lat - positionRef.current.lat) * 0.035,
            lng: positionRef.current.lng + (userLocation.lng - positionRef.current.lng) * 0.035
          };

      positionRef.current = nextPosition;
      setPosition(nextPosition);

      const route = await fetchDrivingRoute(nextPosition, userLocation);
      if (!route) return;
      setRoutePositions(route.coordinates.map(([lng, lat]) => [lat, lng]));
      onRouteUpdate(serviceType, {
        etaMinutes: Math.max(1, Math.ceil(route.durationSeconds / 60)),
        distanceKm: route.distanceMeters / 1000,
        liveGps,
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
  }, [assignment?.unit, onRouteUpdate, serviceType, userLocation.lat, userLocation.lng]);

  return (
    <>
      <Polyline
        positions={routePositions}
        pathOptions={{ color: serviceConfig[serviceType].color, weight: 4, opacity: 0.72, dashArray: '8 8' }}
      />
      <Marker position={[position.lat, position.lng]} icon={serviceMarkerIcons[serviceType]}>
        <Popup>{assignment?.unit ?? serviceConfig[serviceType].unit} on the way</Popup>
      </Marker>
    </>
  );
}

export function LiveTrackingScreen({ reportId, serviceTypes, userLocation, onBack }: LiveTrackingScreenProps) {
  const [report, setReport] = useState<StoredEmergencyReport | null>(null);
  const [routeSummaries, setRouteSummaries] = useState<Partial<Record<ServiceType, RouteSummary>>>({});
  const tomtomApiKey = import.meta.env.VITE_TOMTOM_API_KEY as string | undefined;
  const services = [...new Set(serviceTypes)];
  const activeServices = report
    ? services.filter(service => ['responding', 'arrived', 'resolved', 'done'].includes(getServiceStatus(report, service)))
    : [];
  const visibleResponderServices = activeServices.length ? activeServices : services;
  const zoneScale = report?.injuryScale ?? 5;
  const visibleZones = dangerZoneConfig
    .filter(zone => zoneScale >= zone.minScale)
    .sort((a, b) => b.radius - a.radius);
  const routeList = visibleResponderServices
    .map(service => routeSummaries[service])
    .filter((summary): summary is RouteSummary => Boolean(summary));
  const closestEta = routeList.length ? Math.min(...routeList.map(summary => summary.etaMinutes)) : null;

  useEffect(() => {
    const refresh = () => {
      setReport(cleanupExpiredReports().find(item => item.id === reportId) ?? null);
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
        <h1 className="text-[22px] font-bold leading-7">Danger Zone Map</h1>
      </header>

      <div className="relative flex-1 overflow-hidden">
        <MapContainer center={[userLocation.lat, userLocation.lng]} zoom={15} className="h-full w-full">
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
              center={[userLocation.lat, userLocation.lng]}
              radius={zone.radius}
              pathOptions={{ color: zone.color, fillColor: zone.color, fillOpacity: zone.fillOpacity, weight: 2 }}
            >
              <Popup>{zone.label} zone around the report location</Popup>
            </Circle>
          ))}
          <Marker position={[userLocation.lat, userLocation.lng]} icon={civilianMarkerIcon}>
            <Popup>Report location</Popup>
          </Marker>
          {visibleResponderServices.map(service => (
            <ResponderRoute
              key={service}
              serviceType={service}
              userLocation={userLocation}
              assignment={report?.assignedUnits?.[service]}
              onRouteUpdate={handleRouteUpdate}
            />
          ))}
        </MapContainer>

        <div className="absolute right-4 top-5 z-[500] w-[216px] rounded-2xl bg-[#2e344f]/95 p-5 text-white shadow-[0_16px_35px_rgba(15,23,42,0.28)] backdrop-blur">
          <div className="mb-4 flex items-center gap-3 text-[14px] font-bold">
            <AlertTriangle className="h-4 w-4 text-[#ff3b30]" />
            Danger Zones
          </div>
          <div className="space-y-3 text-[14px]">
            {[
              { label: 'Critical', color: '#dc2626' },
              { label: 'High', color: '#f97316' },
              { label: 'Yellow caution', color: '#ffc21a' },
              { label: 'Watch', color: '#18b36b' }
            ].map(zone => (
              <div key={zone.label} className="flex items-center gap-3">
                <span className="h-5 w-5 rounded-full" style={{ backgroundColor: zone.color }} />
                <span>{zone.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute left-1/2 top-[42%] z-[400] -translate-x-1/2 text-center">
          <p className="text-[30px] font-bold leading-8 text-[#42474d]/90 drop-shadow-sm">Jakarta</p>
          <p className="text-[13px] font-bold uppercase tracking-[2px] text-[#42474d]/75">KB. Sayur</p>
        </div>

        <div className="absolute bottom-[188px] right-4 z-[500] grid gap-2">
          <button className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-[#0c3249] shadow-[0_8px_20px_rgba(15,23,42,0.18)]" aria-label="Center map">
            <Crosshair className="h-5 w-5" />
          </button>
          <button className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-[#0c3249] shadow-[0_8px_20px_rgba(15,23,42,0.18)]" aria-label="Map layers">
            <Layers className="h-5 w-5" />
          </button>
        </div>

        {closestEta && (
          <div className="absolute bottom-[160px] left-6 right-6 z-[500] flex items-center justify-between rounded-xl bg-white/95 px-4 py-3 text-[12px] font-semibold text-[#0c3249] shadow-[0_10px_24px_rgba(15,23,42,0.18)]">
            <span>{closestEta} min ETA</span>
            <span>{routeList[0]?.trafficLevel ? `Traffic ${routeList[0].trafficLevel}` : 'Traffic estimate'}</span>
          </div>
        )}

        <div className="absolute bottom-[66px] left-6 right-6 z-[500] rounded-lg bg-[#2e344f]/95 p-5 text-white shadow-[0_14px_35px_rgba(15,23,42,0.26)] backdrop-blur">
          <div className="grid grid-cols-3 gap-4">
            {(['ambulance', 'fire', 'police'] as const).map(service => {
              const config = serviceConfig[service];
              const Icon = config.icon;
              const count = visibleResponderServices.includes(service) ? 1 : 0;
              return (
                <div key={service} className="min-w-0">
                  <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold" style={{ color: config.color }}>
                    <Icon className="h-4 w-4" />
                    <span className="truncate">{config.name}</span>
                  </div>
                  <p className="text-[30px] font-bold leading-8">{count}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
