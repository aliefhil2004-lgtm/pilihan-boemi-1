export async function reverseGeocode(
  lat: number,
  lng: number,
  fallback = 'Current GPS location'
): Promise<string> {
  try {
    const response = await fetch(`/api/reverse-geocode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`);
    if (!response.ok) return fallback;
    const result = await response.json() as { address?: string };
    return result.address || fallback;
  } catch {
    return fallback;
  }
}
