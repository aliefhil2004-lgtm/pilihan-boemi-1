import 'leaflet/dist/leaflet.css';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import type { ServiceType } from '../services/ai';
import { serviceMarkerIcons } from '../utils/mapMarkers';

interface EmergencyMapProps {
  lat: number;
  lng: number;
  serviceType?: ServiceType;
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
  serviceType = 'ambulance'
}: EmergencyMapProps) {
  return (
    <div className="rounded-2xl overflow-hidden border border-gray-700">
      <MapContainer
        center={[lat, lng]}
        zoom={15}
        style={{ height: '300px', width: '100%' }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Marker position={[lat, lng]} icon={serviceMarkerIcons[serviceType]}>
          <Popup>
            Emergency Location
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
