interface VercelRequest {
  method?: string;
  body?: unknown;
}

interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

const HF_MODEL = process.env.HF_NLP_MODEL || 'joeddav/xlm-roberta-large-xnli';
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

const burnInjuryPattern = /(luka bakar|luka kebakar|kulit terbakar|tubuh terbakar|badan kebakar|tangan kebakar|melepuh|tersiram air panas|terkena air panas|burn wound|burn injury|burned skin|scald)/i;

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
    pattern: /(disiram air keras|disiram bensin|sengaja dibakar|dibakar orang|acid attack|set on fire by|deliberately burned)/i,
    result: {
      type: 'Intentional Burn Assault',
      service: 'police',
      services: ['police', 'ambulance'],
      score: 9,
      indicators: ['API fallback NLP: explicit intentional violence requires police and medical response']
    }
  },
  {
    pattern: burnInjuryPattern,
    result: {
      type: 'Burn Injury Medical Emergency',
      service: 'ambulance',
      services: ['ambulance'],
      score: 8,
      indicators: ['API fallback NLP: burn injury needs medical care; cause is not inferred']
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
    pattern: /(ular|snake|cobra|kobra|python|piton|musang|civet|anjing galak|aggressive dog|rabid dog|biawak|monitor lizard|tawon|lebah|sarang tawon|wasp nest|hewan kecil berbahaya|animal rescue|hewan terjebak|kucing terjebak|anjing terjebak)/i,
    result: {
      type: 'Firefighter - Animal Rescue',
      service: 'fire',
      services: ['fire'],
      score: 6,
      indicators: ['API fallback NLP: firefighter animal rescue needed']
    }
  },
  {
    pattern: /(kebocoran gas|gas bocor|bau gas|gas menyengat|gas leak|gas odor|carbon monoxide|karbon monoksida|hazmat|bau kimia|asap kimia)/i,
    result: {
      type: 'Gas Leak / Hazmat Emergency',
      service: 'fire',
      services: ['fire', 'ambulance'],
      score: 9,
      indicators: ['API fallback NLP: possible gas leak or hazardous material exposure']
    }
  },
  {
    pattern: /(nyeri dada|dada tertindih|serangan jantung|henti jantung|heart attack|cardiac|keringat dingin|menjalar ke lengan|stroke|wajah mencong|bicara pelo|lemah sebelah|slurred speech|face drooping)/i,
    result: {
      type: 'Cardiac / Stroke Emergency',
      service: 'ambulance',
      services: ['ambulance'],
      score: 9,
      indicators: ['API fallback NLP: possible heart attack or stroke symptoms']
    }
  },
  {
    pattern: /(sesak napas|sulit bernapas|tidak bisa bernapas|tidak bernapas|napas berhenti|bibir.*biru|bibir.*membiru|asma parah|respiratory|difficulty breathing|not breathing)/i,
    result: {
      type: 'Respiratory Distress Emergency',
      service: 'ambulance',
      services: ['ambulance'],
      score: 9,
      indicators: ['API fallback NLP: respiratory distress reported in text']
    }
  },
  {
    pattern: /(keracunan|tertelan obat|overdose|poison|poisoning|muntah hebat|paparan kimia|chemical exposure|terhirup racun|menghirup asap kimia)/i,
    result: {
      type: 'Poisoning / Chemical Exposure',
      service: 'ambulance',
      services: ['ambulance', 'fire'],
      score: 8,
      indicators: ['API fallback NLP: possible poisoning or chemical exposure']
    }
  },
  {
    pattern: /(pendarahan|berdarah|darah|luka berat|luka parah|patah tulang|kecelakaan|tabrakan|tertabrak|korban (cedera|luka|berdarah|pingsan|tidak sadar)|pingsan|tidak sadar|injury|bleeding|wound|fracture|accident|crash|unconscious)/i,
    result: {
      type: 'Medical Emergency',
      service: 'ambulance',
      services: ['ambulance'],
      score: 8,
      indicators: ['API fallback NLP: injury or bleeding needs medical response']
    }
  },
  {
    pattern: /(kebakaran|kobaran api|api menyala|api besar|asap tebal|rumah terbakar|gedung terbakar|bangunan terbakar|kendaraan terbakar|ledakan|meledak|fire|flame|active fire|heavy smoke|house on fire|building on fire|vehicle on fire|explosion)/i,
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
