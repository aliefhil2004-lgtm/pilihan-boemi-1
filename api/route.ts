interface VercelRequest {
  query?: Record<string, string | string[] | undefined>;
}

interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

declare const process: {
  env: Record<string, string | undefined>;
};

interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
  coordinates: Array<[number, number]>;
}

function buildPolylineCoordinates(points: Array<{ latitude?: number; longitude?: number; lat?: number; lon?: number }>) {
  return points
    .filter(point => Number.isFinite(point.latitude ?? point.lat) && Number.isFinite(point.longitude ?? point.lon))
    .map(point => [
      Number(point.longitude ?? point.lon),
      Number(point.latitude ?? point.lat)
    ] as [number, number]);
}

async function fetchTomTomRoute(fromLat: string, fromLng: string, toLat: string, toLng: string): Promise<RouteResult | null> {
  const apiKey = process.env.TOMTOM_API_KEY;
  if (!apiKey) return null;

  const url = new URL(
    `https://api.tomtom.com/routing/1/calculateRoute/${fromLat},${fromLng}:${toLat},${toLng}/json`
  );
  url.searchParams.set('key', apiKey);
  url.searchParams.set('traffic', 'true');
  url.searchParams.set('routeType', 'fastest');
  url.searchParams.set('travelMode', 'car');
  url.searchParams.set('computeBestOrder', 'false');
  url.searchParams.set('instructionsType', 'text');

  const response = await fetch(url.toString());
  if (!response.ok) return null;

  const result = await response.json();
  const route = result.routes?.[0];
  if (!route) return null;

  const points = route.legs?.flatMap((leg: { points?: Array<{ latitude?: number; longitude?: number; lat?: number; lon?: number }> }) => leg.points ?? []) ?? [];
  const coordinates = buildPolylineCoordinates(points);

  return {
    distanceMeters: Number(route.summary?.lengthInMeters ?? route.summary?.lengthMeters ?? 0),
    durationSeconds: Number(route.summary?.travelTimeInSeconds ?? route.summary?.travelTime ?? 0),
    coordinates: coordinates.length ? coordinates : [[Number(fromLng), Number(fromLat)], [Number(toLng), Number(toLat)]]
  };
}

async function fetchOsrmRoute(fromLat: string, fromLng: string, toLat: string, toLng: string): Promise<RouteResult | null> {
  const routeResponse = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${encodeURIComponent(fromLng)},${encodeURIComponent(fromLat)};${encodeURIComponent(toLng)},${encodeURIComponent(toLat)}?overview=full&geometries=geojson`
  );
  if (!routeResponse.ok) return null;

  const result = await routeResponse.json();
  const route = result.routes?.[0];
  if (!route) return null;

  return {
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    coordinates: route.geometry.coordinates as Array<[number, number]>
  };
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  const fromLat = String(request.query?.fromLat ?? '');
  const fromLng = String(request.query?.fromLng ?? '');
  const toLat = String(request.query?.toLat ?? '');
  const toLng = String(request.query?.toLng ?? '');

  if (![fromLat, fromLng, toLat, toLng].every(value => Number.isFinite(Number(value)))) {
    response.status(400).json({ error: 'Valid origin and destination coordinates are required' });
    return;
  }

  try {
    const route = await fetchTomTomRoute(fromLat, fromLng, toLat, toLng) ?? await fetchOsrmRoute(fromLat, fromLng, toLat, toLng);

    if (!route) {
      response.status(404).json({ error: 'Route not found' });
      return;
    }

    response.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=30');
    response.status(200).json(route);
  } catch {
    response.status(502).json({ error: 'Unable to calculate route' });
  }
}
