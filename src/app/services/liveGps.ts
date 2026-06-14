import type { ServiceType } from './ai';
import { fetchLiveGpsFromFirebase, syncLiveGpsToFirebase } from './firebaseSync';

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
  const firebaseLocation = await fetchLiveGpsFromFirebase(service);
  if (firebaseLocation) return firebaseLocation;
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
  void syncLiveGpsToFirebase(location);

  fetch('/api/live-gps', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(location)
  }).catch(() => {
    // Local storage still keeps same-device tracking functional.
  });
}

export function publishLiveGpsSilent(location: LiveGpsLocation) {
  const locations = JSON.parse(
    localStorage.getItem(STORAGE_KEY) || '{}'
  ) as Partial<Record<ServiceType, LiveGpsLocation>>;

  locations[location.service] = location;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(locations));
  window.dispatchEvent(new Event('emergency-gps-updated'));
  void syncLiveGpsToFirebase(location);
}

export async function startAutoLiveGps(service: ServiceType, unit: string, onUpdate?: (location: LiveGpsLocation) => void) {
  const pushLocation = async (lat: number, lng: number) => {
    const location: LiveGpsLocation = {
      service,
      unit,
      lat,
      lng,
      updatedAt: Date.now()
    };
    publishLiveGpsSilent(location);
    onUpdate?.(location);
  };

  const updateFromNavigator = async () => {
    if (!navigator.geolocation) return false;
    return new Promise<boolean>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        position => {
          void pushLocation(position.coords.latitude, position.coords.longitude).then(() => resolve(true));
        },
        () => resolve(false),
        { enableHighAccuracy: true, maximumAge: 15000, timeout: 10000 }
      );
    });
  };

  const started = await updateFromNavigator();
  if (!started) {
    const fallback = readLiveGps(service);
    if (fallback) {
      onUpdate?.(fallback);
      return () => {};
    }
  }

  const interval = window.setInterval(() => {
    void updateFromNavigator();
  }, 30000);

  const handleVisibility = () => {
    if (document.visibilityState === 'visible') void updateFromNavigator();
  };
  document.addEventListener('visibilitychange', handleVisibility);

  return () => {
    window.clearInterval(interval);
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}
