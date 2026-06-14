export interface DrivingRoute {
  distanceMeters: number;
  durationSeconds: number;
  coordinates: Array<[number, number]>;
  trafficDelaySeconds?: number;
  trafficLevel?: 'light' | 'moderate' | 'heavy' | 'severe';
}

export async function fetchDrivingRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<DrivingRoute | null> {
  const params = new URLSearchParams({
    fromLat: String(origin.lat),
    fromLng: String(origin.lng),
    toLat: String(destination.lat),
    toLng: String(destination.lng)
  });

  try {
    const response = await fetch(`/api/route?${params}`);
    if (!response.ok) throw new Error('Route API unavailable');
    return await response.json() as DrivingRoute;
  } catch {
    const latDelta = destination.lat - origin.lat;
    const lngDelta = destination.lng - origin.lng;
    const distanceMeters = Math.hypot(latDelta, lngDelta) * 111000;
    const durationSeconds = Math.max(60, distanceMeters * 1.08);
    return {
      distanceMeters,
      durationSeconds,
      coordinates: [[origin.lng, origin.lat], [destination.lng, destination.lat]],
      trafficDelaySeconds: Math.round(durationSeconds * 0.12),
      trafficLevel: distanceMeters > 3500 ? 'moderate' : 'light'
    };
  }
}
