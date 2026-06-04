import type { ServiceType } from './ai';

export interface LiveGpsLocation {
  service: ServiceType;
  unit: string;
  lat: number;
  lng: number;
  updatedAt: number;
}

const STORAGE_KEY = 'emergencyServiceLocations';

export function readLiveGps(service: ServiceType): LiveGpsLocation | null {
  const locations = JSON.parse(
    localStorage.getItem(STORAGE_KEY) || '{}'
  ) as Partial<Record<ServiceType, LiveGpsLocation>>;

  return locations[service] ?? null;
}

export async function fetchLiveGps(service: ServiceType): Promise<LiveGpsLocation | null> {
  try {
    const response = await fetch(`/api/live-gps/${service}`);
    if (!response.ok) return readLiveGps(service);
    return await response.json() as LiveGpsLocation;
  } catch {
    return readLiveGps(service);
  }
}

export function publishLiveGps(location: LiveGpsLocation) {
  const locations = JSON.parse(
    localStorage.getItem(STORAGE_KEY) || '{}'
  ) as Partial<Record<ServiceType, LiveGpsLocation>>;

  locations[location.service] = location;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(locations));
  window.dispatchEvent(new Event('emergency-gps-updated'));

  fetch('/api/live-gps', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(location)
  }).catch(() => {
    // Local storage still keeps same-device tracking functional.
  });
}
