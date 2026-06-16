import type { ServiceType } from '../types/emergency';

export interface NlpClassification {
  label: string;
  score: number;
}

export interface NlpEmergencyResult {
  type: string;
  service: ServiceType;
  score: number;
  indicators: string[];
  services?: ServiceType[];
}

const labelMapping: Record<string, { service: ServiceType; type: string; baseScore: number; services?: ServiceType[] }> = {
  'medical emergency': { service: 'ambulance', type: 'Medical Emergency', baseScore: 7 },
  'fire rescue emergency': { service: 'fire', type: 'Fire Emergency', baseScore: 7 },
  'police security emergency': { service: 'police', type: 'Police Emergency', baseScore: 7 },
  'natural disaster': { service: 'fire', type: 'Natural Disaster', baseScore: 8 },
  'lost property non emergency': { service: 'police', type: 'Lost Property Report', baseScore: 2 },
  'threatening incident': { service: 'police', type: 'Police Emergency', baseScore: 7 },
  'dangerous animal threat': { service: 'fire', type: 'Firefighter - Animal Rescue', baseScore: 6 },
  'large dangerous animal threat': { service: 'police', type: 'Police Ranger - Dangerous Animal', baseScore: 8 },
  'drug related crime': { service: 'police', type: 'Police Emergency', baseScore: 8 },
  'gas leak hazmat emergency': { service: 'fire', type: 'Gas Leak / Hazmat Emergency', baseScore: 9, services: ['fire', 'ambulance'] },
  'heart attack or stroke emergency': { service: 'ambulance', type: 'Cardiac / Stroke Emergency', baseScore: 9 },
  'respiratory distress emergency': { service: 'ambulance', type: 'Respiratory Distress Emergency', baseScore: 9 },
  'poisoning or chemical exposure emergency': { service: 'ambulance', type: 'Poisoning / Chemical Exposure', baseScore: 8, services: ['ambulance', 'fire'] }
};

const invisibleEmergencyRules: Array<{
  pattern: RegExp;
  result: NlpEmergencyResult;
}> = [
  {
    pattern: /(buaya|crocodile|harimau|tiger|beruang|bear|lion|singa|serigala|wolf|macan|leopard|panther|komodo|hewan buas besar|hewan liar besar|predator besar)/i,
    result: {
      type: 'Police Ranger - Dangerous Animal',
      service: 'police',
      services: ['police'],
      score: 8,
      indicators: ['NLP animal rule: large dangerous animal needs police-ranger response']
    }
  },
  {
    pattern: /(ular|snake|cobra|kobra|python|piton|musang|civet|anjing galak|aggressive dog|rabid dog|biawak|monitor lizard|tawon|lebah|sarang tawon|wasp nest|hewan kecil berbahaya|animal rescue|hewan terjebak|kucing terjebak|anjing terjebak)/i,
    result: {
      type: 'Firefighter - Animal Rescue',
      service: 'fire',
      services: ['fire'],
      score: 6,
      indicators: ['NLP animal rule: firefighter animal rescue needed']
    }
  },
  {
    pattern: /(kebocoran gas|gas bocor|bau gas|gas menyengat|gas leak|gas odor|carbon monoxide|karbon monoksida|hazmat|bau kimia|asap kimia)/i,
    result: {
      type: 'Gas Leak / Hazmat Emergency',
      service: 'fire',
      services: ['fire', 'ambulance'],
      score: 9,
      indicators: ['NLP blind-spot rule: possible gas leak or hazardous material exposure']
    }
  },
  {
    pattern: /(nyeri dada|dada tertindih|serangan jantung|henti jantung|heart attack|cardiac|keringat dingin|menjalar ke lengan|stroke|wajah mencong|bicara pelo|lemah sebelah|slurred speech|face drooping)/i,
    result: {
      type: 'Cardiac / Stroke Emergency',
      service: 'ambulance',
      services: ['ambulance'],
      score: 9,
      indicators: ['NLP blind-spot rule: possible heart attack or stroke symptoms']
    }
  },
  {
    pattern: /(sesak napas|sulit bernapas|tidak bisa bernapas|tidak bernapas|napas berhenti|bibir.*biru|bibir.*membiru|asma parah|respiratory|difficulty breathing|not breathing)/i,
    result: {
      type: 'Respiratory Distress Emergency',
      service: 'ambulance',
      services: ['ambulance'],
      score: 9,
      indicators: ['NLP blind-spot rule: respiratory distress reported in text']
    }
  },
  {
    pattern: /(keracunan|tertelan obat|overdose|poison|poisoning|muntah hebat|paparan kimia|chemical exposure|terhirup racun|menghirup asap kimia)/i,
    result: {
      type: 'Poisoning / Chemical Exposure',
      service: 'ambulance',
      services: ['ambulance', 'fire'],
      score: 8,
      indicators: ['NLP blind-spot rule: possible poisoning or chemical exposure']
    }
  }
];

const localNlpRules: Array<{
  pattern: RegExp;
  result: NlpEmergencyResult;
}> = [
  ...invisibleEmergencyRules,
  {
    pattern: /(pendarahan|berdarah|darah|luka berat|luka parah|patah tulang|kecelakaan|tabrakan|tertabrak|korban|pingsan|tidak sadar|injury|bleeding|wound|fracture|accident|crash|unconscious)/i,
    result: {
      type: 'Medical Emergency',
      service: 'ambulance',
      services: ['ambulance'],
      score: 8,
      indicators: ['Local NLP rule: injury or bleeding needs medical response']
    }
  },
  {
    pattern: /(kebakaran|api|asap|terbakar|ledakan|meledak|fire|flame|smoke|burning|explosion)/i,
    result: {
      type: 'Fire Emergency',
      service: 'fire',
      services: ['fire'],
      score: 8,
      indicators: ['Local NLP rule: fire or smoke reported']
    }
  },
  {
    pattern: /(pencurian|maling|rampok|perampokan|begal|kekerasan|berkelahi|senjata|pisau|pistol|polisi|crime|theft|robbery|assault|weapon|knife|gun|police)/i,
    result: {
      type: 'Police Emergency',
      service: 'police',
      services: ['police'],
      score: 8,
      indicators: ['Local NLP rule: police or security response needed']
    }
  },
  {
    pattern: /(banjir|longsor|gempa|tsunami|badai|puting beliung|flood|landslide|earthquake|storm)/i,
    result: {
      type: 'Natural Disaster',
      service: 'fire',
      services: ['fire'],
      score: 8,
      indicators: ['Local NLP rule: disaster response needed']
    }
  }
];

function analyzeTextWithLocalSafetyRules(text: string): NlpEmergencyResult | null {
  const rule = localNlpRules.find(item => item.pattern.test(text));
  return rule?.result ?? null;
}

export async function analyzeEmergencyTextWithNlp(text: string): Promise<NlpEmergencyResult | null> {
  if (!text.trim()) return null;
  const localResult = analyzeTextWithLocalSafetyRules(text);

  try {
    const response = await fetch('/api/nlp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (!response.ok) return localResult;
    const result = await response.json() as {
      available?: boolean;
      model?: string;
      classifications?: NlpClassification[];
      result?: Partial<NlpEmergencyResult>;
    };
    if (!result.available) return localResult;

    const remoteResult = result.result;
    if (
      remoteResult &&
      typeof remoteResult.type === 'string' &&
      (remoteResult.service === 'ambulance' || remoteResult.service === 'fire' || remoteResult.service === 'police') &&
      typeof remoteResult.score === 'number'
    ) {
      const normalizedRemote: NlpEmergencyResult = {
        type: remoteResult.type,
        service: remoteResult.service,
        services: remoteResult.services,
        score: remoteResult.score,
        indicators: Array.isArray(remoteResult.indicators) ? remoteResult.indicators : [`NLP text analysis: ${remoteResult.type}`]
      };
      if (localResult && localResult.score >= normalizedRemote.score) return localResult;
      return normalizedRemote;
    }

    if (!result.classifications?.length) return localResult;

    const strongest = [...result.classifications].sort((a, b) => b.score - a.score)[0];
    const mapping = labelMapping[strongest.label];
    if (!mapping || strongest.score < 0.42) return localResult;

    const remoteScore = Math.max(1, Math.min(10, Math.round(mapping.baseScore + strongest.score * 2)));
    if (localResult && localResult.score >= remoteScore) return localResult;

    return {
      type: mapping.type,
      service: mapping.service,
      services: mapping.services,
      score: remoteScore,
      indicators: [
        `NLP text analysis: ${mapping.type} (${Math.round(strongest.score * 100)}% confidence)`
      ]
    };
  } catch {
    return localResult;
  }
}
