import type { ServiceType } from './ai';
import { deleteLiveGpsFromFirebase, fetchLiveGpsFromFirebase, syncLiveGpsToFirebase } from './firebaseSync';

export interface LiveGpsLocation {
  service: ServiceType;
  reportId?: string;
  unit: string;
  lat: number;
  lng: number;
  updatedAt: number;
}

const STORAGE_KEY = 'emergencyServiceLocations';

function locationKey(service: ServiceType, reportId?: string) {
  return reportId ? `${service}:${reportId}` : service;
}

export function readLiveGps(service: ServiceType, reportId?: string): LiveGpsLocation | null {
  const locations = JSON.parse(
    localStorage.getItem(STORAGE_KEY) || '{}'
  ) as Record<string, LiveGpsLocation>;

  return locations[locationKey(service, reportId)] ?? (!reportId ? locations[service] : null) ?? null;
}

export async function fetchLiveGps(service: ServiceType, reportId?: string): Promise<LiveGpsLocation | null> {
  const firebaseLocation = await fetchLiveGpsFromFirebase(service, reportId);
  if (firebaseLocation && (!reportId || firebaseLocation.reportId === reportId)) return firebaseLocation;
  try {
    const response = await fetch(`/api/live-gps/${service}`);
    if (!response.ok) return readLiveGps(service, reportId);
    const apiLocation = await response.json() as LiveGpsLocation;
    return !reportId || apiLocation.reportId === reportId ? apiLocation : readLiveGps(service, reportId);
  } catch {
    return readLiveGps(service, reportId);
  }
}

export function publishLiveGps(location: LiveGpsLocation) {
  const locations = JSON.parse(
    localStorage.getItem(STORAGE_KEY) || '{}'
  ) as Record<string, LiveGpsLocation>;

  locations[locationKey(location.service, location.reportId)] = location;
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
  ) as Record<string, LiveGpsLocation>;

  locations[locationKey(location.service, location.reportId)] = location;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(locations));
  window.dispatchEvent(new Event('emergency-gps-updated'));
  void syncLiveGpsToFirebase(location);
}

export function clearLiveGps(service: ServiceType, reportId?: string) {
  const locations = JSON.parse(
    localStorage.getItem(STORAGE_KEY) || '{}'
  ) as Record<string, LiveGpsLocation>;

  delete locations[locationKey(service, reportId)];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(locations));
  window.dispatchEvent(new Event('emergency-gps-updated'));
  void deleteLiveGpsFromFirebase(service, reportId);
}

export async function startAutoLiveGps(service: ServiceType, unit: string, onUpdate?: (location: LiveGpsLocation) => void, reportId?: string) {
  const pushLocation = async (lat: number, lng: number) => {
    const location: LiveGpsLocation = {
      service,
      reportId,
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
    const fallback = readLiveGps(service, reportId);
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
