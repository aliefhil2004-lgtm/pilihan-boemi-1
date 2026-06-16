import L from 'leaflet';
import type { ServiceType, StoredEmergencyReport } from '../types/emergency';

interface MarkerMeta {
  symbol: string;
  label: string;
  background: string;
  fontSize?: number;
}

function markerIcon(symbol: string, background: string, fontSize = 20) {
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
        font-size: ${fontSize}px;
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
  ambulance: markerIcon('🚑', '#6da5c4', 19),
  fire: markerIcon('🚒', '#ea580c', 19),
  police: markerIcon('🚓', '#2563eb', 19)
};

export function getReportMarkerMeta(
  report: Pick<StoredEmergencyReport, 'emergencyType' | 'description' | 'detectedIndicators'>,
  primaryService: ServiceType
): MarkerMeta {
  const context = `${report.emergencyType ?? ''} ${report.description ?? ''} ${report.detectedIndicators?.join(' ') ?? ''}`;

  if (/police ranger|large dangerous animal|hewan buas besar|hewan liar besar|predator besar|buaya|crocodile|harimau|tiger|macan|leopard|panther|beruang|bear|komodo/i.test(context)) {
    return { symbol: '🐯!', label: 'Dangerous animal report', background: '#7c2d12', fontSize: 18 };
  }

  if (/animal rescue|firefighter - animal rescue|small dangerous animal|hewan kecil|ular|snake|kobra|cobra|musang|civet|anjing galak|aggressive dog|sarang tawon|wasp nest|cat rescue|kucing|dog rescue|pet rescue|hewan terjebak|hewan tersangkut/i.test(context)) {
    return { symbol: '🐱!', label: 'Animal rescue report', background: '#b45309', fontSize: 18 };
  }

  if (primaryService === 'ambulance') return { symbol: '+', label: 'Medical report', background: '#dc2626', fontSize: 26 };
  if (primaryService === 'fire') return { symbol: '🔥', label: 'Fire report', background: '#ea580c', fontSize: 20 };
  return { symbol: '🦹', label: 'Crime report', background: '#4f46e5', fontSize: 20 };
}

export function getReportMarkerIcon(
  report: Pick<StoredEmergencyReport, 'emergencyType' | 'description' | 'detectedIndicators'>,
  primaryService: ServiceType
) {
  const meta = getReportMarkerMeta(report, primaryService);
  return markerIcon(meta.symbol, meta.background, meta.fontSize);
}
