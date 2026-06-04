interface VercelRequest {
  query?: Record<string, string | string[] | undefined>;
}

interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
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
    const routeResponse = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${encodeURIComponent(fromLng)},${encodeURIComponent(fromLat)};${encodeURIComponent(toLng)},${encodeURIComponent(toLat)}?overview=full&geometries=geojson`
    );
    const result = await routeResponse.json();
    const route = result.routes?.[0];

    if (!route) {
      response.status(404).json({ error: 'Route not found' });
      return;
    }

    response.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=30');
    response.status(200).json({
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      coordinates: route.geometry.coordinates
    });
  } catch {
    response.status(502).json({ error: 'Unable to calculate route' });
  }
}
