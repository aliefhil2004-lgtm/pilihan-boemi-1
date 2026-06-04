import L from 'leaflet';
import type { ServiceType } from '../services/ai';

function markerIcon(symbol: string, background: string) {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 3px solid white;
        border-radius: 9999px;
        background: ${background};
        color: white;
        font-size: 20px;
        font-weight: 800;
        box-shadow: 0 4px 12px rgba(0,0,0,.35);
      ">${symbol}</div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20]
  });
}

export const civilianMarkerIcon = markerIcon('!', '#f97316');

export const serviceMarkerIcons: Record<ServiceType, L.DivIcon> = {
  ambulance: markerIcon('+', '#dc2626'),
  fire: markerIcon('&#128293;', '#ea580c'),
  police: markerIcon('&#128737;', '#4f46e5')
};
