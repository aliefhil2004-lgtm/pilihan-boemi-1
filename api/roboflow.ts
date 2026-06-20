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

const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const REQUEST_BUDGET_MS = 55_000;

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function hasWorkflowOutput(body: string) {
  try {
    const value = JSON.parse(body) as { outputs?: unknown };
    return Array.isArray(value.outputs) && value.outputs.length > 0;
  } catch {
    return false;
  }
}

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

function normalizeWorkflowPayload(requestBody: Record<string, unknown>) {
  if (requestBody.inputs && typeof requestBody.inputs === 'object') {
    return requestBody;
  }

  if (requestBody.image || requestBody.report_text || requestBody.workflow_id || requestBody.workspace_name) {
    return {
      inputs: requestBody
    };
  }

  return requestBody;
}

function isEnhancementOnlyLabel(value: string) {
  return /(upscale|super resolution|enhancement|lighting|light|brightness|contrast|sharpen|denoise|noise reduction|quality|blur|deblur|color correction|image preprocessing|preprocessing|image enhancement|photo quality)/i.test(value);
}

function scrubEnhancementLabels(body: string) {
  try {
    const parsed = JSON.parse(body) as { outputs?: Array<Record<string, unknown>> };
    if (!Array.isArray(parsed.outputs)) return body;
    const outputs = parsed.outputs.map(output => {
      const incidentType = typeof output.incident_type === 'string' ? output.incident_type : '';
      if (isEnhancementOnlyLabel(incidentType)) {
        return {
          ...output,
          incident_type: 'general emergency',
          severity_score: 2,
          description: `${typeof output.description === 'string' ? output.description + ' ' : ''}Image enhancement output ignored for incident routing.`.trim()
        };
      }
      return output;
    });
    return JSON.stringify({ ...parsed, outputs });
  } catch {
    return body;
  }
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Content-Type', 'application/json');

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.statusCode = 405;
    return response.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  const workflowUrl = process.env.ROBOFLOW_WORKFLOW_URL;

  if (!process.env.ROBOFLOW_API_KEY || !workflowUrl) {
    response.statusCode = 503;
    return response.end(JSON.stringify({
      error: 'Roboflow is not configured in this environment'
    }));
  }

  try {
    const requestBody = parseBody(request.body);
    if (!requestBody) {
      response.statusCode = 400;
      return response.end(JSON.stringify({ error: 'Invalid JSON payload' }));
    }

    const startedAt = Date.now();
    let lastError: unknown;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const remainingMs = REQUEST_BUDGET_MS - (Date.now() - startedAt);
      if (remainingMs < 1000) break;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), Math.min(52_000, remainingMs));

      try {
        const payload = normalizeWorkflowPayload(requestBody);
        const roboflowResponse = await fetch(workflowUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            ...payload,
            api_key: process.env.ROBOFLOW_API_KEY
          })
        });
        const body = await roboflowResponse.text();
        const validOutput = roboflowResponse.ok && hasWorkflowOutput(body);

        if (validOutput) {
          response.statusCode = 200;
          response.setHeader('X-Roboflow-Attempts', String(attempt));
          response.setHeader(
            'Content-Type',
            roboflowResponse.headers.get('content-type') || 'application/json'
          );
          return response.end(scrubEnhancementLabels(body));
        }

        if (!roboflowResponse.ok && !RETRYABLE_STATUSES.has(roboflowResponse.status)) {
          response.statusCode = roboflowResponse.status;
          response.setHeader('X-Roboflow-Attempts', String(attempt));
          return response.end(body || JSON.stringify({ error: 'Roboflow request was rejected' }));
        }

        lastError = new Error(
          roboflowResponse.ok
            ? 'Roboflow returned no workflow output'
            : `Transient Roboflow status ${roboflowResponse.status}`
        );
      } catch (error) {
        lastError = error;
      } finally {
        clearTimeout(timeout);
      }

      if (attempt < 2 && REQUEST_BUDGET_MS - (Date.now() - startedAt) > 3000) {
        await wait(750);
      }
    }

    throw lastError ?? new Error('Roboflow returned no valid workflow output');
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
