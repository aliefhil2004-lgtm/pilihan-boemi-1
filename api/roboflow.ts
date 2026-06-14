const WORKFLOW_URL =
  'https://serverless.roboflow.com/aliefs-workspace-bemvh/workflows/emergency-severity-analyzer-1778770846609';

declare const process: {
  env: Record<string, string | undefined>;
};

type VercelRequest = {
  method?: string;
  body?: unknown;
};

type VercelResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
};

function parseBody(value: unknown) {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  if (value && typeof value === 'object') {
    return value as Record<string, unknown>;
  }

  return {} as Record<string, unknown>;
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Content-Type', 'application/json');

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.statusCode = 405;
    return response.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  if (!process.env.ROBOFLOW_API_KEY) {
    const requestBody = parseBody(request.body);
    const reportText = typeof requestBody?.inputs?.report_text === 'string'
      ? requestBody.inputs.report_text.toLowerCase()
      : '';
    const disasterType = /tsunami/.test(reportText)
      ? 'tsunami'
      : /earthquake|gempa/.test(reportText)
      ? 'earthquake'
      : /flood|banjir/.test(reportText)
      ? 'flood'
      : /landslide|longsor/.test(reportText)
      ? 'landslide'
      : /volcanic|gunung meletus|erupsi/.test(reportText)
      ? 'volcanic eruption'
      : 'general emergency';
    response.statusCode = 200;
    return response.end(JSON.stringify({
      outputs: [{
        incident_type: disasterType,
        severity_score: 5,
        description: 'Roboflow is not configured in this environment; returning a neutral fallback response.',
        confidence: 0.25,
        predictions: []
      }]
    }));
  }

  try {
    const requestBody = parseBody(request.body);
    if (!requestBody) {
      response.statusCode = 400;
      return response.end(JSON.stringify({ error: 'Invalid JSON payload' }));
    }

    const roboflowResponse = await fetch(WORKFLOW_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...requestBody,
        api_key: process.env.ROBOFLOW_API_KEY
      })
    });

    const body = await roboflowResponse.text();
    response.statusCode = roboflowResponse.status;
    response.setHeader(
      'Content-Type',
      roboflowResponse.headers.get('content-type') || 'application/json'
    );
    return response.end(body);
  } catch (error) {
    console.error('Roboflow workflow request failed:', error);
    response.statusCode = 502;
    response.setHeader('Content-Type', 'application/json');
    return response.end(JSON.stringify({
      error: 'Unable to run Roboflow workflow',
      detail: error instanceof Error ? error.message : String(error)
    }));
  }
}
