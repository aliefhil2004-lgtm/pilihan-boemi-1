import { analyzeEmergencyImage } from '../roboflow';
import { isRoboflowEnhancementOnlyIncident } from '../roboflow';
import { analyzeEmergencyWithYolo } from './yolo';
import { analyzeEmergencyTextWithNlp } from './nlp';
import { anonymizePhotoPixels, detectPrivacyRegionsFromPhoto } from './privacyDetector';
import { assessVisualReliability } from './visualReliability';
import type { PrivacyRegion } from '../types/emergency';
import type { ResponseRole, ServiceType } from '../types/emergency';
export type { ServiceType } from '../types/emergency';

export interface AIResult {
  type: string;
  severity: 'High' | 'Medium' | 'Low';
  severityScore: number;
  service: ServiceType;
  services: ServiceType[];
  responsePlan: ResponseRole[];
  priorityRole: ResponseRole;
  indicators: string[];
  assessmentSummary?: string;
  annotatedImage?: string;
  anonymizedImage?: string;
  privacyRegions?: PrivacyRegion[];
  isFalseReport: boolean;
  falseReportReason?: string;
}

interface ImageAssessment {
  incidentType: string;
  severityScore: number;
  description?: string;
  annotatedImage?: string;
  confidence?: number;
  privacyRegions?: PrivacyRegion[];
  visualServices?: ServiceType[];
}

interface Classification {
  type: string;
  service: ServiceType;
  score: number;
  indicators: string[];
}

interface Signal {
  source: 'text' | 'nlp' | 'vision';
  type: string;
  service: ServiceType;
  score: number;
  indicators: string[];
}

function mergePrivacyRegions(...regionGroups: Array<PrivacyRegion[] | undefined>) {
  const regions = regionGroups.flatMap(group => group ?? []);
  return regions.filter((region, index) => {
    const centerX = region.left + region.width / 2;
    const centerY = region.top + region.height / 2;
    return !regions.slice(0, index).some(previous => {
      const previousCenterX = previous.left + previous.width / 2;
      const previousCenterY = previous.top + previous.height / 2;
      return (
        previous.label === region.label &&
        Math.abs(previousCenterX - centerX) < 7 &&
        Math.abs(previousCenterY - centerY) < 7
      );
    });
  });
}

interface FusionResult {
  type: string;
  service: ServiceType;
  score: number;
  sourceScore: number;
  indicators: string[];
  assessmentSummary?: string;
  services: ServiceType[];
  responsePlan: ResponseRole[];
  priorityRole: ResponseRole;
  isFalseReport: boolean;
  falseReportReason?: string;
}

const baseSignalWeights: Record<Signal['source'], number> = {
  text: 0.25,
  nlp: 0.3,
  vision: 0.45
};

const invisibleEmergencyPattern =
  /(gas leak|gas odor|kebocoran gas|gas bocor|bau gas|carbon monoxide|karbon monoksida|hazmat|bau kimia|asap kimia|chemical exposure|paparan kimia|poisoning|keracunan|overdose|nyeri dada|dada tertindih|heart attack|serangan jantung|cardiac|stroke|wajah mencong|bicara pelo|slurred speech|face drooping|sesak napas|sulit bernapas|difficulty breathing|not breathing|tidak bernapas|internal bleeding|pendarahan dalam|cedera dalam|internal injury|concussion|gegar otak|whiplash|nyeri perut hebat|severe abdominal pain)/i;

function isInvisibleEmergencySignal(signal: Signal, text: string) {
  return invisibleEmergencyPattern.test(`${signal.type} ${signal.indicators.join(' ')} ${text}`);
}

function getSignalWeight(signal: Signal, context: { hasPhoto: boolean; text: string }) {
  if (signal.source === 'nlp') {
    if (!context.text.trim()) return 0;
    if (isInvisibleEmergencySignal(signal, context.text)) return context.hasPhoto ? 0.3 : 0.3;
    return context.hasPhoto ? 0.3 : 0.3;
  }

  if (signal.source === 'text') return 0;
  if (signal.source === 'vision') return context.hasPhoto ? 0.7 : 1;
  return baseSignalWeights[signal.source];
}

const rules: Array<{
  service: ServiceType;
  type: string;
  score: number;
  indicator: string;
  keywords: string[];
}> = [
  {
    service: 'fire', type: 'Tsunami', score: 10,
    indicator: 'Tsunami impact or warning detected',
    keywords: ['tsunami', 'gelombang besar', 'gelombang pasang']
  },
  {
    service: 'fire', type: 'Volcanic Eruption', score: 9,
    indicator: 'Volcanic eruption impact detected',
    keywords: ['volcanic eruption', 'volcano eruption', 'gunung meletus', 'erupsi gunung', 'erupsi vulkanik']
  },
  {
    service: 'fire', type: 'Earthquake', score: 8,
    indicator: 'Earthquake impact detected',
    keywords: ['earthquake', 'gempa bumi', 'gempa']
  },
  {
    service: 'fire', type: 'Severe Storm', score: 8,
    indicator: 'Severe storm impact detected',
    keywords: ['typhoon', 'hurricane', 'cyclone', 'tornado', 'topan', 'puting beliung', 'badai besar']
  },
  {
    service: 'fire', type: 'Landslide', score: 7,
    indicator: 'Landslide impact detected',
    keywords: ['landslide', 'tanah longsor', 'longsor']
  },
  {
    service: 'fire', type: 'Flood', score: 6,
    indicator: 'Flood impact detected',
    keywords: ['flash flood', 'flood', 'banjir bandang', 'banjir']
  },
  {
    service: 'fire', type: 'Explosion Emergency', score: 9,
    indicator: 'Explosion or hazardous fire risk detected',
    keywords: ['explode', 'exploded', 'exploding', 'explosion', 'blast', 'detonation', 'blew up', 'blown up', 'ledakan', 'meledak', 'meleduk', 'letupan', 'meletup', 'sumabog', 'pagsabog', 'gas leak', 'kebocoran gas', 'trapped in fire', 'terjebak api']
  },
  {
    service: 'fire', type: 'Gas Leak / Hazmat Emergency', score: 9,
    indicator: 'Gas leak or hazardous material exposure reported',
    keywords: [
      'kebocoran gas', 'gas bocor', 'bau gas', 'gas menyengat', 'gas leak', 'gas odor',
      'carbon monoxide', 'karbon monoksida', 'hazmat', 'bau kimia', 'asap kimia'
    ]
  },
  {
    service: 'fire', type: 'Fire Emergency', score: 8,
    indicator: 'Active structural fire detected',
    keywords: ['building fire', 'house fire', 'wildfire', 'kebakaran gedung', 'kebakaran rumah', 'kebakaran hutan', 'api menyebar']
  },
  {
    service: 'fire', type: 'Fire Emergency', score: 5,
    indicator: 'Fire or smoke reported',
    keywords: ['fire emergency', 'active fire', 'visible flame', 'open flame', 'heavy smoke', 'thick smoke', 'black smoke', 'kebakaran', 'kobaran api', 'api menyala', 'asap tebal']
  },
  {
    service: 'police', type: 'Police Emergency', score: 10,
    indicator: 'Immediate armed security threat detected',
    keywords: [
      'shooting', 'hostage', 'active shooter', 'school shooter', 'armed person at school',
      'penembakan', 'sandera', 'bom', 'bomb', 'orang bersenjata di sekolah',
      'membawa senjata api ke sekolah'
    ]
  },
  {
    service: 'police', type: 'Police Emergency', score: 8,
    indicator: 'Violent or armed incident detected',
    keywords: [
      'armed', 'weapon', 'gun', 'firearm', 'handgun', 'rifle', 'shotgun', 'pistol',
      'knife', 'assault', 'robbery', 'bersenjata', 'senjata api', 'senjata', 'pisau',
      'serangan', 'perampokan', 'membawa pistol', 'bawa pistol', 'membawa senjata'
    ]
  },
  {
    service: 'police', type: 'Police Emergency', score: 4,
    indicator: 'Police assistance requested',
    keywords: ['theft', 'fight', 'vandalism', 'police', 'pencurian', 'berkelahi', 'kerusuhan', 'polisi', 'threat', 'threatening', 'threatened', 'murder', 'killer', 'kill', 'violence']
  },
  {
    service: 'police', type: 'Police Emergency', score: 8,
    indicator: 'Drug-related criminal activity detected',
    keywords: [
      'drugs', 'drug dealing', 'selling drugs', 'selling drug', 'narcotics', 'narkoba', 'narkotika',
      'drug dealer', 'dealer', 'trafficking', 'drug trafficking', 'sabu', 'ganja', 'meth', 'cocaine', 'obat terlarang'
    ]
  },
  {
    service: 'police', type: 'Police Ranger - Dangerous Animal', score: 8,
    indicator: 'Large dangerous animal requires police-ranger response',
    keywords: [
      'large dangerous animal', 'big wild animal', 'wild animal attack', 'large predator',
      'buaya', 'crocodile', 'harimau', 'tiger', 'beruang', 'bear', 'lion', 'singa',
      'serigala', 'wolf', 'macan', 'leopard', 'panther', 'komodo', 'hewan buas besar',
      'hewan liar besar', 'predator besar'
    ]
  },
  {
    service: 'fire', type: 'Firefighter - Animal Rescue', score: 6,
    indicator: 'Small dangerous animal or animal rescue requires firefighter animal rescue',
    keywords: [
      'animal rescue', 'animal_rescue', 'animal-rescue', 'animal trapped', 'animal stuck',
      'snake', 'ular', 'ular masuk rumah', 'ular berbisa', 'cobra', 'kobra', 'python', 'piton',
      'civet', 'musang', 'anjing galak', 'aggressive dog', 'rabid dog', 'biawak', 'monitor lizard',
      'tawon', 'lebah', 'sarang tawon', 'wasp nest', 'hewan kecil berbahaya',
      'small dangerous animal', 'cat stuck in tree', 'cat rescue', 'dog rescue', 'pet rescue',
      'hewan terjebak', 'hewan tersangkut', 'anjing terjebak', 'kucing terjebak'
    ]
  },
  {
    service: 'police', type: 'Lost Property Report', score: 2,
    indicator: 'Non-violent lost property report detected',
    keywords: ['lost phone', 'missing phone', 'kehilangan handphone', 'handphone hilang', 'hp hilang']
  },
  {
    service: 'ambulance', type: 'Medical Emergency', score: 10,
    indicator: 'Life-threatening medical condition detected',
    keywords: ['not breathing', 'cardiac arrest', 'heart attack', 'stroke', 'tidak bernapas', 'henti jantung', 'serangan jantung']
  },
  {
    service: 'ambulance', type: 'Cardiac / Stroke Emergency', score: 9,
    indicator: 'Heart attack or stroke symptoms reported',
    keywords: [
      'nyeri dada', 'dada tertindih', 'keringat dingin', 'menjalar ke lengan',
      'wajah mencong', 'bicara pelo', 'lemah sebelah', 'slurred speech', 'face drooping'
    ]
  },
  {
    service: 'ambulance', type: 'Respiratory Distress Emergency', score: 9,
    indicator: 'Respiratory distress reported',
    keywords: [
      'sesak napas', 'sulit bernapas', 'tidak bisa bernapas', 'napas berhenti',
      'bibir membiru', 'bibir biru', 'asma parah', 'difficulty breathing'
    ]
  },
  {
    service: 'ambulance', type: 'Poisoning / Chemical Exposure', score: 8,
    indicator: 'Poisoning or chemical exposure reported',
    keywords: [
      'keracunan', 'tertelan obat', 'overdose', 'poisoning', 'paparan kimia',
      'chemical exposure', 'terhirup racun', 'menghirup asap kimia', 'muntah hebat'
    ]
  },
  {
    service: 'ambulance', type: 'Medical Emergency', score: 8,
    indicator: 'Serious medical condition detected',
    keywords: ['unconscious', 'unresponsive', 'heavy bleeding', 'difficulty breathing', 'tidak sadar', 'pendarahan hebat', 'sesak napas']
  },
  {
    service: 'ambulance', type: 'Medical Emergency', score: 6,
    indicator: 'Injury requiring medical response detected',
    keywords: ['accident', 'fracture', 'bleeding', 'kecelakaan', 'patah tulang', 'pendarahan']
  },
  {
    service: 'ambulance', type: 'Medical Emergency', score: 3,
    indicator: 'Minor medical issue detected',
    keywords: ['injury', 'wound', 'cut', 'laceration', 'abrasion', 'skin irritation', 'rash', 'burn injury', 'burn wound', 'pain', 'blood', 'cedera', 'luka', 'luka sobek', 'luka robek', 'lecet', 'gores', 'iritasi', 'ruam', 'kemerahan', 'melepuh', 'sakit', 'darah', 'pusing', 'demam', 'memar', 'kaki memar']
  },
  {
    service: 'fire', type: 'Firefighter - Animal Rescue', score: 2,
    indicator: 'Non-critical animal rescue requested',
    keywords: [
      'animal rescue', 'animal_rescue', 'animal-rescue', 'animal trapped', 'animal stuck',
      'cat stuck in tree', 'cat rescue', 'dog rescue', 'pet rescue',
      'evakuasi hewan', 'penyelamatan hewan', 'rescue hewan', 'hewan terjebak',
      'hewan tersangkut', 'kucing nyangkut di pohon', 'kucing terjebak di pohon',
      'kucing terjebak', 'anjing terjebak'
    ]
  },
  {
    service: 'fire', type: 'Rescue Assistance', score: 3,
    indicator: 'Non-critical rescue assistance requested',
    keywords: ['stuck in fence', 'trapped in fence', 'kaki nyangkut di pagar', 'kaki tersangkut di pagar']
  }
];

function keywordMatches(value: string, keyword: string) {
  if (keyword === 'api') return /(^|\W)api($|\W)/i.test(value);
  return value.includes(keyword);
}

function includesAny(value: string, keywords: string[]) {
  return keywords.some(keyword => keywordMatches(value, keyword));
}

const animalKeywords = [
  'animal rescue', 'animal_rescue', 'animal-rescue', 'animal trapped', 'animal stuck',
  'cat stuck in tree', 'cat rescue', 'dog rescue', 'pet rescue', 'hewan terjebak', 'hewan tersangkut',
  'kucing terjebak', 'anjing terjebak', 'hewan liar', 'hewan buas', 'wild animal', 'animal attack',
  'serigala', 'buaya', 'harimau', 'beruang', 'lion', 'tiger', 'snake', 'ular', 'predator',
  'musang', 'civet', 'anjing galak', 'aggressive dog', 'cobra', 'kobra', 'biawak', 'sarang tawon'
];

const largeDangerousAnimalPattern =
  /(buaya|crocodile|harimau|tiger|beruang|bear|lion|singa|serigala|wolf|macan|leopard|panther|komodo|large predator|big wild animal|hewan buas besar|hewan liar besar|predator besar)/i;

const smallDangerousAnimalPattern =
  /(snake|ular|cobra|kobra|python|piton|musang|civet|anjing galak|aggressive dog|rabid dog|biawak|monitor lizard|tawon|lebah|sarang tawon|wasp nest|hewan kecil berbahaya)/i;

function hasAnimalContext(value: string) {
  return includesAny(value, animalKeywords);
}

function hasLargeDangerousAnimalContext(value: string) {
  return largeDangerousAnimalPattern.test(value);
}

function hasSmallDangerousAnimalContext(value: string) {
  return smallDangerousAnimalPattern.test(value);
}

function severityFromScore(score: number): AIResult['severity'] {
  if (score >= 8) return 'High';
  if (score >= 4) return 'Medium';
  return 'Low';
}

function roundSeverityScore(value: number) {
  return Math.max(1, Math.min(10, Math.round(value * 10) / 10));
}

function isInvisibleOnlyIncident(text: string) {
  const lower = text.toLowerCase();
  return /(gas leak|gas odor|carbon monoxide|karbon monoksida|hazmat|chemical exposure|paparan kimia|poisoning|keracunan|overdose|nyeri dada|dada tertindih|heart attack|serangan jantung|cardiac|stroke|wajah mencong|bicara pelo|slurred speech|face drooping|sesak napas|sulit bernapas|difficulty breathing|not breathing|tidak bernapas|internal bleeding|pendarahan dalam|cedera dalam|internal injury|concussion|gegar otak|whiplash|nyeri perut hebat|severe abdominal pain)/i.test(lower);
}

function isInternalMedicalIncident(text: string) {
  const lower = text.toLowerCase();
  return /(nyeri dada|dada tertindih|heart attack|serangan jantung|cardiac|stroke|wajah mencong|bicara pelo|slurred speech|face drooping|sesak napas|sulit bernapas|difficulty breathing|not breathing|tidak bernapas|internal bleeding|pendarahan dalam|cedera dalam|internal injury|concussion|gegar otak|whiplash|nyeri perut hebat|severe abdominal pain|keracunan|poisoning|overdose|gas leak|gas odor|carbon monoxide|karbon monoksida|hazmat|chemical exposure|paparan kimia)/i.test(lower);
}

function isMedicalOnlyIncident(text: string, type: string) {
  const lower = `${type} ${text}`.toLowerCase();
  const medicalSignal = /(injury|injured|hurt|bleeding|pendarahan|luka|patah|unconscious|unresponsive|sesak napas|not breathing|cardiac arrest|heart attack|stroke|kecelakaan|accident)/i;
  const crossAgencySignal = /(fire|smoke|kebakaran|asap|explosion|ledakan|gas|hazmat|chemical|kimia|police|crime|assault|weapon|gun|armed|terror|bom|mass casualty|banyak korban|traffic accident|road accident|vehicle accident|car crash|car collision|motorcycle crash|kecelakaan lalu lintas|kecelakaan mobil|kecelakaan motor|tabrakan mobil|tabrakan motor|building collapse|gedung runtuh|flood|banjir|earthquake|gempa|landslide|longsor|tsunami)/i;
  return medicalSignal.test(lower) && !crossAgencySignal.test(lower);
}

function normalizeMedicalOnlyPlan<T extends ServiceType | ResponseRole>(items: T[], text: string, type: string): T[] {
  if (!isMedicalOnlyIncident(text, type)) return [...new Set(items)];
  return items.includes('ambulance' as T) ? ['ambulance' as T] : [...new Set(items)];
}

function isBurnInjuryOnly(text: string) {
  const lower = text.toLowerCase();
  return burnInjuryPattern.test(lower) && !hasActiveFireEvidence(lower) && !explicitPolicePattern.test(lower);
}

const burnInjuryPattern = /(luka bakar|luka kebakar|kulit terbakar|tubuh terbakar|badan kebakar|tangan kebakar|melepuh|tersiram air panas|terkena air panas|burn wound|burn injury|burned skin|thermal burn|scald)/i;
const activeFirePattern = /(\bkebakaran\b|\bfire\b|\bflames?\b|\bsmoke\b|\basap\b|kobaran api|api (menyala|besar|menjalar|menyebar)|asap (tebal|hitam)|rumah terbakar|gedung terbakar|bangunan terbakar|kendaraan terbakar|\bactive fire\b|\bopen flames?\b|\bheavy smoke\b|house on fire|building on fire|vehicle on fire|burning (house|building|vehicle|car|forest|room)|\bexplod(?:e|es|ed|ing)?\b|\bexplosion\b|\bblast(?:ed|ing)?\b|\bdetonat(?:e|es|ed|ing|ion)\b|\bblew up\b|\bblown up\b|\bledakan\b|\bmeledak+k?\b|\bmeleduk\b|\bletupan\b|\bmeletup\b|\bsumabog\b|\bpagsabog\b|\bvụ nổ\b|\bphát nổ\b|\bvu no\b|\bphat no\b)/i;
const explicitMedicalPattern = /(injury|injured|hurt|bleeding|blood|wound|cut|laceration|abrasion|rash|skin irritation|fracture|burn wound|burn injury|scald|pendarahan|berdarah|darah|luka|luka bakar|luka sobek|luka robek|lecet|gores|iritasi|ruam|kemerahan|melepuh|patah|korban cedera|unconscious|unresponsive|tidak sadar|sesak napas|not breathing|cardiac arrest|heart attack|stroke)/i;
const explicitPolicePattern = /(crime|assault|attack|robbery|weapon|gun|knife|armed|shooting|stabbing|violence|pencurian|rampok|begal|kekerasan|penyerangan|senjata|pistol|pisau|penembakan|penusukan|disiram air keras|disiram bensin|sengaja dibakar|dibakar orang)/i;
const nonActiveFireObjectPattern = /\b(fire extinguisher|fire alarm|smoke alarm|smoke detector|fire detector|fire door|fire exit|fire station|fire truck|fire engine|fire hydrant|firefighter|fire fighter|alat pemadam api|pemadam api|tabung apar|apar)\b/i;

function hasActiveFireEvidence(value: string) {
  const cleaned = value
    .toLowerCase()
    .replace(new RegExp(nonActiveFireObjectPattern.source, 'gi'), ' ')
    .replace(/\b(no|without)\s+(visible\s+)?(fire|flames?|smoke)(\s+(or|and)\s+(fire|flames?|smoke))?/g, ' ')
    .replace(/\b(tidak ada|tanpa)\s+(api|asap|kebakaran)(\s+(atau|dan)\s+(api|asap|kebakaran))?/g, ' ');
  return activeFirePattern.test(cleaned);
}
const majorRailCollisionPattern = /(train (collision|crash|accident)|rail(?:way)? (collision|crash|accident)|two trains? collid|trains? collided|train derailment|derailed train|kecelakaan kereta|tabrakan kereta|kereta bertabrakan|dua kereta bertabrakan|kereta anjlok)/i;
const planeCrashPattern = /(plane crash|aircraft crash|airplane crash|aviation accident|pesawat jatuh|kecelakaan pesawat)/i;
const buildingCollapsePattern = /(building collapse|collapsed building|structural collapse|gedung runtuh|bangunan runtuh|roboh bangunan)/i;
const massCasualtyPattern = /(mass casualty|multiple casualties|many casualties|multiple victims|banyak korban|korban massal)/i;
const majorRoadCollisionPattern = /(multi[- ]vehicle (collision|crash)|pileup|pile-up|bus (collision|crash|accident)|truck (collision|crash|accident)|major traffic accident|major road accident|tabrakan beruntun|kecelakaan bus|kecelakaan truk|kecelakaan lalu lintas besar)/i;
const trafficAccidentPattern = /(traffic accident|road accident|vehicle accident|car (collision|crash|accident)|motorcycle (collision|crash|accident)|kecelakaan lalu lintas|kecelakaan mobil|kecelakaan motor|tabrakan mobil|tabrakan motor)/i;
const trappedVictimPattern = /(trapped victim|victim trapped|person trapped|occupant trapped|victim pinned|korban terjebak|terjepit|butuh ekstrikasi|needs extrication)/i;

function getVisualCrisisPolicy(text: string) {
  if (planeCrashPattern.test(text)) return { type: 'Aircraft Crash / Mass Casualty', scoreFloor: 9.7 };
  if (majorRailCollisionPattern.test(text)) return { type: 'Train Collision / Mass Casualty', scoreFloor: 9.5 };
  if (massCasualtyPattern.test(text)) return { type: 'Mass Casualty Incident', scoreFloor: 9.4 };
  if (buildingCollapsePattern.test(text)) return { type: 'Building Collapse / Mass Casualty', scoreFloor: 9.3 };
  if (majorRoadCollisionPattern.test(text)) return { type: 'Major Road Collision', scoreFloor: 8.8 };
  return null;
}

function getDisasterResponsePlan(type: string, score: number): ResponseRole[] {
  const lower = type.toLowerCase();
  if (/tsunami|earthquake|volcanic eruption|severe storm|flood|landslide/.test(lower)) {
    return score >= 9 ? ['disaster-response'] : ['fire'];
  }
  return [];
}

function getCrisisResponsePlan(type: string, primary: ServiceType, score: number, text: string): ResponseRole[] {
  const lower = `${type} ${text}`.toLowerCase();
  const plan: ResponseRole[] = [];
  const multiAgency = majorRailCollisionPattern.test(lower) ||
    planeCrashPattern.test(lower) ||
    massCasualtyPattern.test(lower) ||
    buildingCollapsePattern.test(lower) ||
    majorRoadCollisionPattern.test(lower) ||
    /(kecelakaan besar|accident besar)/i.test(lower);
  const transportAccident = trafficAccidentPattern.test(lower);
  const trappedVictim = trappedVictimPattern.test(lower);
  const hostileThreat = /(terror|teroris|terrorist|active shooter|hostage|armed threat|penembakan|sandera|bom|bomb|serangan bersenjata)/i.test(lower);
  const medicalNeed = explicitMedicalPattern.test(lower);
  const activeFire = hasActiveFireEvidence(lower);
  const policeEvidence = explicitPolicePattern.test(lower);
  const gasOrHazmat = /(gas leak|gas odor|kebocoran gas|gas bocor|bau gas|carbon monoxide|karbon monoksida|hazmat|bau kimia|asap kimia|chemical exposure|paparan kimia|poisoning|keracunan)/i.test(lower);

  if (/tsunami|earthquake|volcanic eruption|severe storm|flood|landslide/.test(lower)) {
    return score >= 9 ? ['disaster-response'] : ['fire'];
  }

  if (gasOrHazmat) {
    plan.push('fire');
    if (medicalNeed) plan.push('ambulance');
    if (policeEvidence) plan.push('police');
    return [...new Set(plan)];
  }

  if (hostileThreat) {
    plan.push('police');
    if (medicalNeed) plan.push('ambulance');
    if (activeFire) plan.push('fire');
    return [...new Set(plan)];
  }

  if (multiAgency) {
    if (majorRailCollisionPattern.test(lower) || planeCrashPattern.test(lower) || buildingCollapsePattern.test(lower) || massCasualtyPattern.test(lower)) {
      plan.push('disaster-response');
    }
    plan.push('ambulance');
    plan.push('fire');
    plan.push('police');
    return [...new Set(plan)];
  }

  if (transportAccident) {
    plan.push('ambulance');
    if (trappedVictim || score >= 8) plan.push('fire');
    plan.push('police');
    return [...new Set(plan)];
  }

  if (primary === 'fire') {
    plan.push('fire');
    if (medicalNeed) plan.push('ambulance');
    if (policeEvidence) plan.push('police');
    return [...new Set(plan)];
  }

  if (primary === 'police') {
    plan.push('police');
    if (medicalNeed) plan.push('ambulance');
    if (activeFire) plan.push('fire');
    return [...new Set(plan)];
  }

  if (primary === 'ambulance') {
    plan.push('ambulance');
    if (activeFire) plan.push('fire');
    if (policeEvidence) plan.unshift('police');
    return [...new Set(plan)];
  }

  return [primary];
}

function extractImageAssessment(value: unknown): ImageAssessment | null {
  if (!value || typeof value !== 'object') return null;
  const output = (value as {
    outputs?: Array<{
      incident_type?: unknown;
      severity_score?: unknown;
      description?: unknown;
      annotated_image?: { value?: unknown };
      confidence?: unknown;
      privacy_regions?: unknown;
      predictions?: Array<{
        class?: unknown;
        x?: unknown;
        y?: unknown;
        width?: unknown;
        height?: unknown;
        confidence?: unknown;
      }>;
      fire_predictions?: { predictions?: Array<{ class?: unknown; confidence?: unknown }> };
      injured_person_predictions?: { predictions?: Array<{ class?: unknown; confidence?: unknown }> };
      gun_and_knife_predictions?: { predictions?: Array<{ class?: unknown; confidence?: unknown }> };
      vehicle_accident_predictions?: { predictions?: Array<{ class?: unknown; confidence?: unknown }> };
      detections?: { predictions?: Array<{ class?: unknown; confidence?: unknown }> };
    }>;
  }).outputs?.[0];

  if (!output || typeof output.incident_type !== 'string') return null;
  const incidentType = output.incident_type.toLowerCase();
  const predictionLabels = [
    output.fire_predictions,
    output.injured_person_predictions,
    output.gun_and_knife_predictions,
    output.vehicle_accident_predictions,
    output.detections
  ].flatMap(group => group?.predictions ?? [])
    .filter(prediction => Number(prediction.confidence ?? 0) >= 0.35 && typeof prediction.class === 'string')
    .map(prediction => String(prediction.class).replace(/_/g, ' '));
  const descriptionParts = [
    typeof output.description === 'string' ? output.description : '',
    predictionLabels.length ? `Detector evidence: ${predictionLabels.join(', ')}` : ''
  ].filter(Boolean);
  const description = descriptionParts.length ? descriptionParts.join(' ') : undefined;
  const detectedPrivacyRegions = extractPrivacyRegions(output);
  const hasConfidentPrediction = (value: { predictions?: Array<{ confidence?: unknown }> } | undefined) =>
    value?.predictions?.some(prediction => Number(prediction.confidence ?? 0) >= 0.35) ?? false;
  const visualServices: ServiceType[] = [];
  if (hasConfidentPrediction(output.fire_predictions)) visualServices.push('fire');
  if (hasConfidentPrediction(output.injured_person_predictions)) visualServices.push('ambulance');
  if (hasConfidentPrediction(output.gun_and_knife_predictions)) visualServices.push('police');

  return {
    incidentType,
    severityScore: typeof output.severity_score === 'number' ? output.severity_score : 0,
    description,
    confidence: typeof output.confidence === 'number' ? output.confidence : undefined,
    visualServices,
    annotatedImage:
      typeof output.annotated_image?.value === 'string'
        ? `data:image/jpeg;base64,${output.annotated_image.value}`
        : undefined,
    privacyRegions: detectedPrivacyRegions?.length
      ? detectedPrivacyRegions
      : inferPrivacyRegionsFromAssessment(incidentType, description)
  };
}

function normalizeRegionLabel(value: string) {
  const label = value.toLowerCase();
  if (/(face|person|head|human|muka|wajah)/i.test(label)) return 'face';
  if (/(license plate|plate|plat|vehicle plate|nomor polisi|nopol|polisi kendaraan)/i.test(label)) return 'license plate';
  if (/(blood|darah|bleeding|luka)/i.test(label)) return 'blood';
  if (/(gore|graphic|gruesome|corpse|body part|severed|mutilated|fatal injury|mayat|jenazah|potongan tubuh|sadis|mengerikan|luka parah|organ)/i.test(label)) return 'graphic content';
  if (/(weapon|knife|gun|firearm|senjata|pisau|pistol)/i.test(label)) return 'dangerous object';
  if (/(accident|collision|crash|wreck|damaged vehicle|kendaraan rusak|kecelakaan)/i.test(label)) return 'accident';
  return label;
}

function isSensitiveRegionLabel(label: string) {
  return /face|license plate|blood|graphic content|dangerous object|accident/i.test(label);
}

function inferPrivacyRegionsFromAssessment(
  incidentType: string,
  description?: string
): PrivacyRegion[] | undefined {
  const text = `${incidentType} ${description ?? ''}`.toLowerCase();

  if (/(blood|darah|bleeding|trauma|physical trauma|severe injury|luka|gore|graphic|gruesome|mutilated|fatal injury|sadis|luka parah)/i.test(text)) {
    return [
      {
        label: 'graphic content',
        left: 47,
        top: 30,
        width: 38,
        height: 34,
        confidence: 0.55,
        normalized: true
      },
      {
        label: 'blood',
        left: 24,
        top: 3,
        width: 30,
        height: 16,
        confidence: 0.5,
        normalized: true
      },
      {
        label: 'blood',
        left: 13,
        top: 58,
        width: 20,
        height: 18,
        confidence: 0.45,
        normalized: true
      }
    ];
  }

  if (/(face|muka|wajah|person|human|head)/i.test(text)) {
    return [{
      label: 'face',
      left: 38,
      top: 12,
      width: 24,
      height: 24,
      confidence: 0.45,
      normalized: true
    }];
  }

  if (/(license plate|plate|plat|nomor polisi|nopol|vehicle plate)/i.test(text)) {
    return [{
      label: 'license plate',
      left: 34,
      top: 58,
      width: 32,
      height: 12,
      confidence: 0.45,
      normalized: true
    }];
  }

  return undefined;
}

function extractPrivacyRegions(output: {
  privacy_regions?: unknown;
  predictions?: Array<{
    class?: unknown;
    x?: unknown;
    y?: unknown;
    width?: unknown;
    height?: unknown;
    confidence?: unknown;
  }>;
}): PrivacyRegion[] | undefined {
  const rawRegions = Array.isArray(output.privacy_regions)
    ? output.privacy_regions
    : output.predictions;

  if (!Array.isArray(rawRegions) || rawRegions.length === 0) return undefined;

  const regions = rawRegions.flatMap(region => {
    if (!region || typeof region !== 'object') return [];
    const typed = region as {
      class?: unknown;
      x?: unknown;
      y?: unknown;
      width?: unknown;
      height?: unknown;
      confidence?: unknown;
      left?: unknown;
      top?: unknown;
      right?: unknown;
      bottom?: unknown;
    };

    const label = typeof typed.class === 'string' ? normalizeRegionLabel(typed.class) : '';
    const confidence = typeof typed.confidence === 'number' ? typed.confidence : undefined;
    if (label && !isSensitiveRegionLabel(label)) return [];
    if (typeof confidence === 'number' && confidence < 0.35) return [];

    if (typeof typed.x === 'number' && typeof typed.y === 'number' && typeof typed.width === 'number' && typeof typed.height === 'number') {
      return [{
        label: label || 'sensitive object',
        left: Math.max(0, typed.x - typed.width / 2),
        top: Math.max(0, typed.y - typed.height / 2),
        width: Math.max(6, typed.width),
        height: Math.max(6, typed.height),
        confidence,
        normalized: false
      } as PrivacyRegion];
    }

    if (
      typeof typed.left === 'number' &&
      typeof typed.top === 'number' &&
      typeof typed.right === 'number' &&
      typeof typed.bottom === 'number'
    ) {
      return [{
        label: label || 'sensitive object',
        left: Math.max(0, typed.left),
        top: Math.max(0, typed.top),
        width: Math.max(6, typed.right - typed.left),
        height: Math.max(6, typed.bottom - typed.top),
        confidence,
        normalized: false
      } as PrivacyRegion];
    }

    return [];
  });

  return regions.length ? regions : undefined;
}

function classifyText(text: string): Classification {
  const lower = text.toLowerCase();
  const animalMatch = hasAnimalContext(lower);
  const matches = rules.filter(rule => includesAny(lower, rule.keywords));
  const strongest = animalMatch
    ? hasLargeDangerousAnimalContext(lower) && !hasSmallDangerousAnimalContext(lower)
      ? matches.find(rule => rule.service === 'police' && /police ranger/i.test(rule.type)) ?? matches.sort((a, b) => b.score - a.score)[0]
      : matches.find(rule => rule.service === 'fire' && /animal rescue|rescue assistance/i.test(rule.type)) ?? matches.sort((a, b) => b.score - a.score)[0]
    : matches.sort((a, b) => b.score - a.score)[0];
  let score = strongest?.score ?? 2;
  const indicators = [...new Set(matches.map(rule => rule.indicator))];

  if (/(multiple|several|many|\d+\s*(people|persons|victims|korban|orang)|banyak korban)/i.test(lower)) {
    score += 1;
    indicators.push('Multiple people may be affected');
  }
  if (/(child|baby|elderly|pregnant|anak|bayi|lansia|hamil)/i.test(lower)) {
    score += 1;
    indicators.push('Vulnerable person involved');
  }
  if (/(spreading|trapped|still inside|ongoing|menyebar|terjebak|masih di dalam|sedang berlangsung)/i.test(lower)) {
    score += 1;
    indicators.push('Active situation may escalate');
  }
  if (
    /(school|campus|sekolah|kampus)/i.test(lower) &&
    /(armed|weapon|gun|firearm|handgun|rifle|pistol|bersenjata|senjata api|senjata)/i.test(lower)
  ) {
    score += 2;
    indicators.push('Armed threat reported near a school or campus');
  }
  if (/(cctv|surveillance|footage|rekaman|kamera pengawas|buram|blur|blurry)/i.test(lower)) {
    indicators.push('CCTV or surveillance footage requires operator verification');
  }
  if (/(small|minor|contained|terkendali|kecil|ringan)/i.test(lower)) {
    score -= 2;
    indicators.push('Reported as limited or contained');
  }

  return {
    type: strongest?.type ?? 'General Emergency',
    service: strongest?.service ?? 'ambulance',
    score: Math.max(1, Math.min(10, score)),
    indicators: indicators.length ? indicators : ['Manual review recommended']
  };
}

function isMinorMedicalText(text: string) {
  return /(iritasi|skin irritation|burning sensation|ruam|rash|kemerahan|redness|lecet|scrape|abrasi|abrasion|gores|goresan|superficial cut|small cut|shallow cut|minor injury|minor wound|small wound|luka kecil|luka ringan|cedera ringan|memar ringan|keseleo ringan|first[ -]degree burn|luka bakar ringan|pain ringan|sakit ringan)/i.test(text);
}

function isMedicalOnlyText(text: string) {
  const lower = text.toLowerCase();
  return explicitMedicalPattern.test(lower) && !/(fire|smoke|kebakaran|asap|explosion|ledakan|gas|hazmat|chemical|kimia|police|crime|assault|weapon|gun|armed|terror|bom|mass casualty|banyak korban|traffic accident|road accident|vehicle accident|car crash|car collision|motorcycle crash|kecelakaan lalu lintas|kecelakaan mobil|kecelakaan motor|tabrakan mobil|tabrakan motor|building collapse|gedung runtuh|flood|banjir|earthquake|gempa|landslide|longsor|tsunami)/i.test(lower);
}

function getMedicalSeverityScore(text: string, baseScore: number) {
  const lower = text.toLowerCase();
  if (/(not breathing|tidak bernapas|napas berhenti|cardiac arrest|henti jantung|unresponsive|tidak responsif|pendarahan tidak berhenti|uncontrolled bleeding|amputation|amputasi|organ terlihat|exposed organ)/i.test(lower)) {
    return 9.8;
  }
  if (/(unconscious|tidak sadar|pingsan|pendarahan hebat|heavy bleeding|bleeding heavily|severe bleeding|profuse bleeding|darah mengalir banyak|banyak darah|pool of blood|large blood pool|severe cut|open wound|luka terbuka|luka sangat dalam|deep wound|gaping wound|third[ -]degree burn|luka bakar derajat tiga|luka bakar luas|extensive burn|burn.*(face|airway)|luka bakar.*(wajah|saluran napas)|patah tulang terbuka|open fracture)/i.test(lower)) {
    return 9.1;
  }
  if (isMinorMedicalText(lower)) {
    return 3.2;
  }
  if (/(luka sobek|luka robek|laceration|sobek|robek|jahit|stitches|moderate bleeding|pendarahan sedang|second[ -]degree burn|luka bakar derajat dua|melepuh|blister|chemical burn|luka bakar kimia|patah tulang|fracture)/i.test(lower)) {
    return 6.4;
  }
  if (burnInjuryPattern.test(lower) || /(blood|darah|bleeding|wound|injury|luka|cedera|hurt|trauma)/i.test(lower)) {
    return 5.1;
  }
  return roundSeverityScore(Math.max(3, Math.min(5, baseScore || 4.2)));
}

function classifyImage(assessment: ImageAssessment): Classification | null {
  if (!assessment.incidentType || assessment.incidentType === 'none') return null;

  const normalizedIncident = assessment.incidentType
    .replace(/firearm|handgun|rifle|shotgun/gi, ' gun ')
    .replace(/armed_person|person_with_weapon|person-with-weapon/gi, ' armed weapon ')
    .replace(/animal_rescue|animal-rescue|animalrescue/gi, ' animal rescue ')
    .replace(/cat|dog|pet|kitten|puppy|kucing|anjing/gi, ' animal ');
  const normalizedDescription = assessment.description
    ?.toLowerCase()
    .replace(/animal_rescue|animal-rescue|animalrescue/gi, ' animal rescue ')
    .replace(/cat|dog|pet|kitten|puppy|kucing|anjing/gi, ' animal ') ?? '';
  const imageText = `${normalizedIncident} ${normalizedDescription}`;
  const visualCrisisPolicy = getVisualCrisisPolicy(imageText);
  const confidence = assessment.confidence ?? 0;
  const strongEnough = assessment.severityScore >= 4 || confidence >= 0.6;
  const roboflowSeverity = assessment.severityScore > 0
    ? roundSeverityScore(assessment.severityScore)
    : 0;

  if (visualCrisisPolicy) {
    return {
      type: visualCrisisPolicy.type,
      service: 'ambulance',
      score: roundSeverityScore(Math.max(roboflowSeverity, visualCrisisPolicy.scoreFloor)),
      indicators: [
        `Roboflow visual context detected: ${visualCrisisPolicy.type}`,
        'Roboflow severity calibrated for a major multi-agency incident',
        ...(assessment.description ? [`Visual assessment: ${assessment.description}`] : [])
      ]
    };
  }

  if (trafficAccidentPattern.test(imageText)) {
    return {
      type: 'Traffic Accident',
      service: 'ambulance',
      score: roboflowSeverity || 6.5,
      indicators: [
        'Roboflow visual context detected a traffic accident',
        ...(assessment.description ? [`Visual assessment: ${assessment.description}`] : [])
      ]
    };
  }

  const animalMatch = hasAnimalContext(imageText);
  const match = animalMatch
    ? hasLargeDangerousAnimalContext(imageText) && !hasSmallDangerousAnimalContext(imageText)
      ? rules.find(rule => rule.service === 'police' && /Police Ranger/i.test(rule.type))
      : rules.find(rule => rule.service === 'fire' && /Animal Rescue|Rescue Assistance/i.test(rule.type))
      ?? rules.find(rule => includesAny(imageText, rule.keywords))
    : rules.find(rule => includesAny(imageText, rule.keywords));
  if (!match || assessment.incidentType === 'none') return null;

  const disasterMatch = rules.find(rule =>
    rule.type !== 'Fire Emergency' &&
    includesAny(imageText, rule.keywords) &&
    /tsunami|volcanic eruption|earthquake|severe storm|landslide|flood/i.test(rule.type)
  );
  const resolvedMatch = disasterMatch ?? match;

  const indicatesPolice = /(gun|weapon|armed|knife|rifle|shotgun|pistol|shooting|stabbing|crime|assault|robbery|violence|police)/i.test(imageText);
  const indicatesMedical = explicitMedicalPattern.test(imageText) || /(medical|patient|korban|skin lesion|skin damage|burning sensation)/i.test(imageText);
  const fireExplicitlyAbsent = /(no (visible )?(fire|flame|smoke)|without (fire|flames|smoke)|tidak ada (api|asap|kebakaran)|tanpa (api|asap))/i.test(normalizedDescription);
  const concreteFireScene = !fireExplicitlyAbsent && /(visible flames?|open flames?|active fire|heavy smoke|thick smoke|black smoke|smoldering (building|vehicle|debris)|burning (house|building|vehicle|car|forest|room)|kobaran api|api (menyala|besar|menjalar|menyebar)|asap (tebal|hitam)|rumah terbakar|gedung terbakar|bangunan terbakar|kendaraan terbakar)/i.test(normalizedDescription);
  const medicalDetectorEvidence = assessment.visualServices?.includes('ambulance') ?? false;
  const woundDominatesGenericFireLabel = (indicatesMedical || medicalDetectorEvidence) && !concreteFireScene;
  const descriptionHasNonActiveFireObject = nonActiveFireObjectPattern.test(normalizedDescription);
  const indicatesFire = !woundDominatesGenericFireLabel && (
    concreteFireScene ||
    hasActiveFireEvidence(normalizedDescription) ||
    (hasActiveFireEvidence(normalizedIncident) && !indicatesPolice && !descriptionHasNonActiveFireObject) ||
    /(hazmat|gas leak|gas bocor|kebocoran gas)/i.test(imageText)
  );
  const minorMedical = isMinorMedicalText(imageText);

  if (indicatesPolice && !indicatesFire) {
    return {
      type: 'Police Emergency',
      service: 'police',
      score: roboflowSeverity || 8.5,
      indicators: [
        'Roboflow visual evidence detected an armed or criminal threat',
        ...(descriptionHasNonActiveFireObject
          ? ['Safety equipment was excluded from emergency-service routing']
          : []),
        ...(assessment.description ? [`Visual assessment: ${assessment.description}`] : [])
      ]
    };
  }

  if (indicatesMedical && !indicatesPolice && !indicatesFire) {
    return {
      type: 'Medical Emergency',
      service: 'ambulance',
      score: roboflowSeverity || getMedicalSeverityScore(imageText, assessment.severityScore),
      indicators: [
        minorMedical
          ? 'Image assessment detected minor medical injury'
          : 'Image assessment detected medical injury or bleeding',
        ...(woundDominatesGenericFireLabel
          ? ['Generic fire label suppressed because the image contains medical evidence without visible flames or smoke']
          : []),
        ...(assessment.description ? [`Visual assessment: ${assessment.description}`] : [])
      ]
    };
  }

  if (animalMatch) {
    return {
      type: resolvedMatch.type,
      service: resolvedMatch.service,
      score: roboflowSeverity || resolvedMatch.score,
      indicators: [
        'Roboflow visual context detected an animal rescue incident',
        ...(assessment.description ? [`Visual assessment: ${assessment.description}`] : [])
      ]
    };
  }

  // Neutral photos should not invent an emergency.
  if (!strongEnough && resolvedMatch.service === 'ambulance') return null;

  if (!indicatesPolice && !indicatesFire && resolvedMatch.service !== 'ambulance') {
    return {
      type: 'Medical Emergency',
      service: 'ambulance',
      score: roboflowSeverity || getMedicalSeverityScore(imageText, assessment.severityScore),
      indicators: [
        'Image assessment did not show explicit fire or police evidence; routed as medical default',
        ...(assessment.description ? [`Visual assessment: ${assessment.description}`] : [])
      ]
    };
  }

  return {
    type: resolvedMatch.type,
    service: resolvedMatch.service,
    score: roboflowSeverity || roundSeverityScore(
      resolvedMatch.score + Math.max(0, confidence - 0.5) * 0.8
    ),
    indicators: [
      `Image assessment detected: ${assessment.incidentType}`,
      ...(assessment.description ? [`Visual assessment: ${assessment.description}`] : [])
    ]
  };
}

function detectRequiredServices(
  text: string,
  primary: ServiceType,
  severityScore: number
): ServiceType[] {
  const lower = text.toLowerCase();
  const services = new Set<ServiceType>([primary]);
  const largeAnimalIncident = largeDangerousAnimalPattern;
  const smallAnimalIncident = smallDangerousAnimalPattern;
  const medicalEmergencySignal = explicitMedicalPattern;
  const gasOrHazmatSignal = /(gas leak|gas odor|kebocoran gas|gas bocor|bau gas|carbon monoxide|karbon monoksida|hazmat|bau kimia|asap kimia|chemical exposure|paparan kimia|poisoning|keracunan)/i;
  const multiAgencyIncident =
    /(train accident|train crash|train collision|railway accident|rail collision|kecelakaan kereta|tabrakan kereta|kereta bertabrakan|kereta anjlok|plane crash|aircraft crash|pesawat jatuh|mass casualty|banyak korban|building collapse|gedung runtuh|major road collision|multi-vehicle collision|bus accident|truck accident|tsunami|volcanic eruption|volcano eruption|gunung meletus|erupsi gunung|earthquake|gempa|typhoon|hurricane|cyclone|tornado|topan|puting beliung|landslide|longsor|flash flood|flood|banjir)/i;

  if (multiAgencyIncident.test(lower)) {
    services.add('ambulance');
    services.add('fire');
    services.add('police');
  }

  if (trafficAccidentPattern.test(lower)) {
    services.add('ambulance');
    services.add('police');
    if (trappedVictimPattern.test(lower) || severityScore >= 8) services.add('fire');
  }

  if (gasOrHazmatSignal.test(lower)) {
    services.add('fire');
    if (medicalEmergencySignal.test(lower)) services.add('ambulance');
  }

  if (primary === 'fire' && severityScore >= 8 && medicalEmergencySignal.test(lower)) {
    services.add('ambulance');
  }

  if (largeAnimalIncident.test(lower)) {
    services.add('police');
    if (medicalEmergencySignal.test(lower)) {
      services.add('ambulance');
    }
  }

  if (smallAnimalIncident.test(lower)) {
    services.add('fire');
  }

  if (hasActiveFireEvidence(lower)) services.add('fire');
  if (explicitMedicalPattern.test(lower)) services.add('ambulance');
  if (explicitPolicePattern.test(lower)) services.add('police');

  return [...services];
}

function fuseSignals(signals: Signal[], text: string, imageAnalysisFailed: boolean, hasPhoto: boolean): FusionResult {
  const usableSignals = signals.filter(signal => signal.score > 0);
  const fusionContext = { hasPhoto, text };
  const totalWeight = usableSignals.reduce((sum, signal) => sum + getSignalWeight(signal, fusionContext), 0) || 1;
  const hasTextInput = text.trim().length > 0;
  const hasInvisibleEmergency = usableSignals.some(signal => signal.source !== 'vision' && isInvisibleEmergencySignal(signal, text));
  const visionSignals = usableSignals.filter(signal => signal.source === 'vision');
  const strongestVision = [...visionSignals].sort((a, b) => b.score - a.score)[0];
  const strongestVisionIsNaturalDisaster = Boolean(
    strongestVision && /tsunami|volcanic eruption|earthquake|severe storm|landslide|flood/i.test(strongestVision.type)
  );

  const serviceWeights = usableSignals.reduce((acc, signal) => {
    acc[signal.service] = (acc[signal.service] ?? 0) + signal.score * getSignalWeight(signal, fusionContext);
    return acc;
  }, {} as Record<ServiceType, number>);

  const winningService = (Object.entries(serviceWeights).sort((a, b) => b[1] - a[1])[0]?.[0] as ServiceType | undefined) ?? 'ambulance';
  const serviceSignals = usableSignals.filter(signal => signal.service === winningService);
  const strongestSignal = [...serviceSignals].sort((a, b) => b.score - a.score)[0] ?? [...usableSignals].sort((a, b) => b.score - a.score)[0];
  const weightedScore = usableSignals.reduce(
    (sum, signal) => sum + signal.score * getSignalWeight(signal, fusionContext),
    0
  ) / totalWeight;
  const hasSpecificSignal = hasInvisibleEmergency ||
    signals.some(signal => signal.type !== 'General Emergency' && signal.source !== 'vision') ||
    signals.some(signal => signal.source === 'vision' && signal.score >= 4);
  const isFalseReport = !hasSpecificSignal && signals.every(signal => signal.score <= 2);

  const hasStrongTextSignal = signals.some(signal => signal.source !== 'vision' && signal.score >= 5);
  const hasStrongVisionSignal = signals.some(signal => signal.source === 'vision' && signal.score >= 6);
  const strongestNlpSignal = [...signals.filter(signal => signal.source === 'nlp')].sort((a, b) => b.score - a.score)[0];

  if (strongestVisionIsNaturalDisaster && strongestVision && !hasTextInput) {
    const visualContext = `${strongestVision.type} ${strongestVision.indicators.join(' ')}`;
    const services = detectRequiredServices(visualContext, strongestVision.service, strongestVision.score);
    const responsePlan = [...new Set([
      ...getDisasterResponsePlan(strongestVision.type, strongestVision.score),
      ...services
    ])];
    return {
      type: strongestVision.type,
      service: strongestVision.service,
      score: roundSeverityScore(strongestVision.score),
      sourceScore: roundSeverityScore(strongestVision.score),
      assessmentSummary: strongestVision.indicators.join(' | '),
      indicators: [
        ...strongestVision.indicators,
        'Vision detected a natural-disaster event and was allowed to dominate fusion',
        ...(imageAnalysisFailed ? ['Photo uploaded, but image assessment was unavailable'] : [])
      ],
      services,
      responsePlan,
      priorityRole: responsePlan[0] ?? strongestVision.service,
      isFalseReport: false,
      falseReportReason: undefined
    };
  }

  // If the report is image-only, keep the vision result authoritative.
  if (!hasTextInput) {
    if (strongestVision) {
      const visualContext = `${strongestVision.type} ${strongestVision.indicators.join(' ')}`;
      const responsePlan = /tsunami|volcanic eruption|earthquake|severe storm|landslide|flood/i.test(strongestVision.type)
        ? [...new Set([
            ...getDisasterResponsePlan(strongestVision.type, strongestVision.score),
            ...detectRequiredServices(visualContext, strongestVision.service, strongestVision.score)
          ])]
        : getCrisisResponsePlan(strongestVision.type, strongestVision.service, strongestVision.score, visualContext);
      const visualServices = detectRequiredServices(visualContext, strongestVision.service, strongestVision.score);
      return {
        type: strongestVision.type,
        service: strongestVision.service,
        score: roundSeverityScore(strongestVision.score),
        sourceScore: roundSeverityScore(strongestVision.score),
        assessmentSummary: strongestVision.indicators.join(' | '),
        indicators: [
          ...strongestVision.indicators,
          'Image-only report resolved directly from vision analysis',
          ...(imageAnalysisFailed ? ['Photo uploaded, but image assessment was unavailable'] : [])
        ],
        services: normalizeMedicalOnlyPlan(visualServices, visualContext, strongestVision.type),
        responsePlan: normalizeMedicalOnlyPlan(responsePlan, visualContext, strongestVision.type),
        priorityRole: responsePlan[0] ?? strongestVision.service,
        isFalseReport: false,
        falseReportReason: undefined
      };
    }
  }

  // If only vision is weakly suggesting medical, keep it conservative.
  if (!hasInvisibleEmergency && !hasStrongTextSignal && !hasStrongVisionSignal) {
    const safeService = signals.find(signal => signal.source !== 'vision' && signal.score >= 3)?.service ?? (strongestVision?.service ?? 'ambulance');
    const safeType = signals.find(signal => signal.source !== 'vision' && signal.score >= 3)?.type ?? 'General Emergency';
    const responsePlan = /tsunami|volcanic eruption|earthquake|severe storm|landslide|flood/i.test(safeType)
      ? getDisasterResponsePlan(safeType, Math.max(1, Math.min(10, Math.round(weightedScore))))
      : getCrisisResponsePlan(safeType, safeService, Math.max(1, Math.min(10, Math.round(weightedScore))), text);
    return {
      type: safeType,
      service: safeService,
      score: roundSeverityScore(weightedScore),
      assessmentSummary: 'Low-confidence image signals were suppressed to avoid false positives',
      indicators: [
        'Low-confidence image signals were suppressed to avoid false positives',
        ...(imageAnalysisFailed ? ['Photo uploaded, but image assessment was unavailable'] : [])
      ],
      services: /tsunami|volcanic eruption|earthquake|severe storm|landslide|flood/i.test(safeType)
        ? [safeService]
        : detectRequiredServices(text, safeService, Math.max(1, Math.min(10, Math.round(weightedScore)))),
      responsePlan,
      priorityRole: responsePlan[0] ?? safeService,
      sourceScore: roundSeverityScore(weightedScore),
      isFalseReport,
      falseReportReason: isFalseReport ? 'No clear emergency evidence was detected in the photo or text.' : undefined
    };
  }

  const baseVisualScore = strongestVision?.score ?? strongestSignal?.score ?? Math.round(weightedScore);
  const burnInjuryVisualOnly = burnInjuryPattern.test(text) && !hasActiveFireEvidence(text) && !explicitPolicePattern.test(text);
  const finalScore = strongestVision && strongestNlpSignal && hasTextInput
    ? roundSeverityScore((strongestVision.score * 0.7) + (strongestNlpSignal.score * 0.3))
    : strongestVision
      ? roundSeverityScore(strongestVision.score)
      : strongestNlpSignal
        ? roundSeverityScore(strongestNlpSignal.score)
        : roundSeverityScore(baseVisualScore);

  const serviceLabels = [...new Set(usableSignals.map(signal => signal.service))];
  const sharedIndicators = usableSignals.map(signal =>
    `${signal.source.toUpperCase()}: ${signal.indicators.join('; ') || signal.type}`
  );
  const indicators = [
    ...sharedIndicators,
    ...(serviceLabels.length > 1
      ? [`Signals were mixed across ${serviceLabels.join(', ')}; fused on ${winningService}`]
      : [`Text, NLP, and vision aligned on ${winningService}`]),
    ...(hasInvisibleEmergency
      ? ['Text/NLP describes a non-visible emergency; responder verification required on acceptance']
      : []),
    ...(imageAnalysisFailed ? ['Photo uploaded, but image assessment was unavailable'] : [])
  ];

  const incidentType = strongestSignal?.type ?? 'General Emergency';
  const incidentContext = `${incidentType} ${text} ${strongestVision?.indicators.join(' ') ?? ''}`;
  const services = [...new Set([
    winningService,
    ...detectRequiredServices(incidentContext, winningService, finalScore)
  ])];
  const responsePlan = /tsunami|volcanic eruption|earthquake|severe storm|landslide|flood/i.test(incidentType)
    ? [...new Set([
        ...getDisasterResponsePlan(strongestSignal?.type ?? 'General Emergency', finalScore),
        ...services
      ])]
    : getCrisisResponsePlan(incidentType, winningService, finalScore, incidentContext);

  const isMedicalDefault = winningService === 'ambulance' && !explicitPolicePattern.test(text) && !hasActiveFireEvidence(text);
  const finalType = isMedicalDefault && /(blood|darah|bleeding|wound|injury|luka|memar|patah|fracture|korban cedera|cedera)/i.test(`${incidentType} ${text}`)
    ? 'Medical Emergency'
    : incidentType;

  const medicalOnlyContext = `${incidentType} ${text} ${strongestVision?.indicators.join(' ') ?? ''}`;
  const medicalOnly = isMedicalOnlyText(medicalOnlyContext);
  const burnOnly = isBurnInjuryOnly(text) || (burnInjuryPattern.test(medicalOnlyContext) && !hasActiveFireEvidence(medicalOnlyContext) && !explicitPolicePattern.test(medicalOnlyContext));
  const normalizedServices = medicalOnly || burnOnly ? ['ambulance'] : normalizeMedicalOnlyPlan(services, text, incidentType);
  const normalizedResponsePlan = medicalOnly
    ? ['ambulance']
    : burnOnly
      ? ['ambulance']
      : normalizeMedicalOnlyPlan(responsePlan, text, finalType);

  return {
    type: finalType,
    service: winningService,
    score: finalScore,
    sourceScore: roundSeverityScore(finalScore),
    assessmentSummary: strongestVision
      ? strongestVision.indicators.join(' | ')
      : sharedIndicators.join(' | '),
    indicators: [...new Set([
      ...indicators,
      ...(finalType === 'Medical Emergency' ? ['Medical injury or bleeding is treated as the primary signal'] : []),
      ...(burnOnly ? ['Burn injury without active fire is routed medically'] : []),
      ...(burnInjuryVisualOnly ? ['Burn injury severity is preserved from the visual assessment'] : [])
    ])],
    services: normalizedServices,
    responsePlan: normalizedResponsePlan,
    priorityRole: normalizedResponsePlan[0] ?? winningService,
    isFalseReport,
    falseReportReason: isFalseReport ? 'No clear emergency evidence was detected in the photo or text.' : undefined
  };
}

export async function analyzeEmergency(
  text: string,
  photo?: string | null
): Promise<AIResult> {
  const textClassification = classifyText(text);
  const nlpClassification = await analyzeEmergencyTextWithNlp(text);
  let imageClassification: Classification | null = null;
  let annotatedImage: string | undefined;
  let anonymizedImage: string | undefined;
  let privacyRegions: PrivacyRegion[] | undefined;
  let imageAnalysisFailed = false;
  let visualReliabilityIndicators: string[] = [];
  let reflectionRisk = 0;
  let fireVisualSupport = 0;
  let severeLocalBleedingEvidence = false;
  const visualServiceEvidence = new Set<ServiceType>();

  if (photo) {
    const localPrivacyRegions = await detectPrivacyRegionsFromPhoto(photo);
    severeLocalBleedingEvidence = localPrivacyRegions.some(region => region.label === 'graphic content');
    privacyRegions = mergePrivacyRegions(privacyRegions, localPrivacyRegions);
    const identityRegions = localPrivacyRegions.filter(region =>
      /face|license plate|number plate/i.test(region.label)
    );
    anonymizedImage = await anonymizePhotoPixels(photo, identityRegions);
    const visualReliability = await assessVisualReliability(photo);
    visualReliabilityIndicators = visualReliability.indicators;
    reflectionRisk = visualReliability.reflectionRisk;
    fireVisualSupport = visualReliability.fireVisualSupport;
    const offlineMode = typeof navigator !== 'undefined' && !navigator.onLine;

    // Only the irreversibly anonymized pixels leave the device for remote inference.
    const remotePhoto = anonymizedImage;
    const yoloDetections = offlineMode ? [] : await analyzeEmergencyWithYolo(remotePhoto);
    if (yoloDetections.length) {
      const yoloText = yoloDetections
        .filter(detection => detection.confidence >= 0.4)
        .map(detection => detection.class.replace(/_/g, ' '))
        .join(' ');
      const yoloClassification = classifyText(yoloText);
      if (yoloText && yoloClassification.score >= textClassification.score) {
        imageClassification = {
          ...yoloClassification,
          indicators: [
            `Image assessment detected: ${yoloDetections.map(detection => detection.class).join(', ')}`
          ]
        };
      }
    }

    try {
      if (offlineMode) {
        imageAnalysisFailed = true;
        throw new Error('Offline mode: remote image assessment skipped');
      }
      const imageResult: unknown = await analyzeEmergencyImage(remotePhoto, text);
      console.log('ROBOFLOW RESULT:', imageResult);
      if (isRoboflowEnhancementOnlyIncident(imageResult)) {
        imageAnalysisFailed = true;
        throw new Error('Roboflow returned enhancement-only output');
      }
      const assessment = extractImageAssessment(imageResult);
      console.log('IMAGE ASSESSMENT:', assessment);
      if (assessment) {
        annotatedImage = assessment.annotatedImage;
        privacyRegions = mergePrivacyRegions(privacyRegions, assessment.privacyRegions);
        const roboflowClassification = classifyImage(assessment);
        assessment.visualServices?.forEach(service => {
          if (service !== 'fire' || roboflowClassification?.service === 'fire') {
            visualServiceEvidence.add(service);
          }
        });
        if (
          roboflowClassification &&
          roboflowClassification.score >= (imageClassification?.score ?? 0)
        ) {
          imageClassification = roboflowClassification;
        }
      }
    } catch (error) {
      if (!offlineMode) console.error('ROBOFLOW ERROR:', error);
      imageAnalysisFailed = true;
    }

  if (imageClassification) {
      const fireSignal = imageClassification.service === 'fire' && /fire/i.test(imageClassification.type);
      const textCorroboratesFire = hasActiveFireEvidence(text);
      const burnOnlyText = isBurnInjuryOnly(text) || burnInjuryPattern.test(text);
      const localWoundEvidence = privacyRegions?.some(region => /blood|graphic content/i.test(region.label)) ?? false;
      if (imageClassification.service === 'fire' && localWoundEvidence && (severeLocalBleedingEvidence || fireVisualSupport < 0.58) && !textCorroboratesFire) {
        imageClassification = {
          type: 'Medical Emergency',
          service: 'ambulance',
          score: imageClassification.score,
          indicators: [
            ...imageClassification.indicators,
            'Fire classification suppressed because local image evidence shows a wound and no reliable flame or smoke evidence'
          ]
        };
        visualServiceEvidence.delete('fire');
        visualServiceEvidence.add('ambulance');
      } else if (burnOnlyText && imageClassification.service === 'fire') {
        imageClassification = {
          type: 'Burn Injury Medical Emergency',
          service: 'ambulance',
          score: imageClassification.score,
          indicators: [
            ...imageClassification.indicators,
            'Burn injury routed medically because no explicit fire evidence was provided'
          ]
        };
      } else if (fireSignal && reflectionRisk >= 0.68 && fireVisualSupport < 0.58 && !textCorroboratesFire) {
        imageClassification = {
          ...imageClassification,
          score: Math.min(3, imageClassification.score),
          indicators: [
            ...imageClassification.indicators,
            'Possible wet-road reflection suppressed because text did not corroborate an active fire'
          ]
        };
      } else if (visualReliabilityIndicators.length) {
        imageClassification = {
          ...imageClassification,
          indicators: [...imageClassification.indicators, ...visualReliabilityIndicators]
        };
      }
    }

    const isUnexplainedBurnInjury =
      burnInjuryPattern.test(text) &&
      !hasActiveFireEvidence(text) &&
      !explicitPolicePattern.test(text) &&
      !visualServiceEvidence.has('fire') &&
      !visualServiceEvidence.has('police');
    if (imageClassification && isUnexplainedBurnInjury && imageClassification.service !== 'ambulance') {
      imageClassification = {
        type: 'Medical Emergency',
        service: 'ambulance',
        score: imageClassification.score,
        indicators: [
          ...imageClassification.indicators,
          'Burn injury routed medically; no evidence of active fire or intentional violence was provided'
        ]
      };
    }
  }

  const signals: Signal[] = [
    {
      source: 'text',
      type: textClassification.type,
      service: textClassification.service,
      score: textClassification.score,
      indicators: textClassification.indicators
    },
    ...(nlpClassification
      ? [{
          source: 'nlp' as const,
          type: nlpClassification.type,
          service: nlpClassification.service,
          score: nlpClassification.score,
          indicators: nlpClassification.indicators
        }]
      : []),
    ...(imageClassification
      ? [{
          source: 'vision' as const,
          type: imageClassification.type,
          service: imageClassification.service,
          score: imageClassification.score,
          indicators: imageClassification.indicators
        }]
      : [])
  ];

  const fused = fuseSignals(signals, text, imageAnalysisFailed, Boolean(photo));
  const candidateServices = [...new Set([
    ...fused.services,
    ...(nlpClassification?.services ?? []),
    ...visualServiceEvidence
  ])];
  const strongVisionServices = new Set<ServiceType>([
    ...visualServiceEvidence,
    ...signals
      .filter(signal => signal.source === 'vision' && signal.score >= 4)
      .map(signal => signal.service)
  ]);
  const protocolMultiAgency = /(tsunami|earthquake|gempa|volcanic eruption|erupsi gunung|mass casualty|banyak korban|train accident|train collision|rail collision|tabrakan kereta|kereta bertabrakan|kecelakaan kereta|plane crash|aircraft crash|pesawat jatuh|building collapse|gedung runtuh|major road collision|multi-vehicle collision)/i.test(`${fused.type} ${text} ${fused.indicators.join(' ')}`);
  const hasServiceEvidence = (service: ServiceType) => {
    if (service === fused.service || protocolMultiAgency) return true;
    if (service === 'ambulance') return explicitMedicalPattern.test(text) || strongVisionServices.has('ambulance');
    if (service === 'fire') {
      const fireOrRescueContext = `${fused.type} ${text} ${fused.indicators.join(' ')}`
        .replace(/image assessment detected:\s*fire emergency/gi, ' ')
        .replace(/roboflow visual context detected:\s*fire emergency/gi, ' ');
      return hasActiveFireEvidence(fireOrRescueContext) ||
        trappedVictimPattern.test(fireOrRescueContext) ||
        smallDangerousAnimalPattern.test(fireOrRescueContext) ||
        majorRailCollisionPattern.test(fireOrRescueContext) ||
        planeCrashPattern.test(fireOrRescueContext) ||
        buildingCollapsePattern.test(fireOrRescueContext) ||
        massCasualtyPattern.test(fireOrRescueContext) ||
        majorRoadCollisionPattern.test(fireOrRescueContext) ||
        strongVisionServices.has('fire');
    }
    if (fused.services.includes(service)) return true;
    return explicitPolicePattern.test(text) || strongVisionServices.has('police');
  };
  const fusedServices = normalizeMedicalOnlyPlan(candidateServices.filter(hasServiceEvidence), fused.type, text);
  const fusedResponsePlan = normalizeMedicalOnlyPlan(
    [...new Set([
      ...fused.responsePlan,
      ...fusedServices
    ])].filter(role =>
      role === 'disaster-response' ||
      !['ambulance', 'fire', 'police'].includes(role) ||
      fusedServices.includes(role as ServiceType)
    ),
    fused.type,
    text
  );

  return {
    type: fused.type,
    service: fused.service,
    services: fusedServices,
    responsePlan: fusedResponsePlan,
    priorityRole: fusedResponsePlan[0] ?? fused.priorityRole,
    severityScore: fused.sourceScore,
    severity: severityFromScore(fused.sourceScore),
    indicators: [...new Set([...fused.indicators, ...visualReliabilityIndicators])],
    assessmentSummary: fused.assessmentSummary,
    annotatedImage: annotatedImage ?? anonymizedImage,
    anonymizedImage,
    privacyRegions,
    isFalseReport: fused.isFalseReport,
    falseReportReason: fused.falseReportReason
  };
}
