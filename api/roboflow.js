const WORKFLOW_URL =
  'https://serverless.roboflow.com/aliefs-workspace-bemvh/workflows/emergency-severity-analyzer-1778770846609';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.ROBOFLOW_API_KEY) {
    return response.status(500).json({ error: 'ROBOFLOW_API_KEY is not configured' });
  }

  try {
    const roboflowResponse = await fetch(WORKFLOW_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...request.body,
        api_key: process.env.ROBOFLOW_API_KEY
      })
    });

    const body = await roboflowResponse.text();
    response.status(roboflowResponse.status);
    response.setHeader(
      'Content-Type',
      roboflowResponse.headers.get('content-type') || 'application/json'
    );
    return response.send(body);
  } catch (error) {
    console.error('Roboflow workflow request failed:', error);
    return response.status(502).json({ error: 'Unable to run Roboflow workflow' });
  }
}
