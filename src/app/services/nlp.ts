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

const burnInjuryPattern = /(luka bakar|luka kebakar|kulit terbakar|tubuh terbakar|badan kebakar|tangan kebakar|melepuh|tersiram air panas|terkena air panas|burn wound|burn injury|burned skin|thermal burn|scald)/i;
const explosionPattern = /(\bexplod(?:e|es|ed|ing)?\b|\bexplosion\b|\bblast(?:ed|ing)?\b|\bdetonat(?:e|es|ed|ing|ion)\b|\bblew up\b|\bblown up\b|\bledakan\b|\bmeledak+k?\b|\bmeleduk\b|\bdentuman keras\b|\bletupan\b|\bmeletup\b|\bsumabog\b|\bpagsabog\b|\bvụ nổ\b|\bphát nổ\b|\bvu no\b|\bphat no\b|bom (meledak|explode)|tabung gas (meledak|explode)|boiler (meledak|explode)|gas cylinder exploded)/i;
const activeFirePattern = new RegExp(`(\\bkebakaran\\b|\\bfire\\b|\\bflames?\\b|\\bsmoke\\b|\\basap\\b|kobaran api|api (menyala|besar|menjalar|menyebar)|asap (tebal|hitam)|rumah terbakar|gedung terbakar|bangunan terbakar|kendaraan terbakar|\\bactive fire\\b|\\bopen flames?\\b|\\bheavy smoke\\b|house on fire|building on fire|vehicle on fire|burning (house|building|vehicle|car|forest|room)|${explosionPattern.source})`, 'i');
const intentionalViolencePattern = /(disiram air keras|disiram bensin|sengaja dibakar|dibakar orang|assault|attack|weapon|penyerangan|senjata)/i;
const medicalConditionPattern = /(injury|injured|hurt|bleeding|blood|wound|cut|laceration|abrasion|skin irritation|burning sensation|rash|redness|fracture|burn wound|burn injury|scald|pendarahan|berdarah|darah|luka|luka bakar|luka sobek|luka robek|lecet|gores|iritasi|ruam|kemerahan|melepuh|patah|cedera|trauma|unconscious|unresponsive|pingsan|tidak sadar)/i;
const minorMedicalPattern = /(iritasi|skin irritation|burning sensation|ruam|rash|kemerahan|redness|lecet|scrape|abrasi|abrasion|gores|goresan|superficial cut|small cut|shallow cut|minor injury|minor wound|small wound|luka kecil|luka ringan|cedera ringan|memar ringan|keseleo ringan|first[ -]degree burn|luka bakar ringan)/i;

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function englishSignalBoost(text: string) {
  return /(emergency|help|ambulance|fire|smoke|burn|injury|wound|bleeding|weapon|gun|knife|theft|robbery|assault|accident|crash|flood|earthquake|landslide|storm|gas leak|hazmat|poison|poisoning|heart attack|stroke|difficulty breathing|not breathing|trapped animal|animal rescue)/i.test(text);
}

function expandTypos(value: string) {
  return value
    .replace(/\blukaa\b/g, 'luka')
    .replace(/\blecettt?\b/g, 'lecet')
    .replace(/\bsesakkk?\b/g, 'sesak')
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

const labelMapping: Record<string, { service: ServiceType; type: string; baseScore: number; services?: ServiceType[] }> = {
  'medical emergency': { service: 'ambulance', type: 'Medical Emergency', baseScore: 7 },
  'minor medical issue': { service: 'ambulance', type: 'Minor Medical Issue', baseScore: 2 },
  'injury or wound': { service: 'ambulance', type: 'Medical Emergency', baseScore: 5 },
  'burn injury medical emergency': { service: 'ambulance', type: 'Burn Injury Medical Emergency', baseScore: 5 },
  'burn injury': { service: 'ambulance', type: 'Burn Injury Medical Emergency', baseScore: 5 },
  'medical issue': { service: 'ambulance', type: 'Medical Emergency', baseScore: 4 },
  'wound': { service: 'ambulance', type: 'Medical Emergency', baseScore: 5 },
  'fire rescue emergency': { service: 'fire', type: 'Fire Emergency', baseScore: 7 },
  'explosion emergency': { service: 'fire', type: 'Explosion Emergency', baseScore: 9 },
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
    pattern: /(disiram air keras|disiram bensin|sengaja dibakar|dibakar orang|acid attack|set on fire by|deliberately burned)/i,
    result: {
      type: 'Intentional Burn Assault',
      service: 'police',
      services: ['police', 'ambulance'],
      score: 9,
      indicators: ['Local NLP rule: explicit intentional violence requires police and medical response']
    }
  },
  {
    pattern: burnInjuryPattern,
    result: {
      type: 'Burn Injury Medical Emergency',
      service: 'ambulance',
      services: ['ambulance'],
      score: 8,
      indicators: ['Local NLP rule: burn injury needs medical care; cause is not inferred']
    }
  },
  {
    pattern: /(pendarahan|berdarah|darah|luka berat|luka parah|patah tulang|kecelakaan|tabrakan|tertabrak|korban (cedera|luka|berdarah|pingsan|tidak sadar)|pingsan|tidak sadar|injury|bleeding|wound|fracture|accident|crash|unconscious)/i,
    result: {
      type: 'Medical Emergency',
      service: 'ambulance',
      services: ['ambulance'],
      score: 8,
      indicators: ['Local NLP rule: injury or bleeding needs medical response']
    }
  },
  {
    pattern: explosionPattern,
    result: {
      type: 'Explosion Emergency',
      service: 'fire',
      services: ['fire'],
      score: 9.2,
      indicators: ['Local NLP rule: explosion or detonation reported']
    }
  },
  {
    pattern: /(kebakaran|kobaran api|api menyala|api besar|asap tebal|rumah terbakar|gedung terbakar|bangunan terbakar|kendaraan terbakar|fire|flame|active fire|heavy smoke|house on fire|building on fire|vehicle on fire)/i,
    result: {
      type: 'Fire Emergency',
      service: 'fire',
      services: ['fire'],
      score: 8.3,
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

function classifyMedicalCondition(text: string): NlpEmergencyResult | null {
  if (!medicalConditionPattern.test(text)) return null;

  let score = 5.1;
  let type = burnInjuryPattern.test(text) ? 'Burn Injury Medical Emergency' : 'Medical Emergency';
  let severity = 'unspecified medical injury';

  if (/(not breathing|tidak bernapas|napas berhenti|cardiac arrest|henti jantung|unresponsive|tidak responsif|pendarahan tidak berhenti|uncontrolled bleeding|amputation|amputasi|organ terlihat|exposed organ)/i.test(text)) {
    score = 9.8;
    severity = 'critical medical signs';
  } else if (/(unconscious|tidak sadar|pingsan|pendarahan hebat|heavy bleeding|severe bleeding|luka sangat dalam|deep wound|gaping wound|third[ -]degree burn|luka bakar derajat tiga|luka bakar luas|extensive burn|burn.*(face|airway)|luka bakar.*(wajah|saluran napas)|patah tulang terbuka|open fracture)/i.test(text)) {
    score = 9.1;
    severity = 'severe medical signs';
  } else if (minorMedicalPattern.test(text)) {
    score = 3.2;
    type = 'Minor Medical Issue';
    severity = 'minor or superficial injury';
  } else if (/(luka sobek|luka robek|laceration|sobek|robek|jahit|stitches|moderate bleeding|pendarahan sedang|second[ -]degree burn|luka bakar derajat dua|melepuh|blister|chemical burn|luka bakar kimia|patah tulang|fracture)/i.test(text)) {
    score = 6.4;
    severity = 'moderate injury requiring prompt care';
  }

  return {
    type,
    service: 'ambulance',
    services: ['ambulance'],
    score,
    indicators: [`Local NLP medical scale: ${severity}`]
  };
}

function analyzeTextWithLocalSafetyRules(text: string): NlpEmergencyResult | null {
  const prepared = prepareText(text);
  const intentionalRule = localNlpRules.find(item => intentionalViolencePattern.test(prepared) && item.result.type === 'Intentional Burn Assault');
  if (intentionalRule) return intentionalRule.result;
  const invisibleRule = invisibleEmergencyRules.find(item => item.pattern.test(prepared));
  if (invisibleRule) return invisibleRule.result;
  const medicalResult = classifyMedicalCondition(prepared);
  if (medicalResult && activeFirePattern.test(prepared)) {
    const explosion = explosionPattern.test(prepared);
    return {
      type: explosion ? 'Explosion Emergency with Medical Casualty' : 'Fire Emergency with Medical Casualty',
      service: 'fire',
      services: ['fire', 'ambulance'],
      score: Math.max(explosion ? 9.2 : 8.3, medicalResult.score),
      indicators: [`Local NLP rule: ${explosion ? 'explosion' : 'active fire'} is explicit and a medical casualty is also described`]
    };
  }
  if (medicalResult) return medicalResult;
  const rule = localNlpRules.find(item => item.pattern.test(prepared));
  if (rule) return rule.result;
  if (!englishSignalBoost(prepared)) return null;
  if (explosionPattern.test(prepared)) return { type: 'Explosion Emergency', service: 'fire', services: ['fire'], score: 9.2, indicators: ['Local NLP rule: explosion or detonation reported'] };
  if (activeFirePattern.test(prepared) || /(\bblaze\b|\bsmoke\b)/i.test(prepared)) return { type: 'Fire Emergency', service: 'fire', services: ['fire'], score: 8.3, indicators: ['Local NLP rule: active fire or smoke reported'] };
  if (/(burn|scald|luka bakar|terbakar)/i.test(prepared)) return classifyMedicalCondition(`burn injury ${prepared}`);
  if (/(weapon|gun|knife|robbery|theft|assault|threat|armed|crime|police)/i.test(prepared)) return { type: 'Police Emergency', service: 'police', services: ['police'], score: 8, indicators: ['Local NLP rule: police or security response needed'] };
  if (/(accident|crash|injury|wound|bleeding|hurt|trauma|cut|laceration|medical|patient|shortness of breath|difficulty breathing|not breathing|heart attack|stroke)/i.test(prepared)) return { type: 'Medical Emergency', service: 'ambulance', services: ['ambulance'], score: 8, indicators: ['Local NLP rule: injury or medical issue needs medical response'] };
  return null;
}

export async function analyzeEmergencyTextWithNlp(text: string): Promise<NlpEmergencyResult | null> {
  if (!text.trim()) return null;
  const localResult = analyzeTextWithLocalSafetyRules(text);
  const prepared = prepareText(text);
  if (medicalConditionPattern.test(prepared) && !activeFirePattern.test(prepared) && !intentionalViolencePattern.test(prepared)) {
    return localResult;
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) return localResult;

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

    const remoteScore = Math.max(
      1,
      Math.min(10, Math.round((mapping.baseScore + (strongest.score - 0.5) * 1.2) * 10) / 10)
    );
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
