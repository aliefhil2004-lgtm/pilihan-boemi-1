import 'leaflet/dist/leaflet.css';

import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import type { ServiceType } from '../services/ai';
import { getReportMarkerIcon, serviceMarkerIcons } from '../utils/mapMarkers';
import type { DrivingRoute } from '../services/routing';
import { getVisibleDangerZones } from '../config/dangerZones';
import type { StoredEmergencyReport } from '../types/emergency';

interface EmergencyMapProps {
  lat: number;
  lng: number;
  serviceType?: ServiceType;
  serviceLocation?: { lat: number; lng: number };
  route?: DrivingRoute | null;
  injuryScale?: number;
  report?: Pick<StoredEmergencyReport, 'emergencyType' | 'description' | 'detectedIndicators'>;
}

delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

export function EmergencyMap({
  lat,
  lng,
  serviceType = 'ambulance',
  serviceLocation,
  route,
  injuryScale = 5,
  report
}: EmergencyMapProps) {
  const tomtomApiKey = import.meta.env.VITE_TOMTOM_API_KEY as string | undefined;
  const routePositions = route?.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]) ?? [];
  const visibleZones = getVisibleDangerZones(injuryScale);
  const trafficColor = route?.trafficLevel === 'severe'
    ? '#dc2626'
    : route?.trafficLevel === 'heavy'
    ? '#f97316'
    : route?.trafficLevel === 'moderate'
    ? '#eab308'
    : '#16a34a';

  return (
    <div className="overflow-hidden rounded-2xl border border-[#0c3249]/10 bg-white">
      <MapContainer
        center={[lat, lng]}
        zoom={15}
        style={{ height: '300px', width: '100%' }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {tomtomApiKey && (
          <TileLayer
            attribution="Traffic &copy; TomTom"
            opacity={0.68}
            url={`https://api.tomtom.com/traffic/map/4/tile/flow/absolute/{z}/{x}/{y}.png?key=${tomtomApiKey}`}
          />
        )}

        {routePositions.length > 1 && (
          <Polyline positions={routePositions} pathOptions={{ color: trafficColor, weight: 6, opacity: 0.9 }} />
        )}

        {serviceLocation && (
          <Marker position={[serviceLocation.lat, serviceLocation.lng]} icon={serviceMarkerIcons[serviceType]}>
            <Popup>
              Live GPS Unit
            </Popup>
          </Marker>
        )}

        {visibleZones.map(zone => (
          <Circle
            key={zone.label}
            center={[lat, lng]}
            radius={zone.radiusMeters}
            pathOptions={{ color: zone.stroke, fillColor: zone.color, fillOpacity: zone.fillOpacity, weight: 2.5 }}
          >
            <Popup>{zone.label} zone around the report location</Popup>
          </Circle>
        ))}

        <Marker position={[lat, lng]} icon={getReportMarkerIcon(report ?? { description: '', emergencyType: '', detectedIndicators: [] }, serviceType)}>
          <Popup>
            Emergency Location
          </Popup>
        </Marker>
      </MapContainer>
      <div className="grid grid-cols-3 gap-2 border-t border-[#0c3249]/10 px-3 py-2 text-[11px] font-semibold text-[#0c3249]">
        <span>Live GPS {serviceLocation ? 'ON' : 'WAIT'}</span>
        <span>{route ? `${Math.max(1, Math.ceil(route.distanceMeters / 1000))} km route` : 'Route pending'}</span>
        <span className="capitalize" style={{ color: trafficColor }}>
          {tomtomApiKey ? `TomTom ${route?.trafficLevel ?? 'live'}` : `Traffic ${route?.trafficLevel ?? 'n/a'}`}
        </span>
      </div>
    </div>
  );
}
