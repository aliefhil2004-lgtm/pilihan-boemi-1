const WORKFLOW_URL =
  'https://serverless.roboflow.com/aliefs-workspace-bemvh/workflows/emergency-severity-analyzer-1778770846609';

module.exports = async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.statusCode = 405;
    return response.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  if (!process.env.ROBOFLOW_API_KEY) {
    response.statusCode = 500;
    response.setHeader('Content-Type', 'application/json');
    return response.end(JSON.stringify({ error: 'ROBOFLOW_API_KEY is not configured' }));
  }

  try {
    const requestBody =
      typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
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
