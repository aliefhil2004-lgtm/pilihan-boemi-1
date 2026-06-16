export const dangerZones = [
  { label: 'Low', minScale: 1, radiusMeters: 360, color: '#2563eb', stroke: '#1d4ed8', fillOpacity: 0.12 },
  { label: 'Medium', minScale: 5, radiusMeters: 250, color: '#facc15', stroke: '#ca8a04', fillOpacity: 0.16 },
  { label: 'High', minScale: 8, radiusMeters: 160, color: '#dc2626', stroke: '#991b1b', fillOpacity: 0.2 }
];

export function getVisibleDangerZones(scale: number) {
  return dangerZones
    .filter(zone => scale >= zone.minScale)
    .sort((a, b) => b.radiusMeters - a.radiusMeters);
}
