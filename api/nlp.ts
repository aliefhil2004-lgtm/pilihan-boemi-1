interface VercelRequest {
  method?: string;
  body?: unknown;
}

interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

const HF_MODEL = 'joeddav/xlm-roberta-large-xnli';
const candidateLabels = [
  'medical emergency',
  'fire rescue emergency',
  'police security emergency',
  'natural disaster',
  'lost property non emergency'
];

function parseBody(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') return JSON.parse(value);
  if (value && typeof value === 'object') return value as Record<string, unknown>;
  return {};
}

function normalizeResult(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const result = value as { labels?: unknown; scores?: unknown };
  if (!Array.isArray(result.labels) || !Array.isArray(result.scores)) return null;
  return result.labels
    .map((label, index) => ({
      label: String(label),
      score: Number(result.scores?.[index] ?? 0)
    }))
    .filter(item => Number.isFinite(item.score));
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Content-Type', 'application/json');

  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!process.env.HUGGINGFACE_API_KEY) {
    response.status(200).json({ available: false, classifications: [] });
    return;
  }

  try {
    const body = parseBody(request.body);
    const text = String(body.text ?? '').trim();
    if (!text) {
      response.status(400).json({ error: 'Text is required' });
      return;
    }

    const hfResponse = await fetch(`https://api-inference.huggingface.co/models/${HF_MODEL}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: text,
        parameters: { candidate_labels: candidateLabels, multi_label: true }
      })
    });
    const result = await hfResponse.json();

    if (!hfResponse.ok) {
      response.status(200).json({ available: false, classifications: [], error: result.error ?? 'NLP unavailable' });
      return;
    }

    response.status(200).json({
      available: true,
      model: HF_MODEL,
      classifications: normalizeResult(result) ?? []
    });
  } catch (error) {
    response.status(200).json({
      available: false,
      classifications: [],
      error: error instanceof Error ? error.message : 'NLP unavailable'
    });
  }
}
