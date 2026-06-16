interface VercelRequest {
  method?: string;
  body?: unknown;
}

interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

const HF_MODEL = process.env.HF_NLP_MODEL || 'Alief2004/nlp_p2a';
const HF_NLP_API_URL = process.env.HF_NLP_API_URL;
const candidateLabels = [
  'medical emergency',
  'fire rescue emergency',
  'police security emergency',
  'natural disaster',
  'lost property non emergency',
  'threatening incident',
  'dangerous animal threat',
  'large dangerous animal threat',
  'drug related crime',
  'gas leak hazmat emergency',
  'heart attack or stroke emergency',
  'respiratory distress emergency',
  'poisoning or chemical exposure emergency'
];

const fallbackRules: Array<{
  pattern: RegExp;
  result: {
    type: string;
    service: 'ambulance' | 'fire' | 'police';
    services: Array<'ambulance' | 'fire' | 'police'>;
    score: number;
    indicators: string[];
  };
}> = [
  {
    pattern: /(pendarahan|berdarah|darah|luka berat|luka parah|patah tulang|kecelakaan|tabrakan|tertabrak|korban|pingsan|tidak sadar|injury|bleeding|wound|fracture|accident|crash|unconscious)/i,
    result: {
      type: 'Medical Emergency',
      service: 'ambulance',
      services: ['ambulance'],
      score: 8,
      indicators: ['API fallback NLP: injury or bleeding needs medical response']
    }
  },
  {
    pattern: /(kebakaran|api|asap|terbakar|ledakan|meledak|fire|flame|smoke|burning|explosion)/i,
    result: {
      type: 'Fire Emergency',
      service: 'fire',
      services: ['fire'],
      score: 8,
      indicators: ['API fallback NLP: fire or smoke reported']
    }
  },
  {
    pattern: /(pencurian|maling|rampok|perampokan|begal|kekerasan|berkelahi|senjata|pisau|pistol|polisi|crime|theft|robbery|assault|weapon|knife|gun|police)/i,
    result: {
      type: 'Police Emergency',
      service: 'police',
      services: ['police'],
      score: 8,
      indicators: ['API fallback NLP: police or security response needed']
    }
  },
  {
    pattern: /(buaya|crocodile|harimau|tiger|beruang|bear|lion|singa|serigala|wolf|macan|leopard|panther|komodo|hewan buas besar|hewan liar besar|predator besar)/i,
    result: {
      type: 'Police Ranger - Dangerous Animal',
      service: 'police',
      services: ['police'],
      score: 8,
      indicators: ['API fallback NLP: large dangerous animal needs police-ranger response']
    }
  },
  {
    pattern: /(ular|snake|cobra|kobra|python|piton|musang|civet|anjing galak|aggressive dog|rabid dog|biawak|monitor lizard|tawon|lebah|sarang tawon|wasp nest|animal rescue|hewan terjebak|kucing terjebak|anjing terjebak)/i,
    result: {
      type: 'Firefighter - Animal Rescue',
      service: 'fire',
      services: ['fire'],
      score: 6,
      indicators: ['API fallback NLP: firefighter animal rescue needed']
    }
  },
  {
    pattern: /(banjir|longsor|gempa|tsunami|badai|puting beliung|flood|landslide|earthquake|storm)/i,
    result: {
      type: 'Natural Disaster',
      service: 'fire',
      services: ['fire'],
      score: 8,
      indicators: ['API fallback NLP: disaster response needed']
    }
  }
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
  const labels = result.labels as unknown[];
  const scores = result.scores as unknown[];
  return labels
    .map((label, index) => ({
      label: String(label),
      score: Number(scores[index] ?? 0)
    }))
    .filter(item => Number.isFinite(item.score));
}

function normalizeClassificationOutput(value: unknown) {
  if (!value || typeof value !== 'object') return [];

  const payload = value as {
    label?: unknown;
    score?: unknown;
    labels?: unknown;
    scores?: unknown;
  };

  if (typeof payload.label === 'string' && Number.isFinite(Number(payload.score))) {
    return [{ label: payload.label, score: Number(payload.score ?? 0) }];
  }

  return normalizeResult(value) ?? [];
}

function getFallbackResult(text: string) {
  return fallbackRules.find(rule => rule.pattern.test(text))?.result ?? null;
}

function fallbackResponse(text: string, error?: string) {
  const result = getFallbackResult(text);
  return {
    available: Boolean(result),
    model: 'api-fallback-rules',
    classifications: result ? [{ label: result.type.toLowerCase(), score: result.score / 10 }] : [],
    result,
    error
  };
}

function resolveSpaceApiUrl(value: string) {
  const trimmed = value.trim().replace(/\/$/, '');
  return trimmed.endsWith('/classify') ? trimmed : `${trimmed}/classify`;
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Content-Type', 'application/json');

  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = parseBody(request.body);
    const text = String(body.text ?? '').trim();
    if (!text) {
      response.status(400).json({ error: 'Text is required' });
      return;
    }

    if (HF_NLP_API_URL) {
      const spaceResponse = await fetch(resolveSpaceApiUrl(HF_NLP_API_URL), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const spaceResult = await spaceResponse.json();

      if (!spaceResponse.ok) {
        response.status(200).json({
          ...fallbackResponse(text),
          error: spaceResult.error ?? 'NLP Space unavailable'
        });
        return;
      }

      response.status(200).json({
        available: Boolean(spaceResult.available ?? true),
        model: spaceResult.model ?? 'huggingface-space',
        classifications: Array.isArray(spaceResult.classifications) ? spaceResult.classifications : [],
        result: spaceResult.result
      });
      return;
    }

    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (!apiKey) {
      response.status(200).json(fallbackResponse(text, 'HUGGINGFACE_API_KEY is not configured'));
      return;
    }

    const hfResponse = await fetch(`https://api-inference.huggingface.co/models/${HF_MODEL}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: text,
        parameters: HF_MODEL === 'joeddav/xlm-roberta-large-xnli'
          ? { candidate_labels: candidateLabels, multi_label: true }
          : undefined
      })
    });
    const result = await hfResponse.json();

    if (!hfResponse.ok) {
      response.status(200).json(fallbackResponse(text, result.error ?? 'NLP unavailable'));
      return;
    }

    response.status(200).json({
      available: true,
      model: HF_MODEL,
      classifications: normalizeClassificationOutput(result)
    });
  } catch (error) {
    response.status(200).json(fallbackResponse(
      typeof request.body === 'object' && request.body ? String((request.body as { text?: unknown }).text ?? '') : '',
      error instanceof Error ? error.message : 'NLP unavailable'
    ));
  }
}
