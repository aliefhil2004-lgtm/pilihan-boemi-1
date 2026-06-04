export interface DrivingRoute {
  distanceMeters: number;
  durationSeconds: number;
  coordinates: Array<[number, number]>;
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
    if (!response.ok) return null;
    return await response.json() as DrivingRoute;
  } catch {
    return null;
  }
}
