type VercelRequest = {
  method?: string;
  query?: Record<string, string | string[]>;
};

type VercelResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
};

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Content-Type', 'application/json');
  if (request.method !== 'GET') {
    response.statusCode = 405;
    return response.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  const lat = Array.isArray(request.query?.lat) ? request.query?.lat[0] : request.query?.lat;
  const lng = Array.isArray(request.query?.lng) ? request.query?.lng[0] : request.query?.lng;
  if (!lat || !lng) {
    response.statusCode = 400;
    return response.end(JSON.stringify({ error: 'Latitude and longitude are required' }));
  }

  try {
    const geocodeResponse = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&zoom=18&addressdetails=1`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'EmergencyConnect-ASEAN/1.0' } }
    );
    const result = await geocodeResponse.json() as { display_name?: string };
    response.statusCode = geocodeResponse.ok ? 200 : geocodeResponse.status;
    return response.end(JSON.stringify({ address: result.display_name }));
  } catch {
    response.statusCode = 502;
    return response.end(JSON.stringify({ error: 'Unable to find address' }));
  }
}
