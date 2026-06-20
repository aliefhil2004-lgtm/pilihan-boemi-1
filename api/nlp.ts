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
  'minor medical issue',
  'injury or wound',
  'burn injury medical emergency',
  'burn injury',
  'medical issue',
  'wound',
  'fire rescue emergency',
  'fire emergency',
  'explosion emergency',
  'police security emergency',
  'police emergency',
  'natural disaster',
  'lost property non emergency',
  'threatening incident',
  'dangerous animal threat',
  'large dangerous animal threat',
  'drug related crime',
  'gas leak hazmat emergency',
  'gas leak or hazmat emergency',
  'heart attack or stroke emergency',
  'cardiac emergency',
  'respiratory distress emergency',
  'poisoning or chemical exposure emergency',
  'animal rescue',
  'traffic accident',
  'general emergency'
];

const burnInjuryPattern = /(luka bakar|luka kebakar|kulit terbakar|tubuh terbakar|badan kebakar|tangan kebakar|melepuh|tersiram air panas|terkena air panas|burn wound|burn injury|burned skin|thermal burn|scald)/i;
const explosionPattern = /(\bexplod(?:e|es|ed|ing)?\b|\bexplosion\b|\bblast(?:ed|ing)?\b|\bdetonat(?:e|es|ed|ing|ion)\b|\bblew up\b|\bblown up\b|\bledakan\b|\bmeledak+k?\b|\bmeleduk\b|\bdentuman keras\b|\bletupan\b|\bmeletup\b|\bsumabog\b|\bpagsabog\b|\bvụ nổ\b|\bphát nổ\b|\bvu no\b|\bphat no\b|bom (meledak|explode)|tabung gas (meledak|explode)|boiler (meledak|explode)|gas cylinder exploded)/i;
const activeFirePattern = new RegExp(`(\\bkebakaran\\b|\\bfire\\b|\\bflames?\\b|\\bsmoke\\b|\\basap\\b|kobaran api|api (menyala|besar|menjalar|menyebar)|asap (tebal|hitam)|rumah terbakar|gedung terbakar|bangunan terbakar|kendaraan terbakar|\\bactive fire\\b|\\bopen flames?\\b|\\bheavy smoke\\b|house on fire|building on fire|vehicle on fire|burning (house|building|vehicle|car|forest|room)|${explosionPattern.source})`, 'i');
const nonActiveFireObjectPattern = /\b(fire extinguisher|fire alarm|smoke alarm|smoke detector|fire detector|fire door|fire exit|fire station|fire truck|fire engine|fire hydrant|firefighter|fire fighter|alat pemadam api|pemadam api|tabung apar|apar)\b/i;
const medicalConditionPattern = /(injury|injured|hurt|bleeding|blood|wound|cut|laceration|abrasion|skin irritation|burning sensation|rash|redness|fracture|burn wound|burn injury|scald|pendarahan|berdarah|darah|luka|luka bakar|luka sobek|luka robek|lecet|gores|iritasi|ruam|kemerahan|melepuh|patah|cedera|trauma|unconscious|unresponsive|pingsan|tidak sadar)/i;
const minorMedicalPattern = /(iritasi|skin irritation|burning sensation|ruam|rash|kemerahan|redness|lecet|scrape|abrasi|abrasion|gores|goresan|superficial cut|small cut|shallow cut|minor injury|minor wound|small wound|luka kecil|luka ringan|cedera ringan|memar ringan|keseleo ringan|first[ -]degree burn|luka bakar ringan|pain ringan|sakit ringan)/i;

function hasActiveFireEvidence(value: string) {
  const cleaned = value
    .replace(new RegExp(nonActiveFireObjectPattern.source, 'gi'), ' ')
    .replace(/\b(no|without)\s+(visible\s+)?(fire|flames?|smoke)(\s+(or|and)\s+(fire|flames?|smoke))?/gi, ' ')
    .replace(/\b(tidak ada|tanpa)\s+(api|asap|kebakaran)(\s+(atau|dan)\s+(api|asap|kebakaran))?/gi, ' ');
  return activeFirePattern.test(cleaned);
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function expandTypos(value: string) {
  return value
    .replace(/\blukaa\b/g, 'luka')
    .replace(/\blecettt?\b/g, 'lecet')
    .replace(/\bsesakkk?\b/g, 'sesak')
    .replace(/\bbuanget\b/g, 'banget')
    .replace(/\bterbaka?r\b/g, 'terbakar')
    .replace(/\bbernapa?s\b/g, 'bernapas')
    .replace(/\btida?k\s+sadar\b/g, 'tidak sadar')
    .replace(/\bnggak\b/g, 'tidak')
    .replace(/\bgak\b/g, 'tidak')
    .replace(/\bga\b/g, 'tidak')
    .replace(/\bga?k\b/g, 'tidak');
}

function prepareText(value: string) {
  return expandTypos(normalizeText(value));
}

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
    pattern: minorMedicalPattern,
    result: {
      type: 'Minor Medical Issue',
      service: 'ambulance',
      services: ['ambulance'],
      score: 3,
      indicators: ['API fallback NLP: minor medical issue detected']
    }
  },
  {
    pattern: explosionPattern,
    result: {
      type: 'Explosion Emergency',
      service: 'fire',
      services: ['fire'],
      score: 9.2,
      indicators: ['API fallback NLP: explosion or detonation reported']
    }
  },
  {
    pattern: /(kebakaran|kobaran api|api menyala|api besar|asap tebal|rumah terbakar|gedung terbakar|bangunan terbakar|kendaraan terbakar|fire|flame|active fire|heavy smoke|house on fire|building on fire|vehicle on fire)/i,
    result: {
      type: 'Fire Emergency',
      service: 'fire',
      services: ['fire'],
      score: 8.3,
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

function inferLabelFromText(text: string) {
  const lower = prepareText(text);
  if (burnInjuryPattern.test(lower)) return 'burn injury medical emergency';
  if (minorMedicalPattern.test(lower)) return 'minor medical issue';
  if (medicalConditionPattern.test(lower) || /(kecelakaan|tabrakan|tertabrak|accident|crash)/i.test(lower)) return 'medical emergency';
  if (explosionPattern.test(lower)) return 'explosion emergency';
  if (hasActiveFireEvidence(lower) || /(\bblaze\b)/i.test(lower)) return 'fire rescue emergency';
  if (/(pencurian|maling|rampok|perampokan|begal|kekerasan|berkelahi|senjata|pisau|pistol|polisi|crime|theft|robbery|assault|weapon|knife|gun|police|threat|threatening|armed)/i.test(lower)) return 'police security emergency';
  if (/(banjir|longsor|gempa|tsunami|badai|puting beliung|flood|landslide|earthquake|storm|hurricane|typhoon|cyclone)/i.test(lower)) return 'natural disaster';
  if (/(kebocoran gas|gas bocor|bau gas|gas menyengat|gas leak|gas odor|carbon monoxide|karbon monoksida|hazmat|bau kimia|asap kimia|chemical exposure|poisoning|toxic)/i.test(lower)) return 'gas leak hazmat emergency';
  if (/(nyeri dada|dada tertindih|serangan jantung|henti jantung|heart attack|cardiac|keringat dingin|menjalar ke lengan|stroke|wajah mencong|bicara pelo|lemah sebelah|slurred speech|face drooping|chest pain|heart failure)/i.test(lower)) return 'heart attack or stroke emergency';
  if (/(sesak napas|sulit bernapas|tidak bisa bernapas|tidak bernapas|napas berhenti|bibir.*biru|bibir.*membiru|asma parah|respiratory|difficulty breathing|not breathing|shortness of breath|breathing trouble)/i.test(lower)) return 'respiratory distress emergency';
  if (/(keracunan|tertelan obat|overdose|poison|poisoning|muntah hebat|paparan kimia|chemical exposure|terhirup racun|menghirup asap kimia|toxic|toxicity)/i.test(lower)) return 'poisoning or chemical exposure emergency';
  if (/(ular|snake|cobra|kobra|python|piton|musang|civet|anjing galak|aggressive dog|rabid dog|biawak|monitor lizard|tawon|lebah|sarang tawon|wasp nest|hewan kecil berbahaya|animal rescue|hewan terjebak|kucing terjebak|anjing terjebak|trapped animal|pet rescue)/i.test(lower)) return 'animal rescue';
  return 'general emergency';
}

function enrichClassificationLabels(text: string, classifications: NlpClassification[]) {
  const prepared = prepareText(text);
  const inferredLabel = inferLabelFromText(prepared);
  const hasKnownLabel = classifications.some(item => candidateLabels.includes(item.label));

  if (hasKnownLabel) return classifications;

  return [
    { label: inferredLabel, score: 0.51 },
    ...classifications
  ];
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

function getMedicalFallbackResult(text: string) {
  const prepared = prepareText(text);
  if (!medicalConditionPattern.test(prepared)) return null;

  let score = 5.1;
  let type = burnInjuryPattern.test(prepared) ? 'Burn Injury Medical Emergency' : 'Medical Emergency';
  let severity = 'unspecified medical injury';

  if (/(not breathing|tidak bernapas|napas berhenti|cardiac arrest|henti jantung|unresponsive|tidak responsif|pendarahan tidak berhenti|uncontrolled bleeding|amputation|amputasi|organ terlihat|exposed organ)/i.test(prepared)) {
    score = 9.8;
    severity = 'critical medical signs';
  } else if (/(unconscious|tidak sadar|pingsan|pendarahan hebat|heavy bleeding|bleeding heavily|severe bleeding|profuse bleeding|darah mengalir banyak|banyak darah|pool of blood|large blood pool|severe cut|open wound|luka terbuka|luka sangat dalam|deep wound|gaping wound|third[ -]degree burn|luka bakar derajat tiga|luka bakar luas|extensive burn|burn.*(face|airway)|luka bakar.*(wajah|saluran napas)|patah tulang terbuka|open fracture)/i.test(prepared)) {
    score = 9.1;
    severity = 'severe medical signs';
  } else if (minorMedicalPattern.test(prepared)) {
    score = 3.2;
    type = 'Minor Medical Issue';
    severity = 'minor or superficial injury';
  } else if (/(luka sobek|luka robek|laceration|sobek|robek|jahit|stitches|moderate bleeding|pendarahan sedang|second[ -]degree burn|luka bakar derajat dua|melepuh|blister|chemical burn|luka bakar kimia|patah tulang|fracture)/i.test(prepared)) {
    score = 6.4;
    severity = 'moderate injury requiring prompt care';
  }

  return {
    type,
    service: 'ambulance' as const,
    services: ['ambulance' as const],
    score,
    indicators: [`API fallback medical scale: ${severity}`]
  };
}

function getFallbackResult(text: string) {
  const prepared = prepareText(text);
  const intentional = fallbackRules.find(rule => rule.result.type === 'Intentional Burn Assault' && rule.pattern.test(prepared));
  if (intentional) return intentional.result;
  const medical = getMedicalFallbackResult(prepared);
  if (medical && hasActiveFireEvidence(prepared)) {
    const explosion = explosionPattern.test(prepared);
    return {
      type: explosion ? 'Explosion Emergency with Medical Casualty' : 'Fire Emergency with Medical Casualty',
      service: 'fire' as const,
      services: ['fire' as const, 'ambulance' as const],
      score: Math.max(explosion ? 9.2 : 8.3, medical.score),
      indicators: [`API fallback NLP: ${explosion ? 'explosion' : 'active fire'} is explicit and a medical casualty is also described`]
    };
  }
  if (medical && !hasActiveFireEvidence(prepared)) return medical;
  return fallbackRules.find(rule => {
    if (rule.result.type === 'Fire Emergency' && !hasActiveFireEvidence(prepared)) return false;
    return rule.pattern.test(prepared);
  })?.result ?? medical;
}

function fallbackResponse(text: string, error?: string) {
  const result = getFallbackResult(text);
  return {
    available: Boolean(result),
    model: 'api-fallback-rules',
    classifications: enrichClassificationLabels(text, result ? [{ label: result.type.toLowerCase(), score: result.score / 10 }] : []),
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
        classifications: enrichClassificationLabels(
          text,
          Array.isArray(spaceResult.classifications) ? normalizeClassificationOutput(spaceResult.classifications) : []
        ),
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
      classifications: enrichClassificationLabels(text, normalizeClassificationOutput(result))
    });
  } catch (error) {
    response.status(200).json(fallbackResponse(
      typeof request.body === 'object' && request.body ? String((request.body as { text?: unknown }).text ?? '') : '',
      error instanceof Error ? error.message : 'NLP unavailable'
    ));
  }
}
