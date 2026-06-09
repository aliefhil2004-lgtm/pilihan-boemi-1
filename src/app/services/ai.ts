import { analyzeEmergencyImage } from '../roboflow';
import { analyzeEmergencyWithYolo } from './yolo';
import { analyzeEmergencyTextWithNlp } from './nlp';
import type { PrivacyRegion } from '../types/emergency';
import type { ServiceType } from '../types/emergency';
export type { ServiceType } from '../types/emergency';

export interface AIResult {
  type: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  severityScore: number;
  service: ServiceType;
  services: ServiceType[];
  indicators: string[];
  annotatedImage?: string;
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

interface FusionResult {
  type: string;
  service: ServiceType;
  score: number;
  indicators: string[];
  services: ServiceType[];
  isFalseReport: boolean;
  falseReportReason?: string;
}

const signalWeights: Record<Signal['source'], number> = {
  text: 0.25,
  nlp: 0.3,
  vision: 0.45
};

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
    service: 'fire', type: 'Fire Emergency', score: 9,
    indicator: 'Explosion or hazardous fire risk detected',
    keywords: ['explosion', 'ledakan', 'gas leak', 'kebocoran gas', 'trapped in fire', 'terjebak api']
  },
  {
    service: 'fire', type: 'Fire Emergency', score: 8,
    indicator: 'Active structural fire detected',
    keywords: ['building fire', 'house fire', 'wildfire', 'kebakaran gedung', 'kebakaran rumah', 'kebakaran hutan', 'api menyebar']
  },
  {
    service: 'fire', type: 'Fire Emergency', score: 5,
    indicator: 'Fire or smoke reported',
    keywords: ['fire', 'flame', 'smoke', 'burning', 'kebakaran', 'asap', 'terbakar', 'api']
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
    service: 'fire', type: 'Animal Rescue', score: 6,
    indicator: 'Dangerous animal or rescue scenario detected',
    keywords: [
      'animal rescue', 'animal_rescue', 'animal-rescue', 'animal trapped', 'animal stuck',
      'killer', 'killers', 'attack', 'attacking', 'predator', 'wild animal', 'animal attack', 'serigala',
      'buaya', 'harimau', 'beruang', 'lion', 'tiger', 'snake', 'ular', 'hewan buas', 'hewan liar', 'dikejar', 'diteror',
      'cat stuck in tree', 'cat rescue', 'dog rescue', 'pet rescue', 'hewan terjebak', 'hewan tersangkut', 'anjing terjebak', 'kucing terjebak'
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
    keywords: ['injury', 'wound', 'pain', 'blood', 'cedera', 'luka', 'sakit', 'darah', 'pusing', 'demam', 'memar', 'kaki memar']
  },
  {
    service: 'fire', type: 'Animal Rescue', score: 2,
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
  'serigala', 'buaya', 'harimau', 'beruang', 'lion', 'tiger', 'snake', 'ular', 'predator'
];

function hasAnimalContext(value: string) {
  return includesAny(value, animalKeywords);
}

function severityFromScore(score: number): AIResult['severity'] {
  if (score >= 8) return 'Critical';
  if (score >= 6) return 'High';
  if (score >= 4) return 'Medium';
  return 'Low';
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
    }>;
  }).outputs?.[0];

  if (!output || typeof output.incident_type !== 'string') return null;

  return {
    incidentType: output.incident_type.toLowerCase(),
    severityScore: typeof output.severity_score === 'number' ? output.severity_score : 0,
    description: typeof output.description === 'string' ? output.description : undefined,
    confidence: typeof output.confidence === 'number' ? output.confidence : undefined,
    annotatedImage:
      typeof output.annotated_image?.value === 'string'
        ? `data:image/jpeg;base64,${output.annotated_image.value}`
        : undefined,
    privacyRegions: extractPrivacyRegions(output)
  };
}

function normalizeRegionLabel(value: string) {
  const label = value.toLowerCase();
  if (/(face|person|head|human|muka|wajah)/i.test(label)) return 'face';
  if (/(license plate|plate|plat|vehicle plate|nomor polisi|nopol|polisi kendaraan)/i.test(label)) return 'license plate';
  if (/(blood|darah|bleeding|luka)/i.test(label)) return 'blood';
  if (/(accident|collision|crash|wreck|damaged vehicle|kendaraan rusak|kecelakaan)/i.test(label)) return 'accident';
  return label;
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

    if (typeof typed.x === 'number' && typeof typed.y === 'number' && typeof typed.width === 'number' && typeof typed.height === 'number') {
      return [{
        label: label || 'sensitive object',
        left: Math.max(0, typed.x - typed.width / 2),
        top: Math.max(0, typed.y - typed.height / 2),
        width: Math.max(0, typed.width),
        height: Math.max(0, typed.height),
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
        width: Math.max(0, typed.right - typed.left),
        height: Math.max(0, typed.bottom - typed.top),
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
    ? matches.find(rule => rule.service === 'fire' && /animal rescue|rescue assistance/i.test(rule.type)) ?? matches.sort((a, b) => b.score - a.score)[0]
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
  const animalMatch = hasAnimalContext(imageText);
  const match = animalMatch
    ? rules.find(rule => rule.service === 'fire' && /Animal Rescue|Rescue Assistance/i.test(rule.type))
      ?? rules.find(rule => includesAny(imageText, rule.keywords))
    : rules.find(rule => includesAny(imageText, rule.keywords));
  if (!match || assessment.incidentType === 'none') return null;

  const confidence = assessment.confidence ?? 0;
  const strongEnough = assessment.severityScore >= 4 || confidence >= 0.6;

  // Neutral photos should not invent an emergency.
  if (!strongEnough && match.service === 'ambulance') return null;

  return {
    type: match.type,
    service: match.service,
    score: Math.max(1, Math.min(10, Math.max(match.score, assessment.severityScore || 0))),
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
  const largeAnimalIncident = /(wild animal|animal attack|hewan buas|hewan liar|buaya|harimau|beruang|lion|tiger|serigala|snake|ular|predator|hewan besar)/i;
  const injurySignal = /(injury|injured|hurt|fallen|fall|jatuh|cedera|luka|patah|darah|bleeding|pendarahan|korban|victim|unconscious|tidak sadar|unresponsive|sesak napas|difficulty breathing)/i;
  const multiAgencyIncident =
    /(train accident|train crash|railway accident|kecelakaan kereta|kereta anjlok|plane crash|pesawat jatuh|mass casualty|banyak korban|building collapse|gedung runtuh|tsunami|volcanic eruption|volcano eruption|gunung meletus|erupsi gunung|earthquake|gempa|typhoon|hurricane|cyclone|tornado|topan|puting beliung|landslide|longsor|flash flood|flood|banjir)/i;

  if (multiAgencyIncident.test(lower)) {
    services.add('ambulance');
    services.add('fire');
    services.add('police');
  }

  if (primary === 'fire' && severityScore >= 8 && injurySignal.test(lower)) {
    services.add('ambulance');
  }

  if (largeAnimalIncident.test(lower)) {
    services.add('police');
    if (injurySignal.test(lower)) {
      services.add('ambulance');
    }
  }

  rules.forEach(rule => {
    if (includesAny(lower, rule.keywords)) services.add(rule.service);
  });

  return [...services];
}

function fuseSignals(signals: Signal[], text: string, imageAnalysisFailed: boolean): FusionResult {
  const usableSignals = signals.filter(signal => signal.score > 0);
  const totalWeight = usableSignals.reduce((sum, signal) => sum + signalWeights[signal.source], 0) || 1;
  const hasTextInput = text.trim().length > 0;

  const serviceWeights = usableSignals.reduce((acc, signal) => {
    acc[signal.service] = (acc[signal.service] ?? 0) + signal.score * signalWeights[signal.source];
    return acc;
  }, {} as Record<ServiceType, number>);

  const winningService = (Object.entries(serviceWeights).sort((a, b) => b[1] - a[1])[0]?.[0] as ServiceType | undefined) ?? 'ambulance';
  const serviceSignals = usableSignals.filter(signal => signal.service === winningService);
  const strongestSignal = [...serviceSignals].sort((a, b) => b.score - a.score)[0] ?? [...usableSignals].sort((a, b) => b.score - a.score)[0];
  const weightedScore = usableSignals.reduce(
    (sum, signal) => sum + signal.score * signalWeights[signal.source],
    0
  ) / totalWeight;
  const hasSpecificSignal = signals.some(signal => signal.type !== 'General Emergency' && signal.source !== 'vision') ||
    signals.some(signal => signal.source === 'vision' && signal.score >= 4);
  const isFalseReport = !hasSpecificSignal && signals.every(signal => signal.score <= 2);

  const hasStrongTextSignal = signals.some(signal => signal.source !== 'vision' && signal.score >= 5);
  const hasStrongVisionSignal = signals.some(signal => signal.source === 'vision' && signal.score >= 6);

  // If the report is image-only, keep the vision result authoritative.
  if (!hasTextInput) {
    const visionSignals = signals.filter(signal => signal.source === 'vision');
    const strongestVision = [...visionSignals].sort((a, b) => b.score - a.score)[0];

    if (strongestVision) {
      const services = detectRequiredServices(text, strongestVision.service, strongestVision.score);
      return {
        type: strongestVision.type,
        service: strongestVision.service,
        score: Math.max(1, Math.min(10, Math.round(strongestVision.score))),
        indicators: [
          ...strongestVision.indicators,
          'Image-only report resolved directly from vision analysis',
          ...(imageAnalysisFailed ? ['Photo uploaded, but image assessment was unavailable'] : [])
        ],
        services,
        isFalseReport: false,
        falseReportReason: undefined
      };
    }
  }

  // If only vision is weakly suggesting medical, keep it conservative.
  if (!hasStrongTextSignal && !hasStrongVisionSignal) {
    const safeService = signals.find(signal => signal.source !== 'vision' && signal.score >= 3)?.service ?? 'ambulance';
    const safeType = signals.find(signal => signal.source !== 'vision' && signal.score >= 3)?.type ?? 'General Emergency';
    return {
      type: safeType,
      service: safeService,
      score: Math.max(1, Math.min(10, Math.round(weightedScore))),
      indicators: [
        'Low-confidence image signals were suppressed to avoid false positives',
        ...(imageAnalysisFailed ? ['Photo uploaded, but image assessment was unavailable'] : [])
      ],
      services: detectRequiredServices(text, safeService, Math.max(1, Math.min(10, Math.round(weightedScore)))),
      isFalseReport,
      falseReportReason: isFalseReport ? 'No clear emergency evidence was detected in the photo or text.' : undefined
    };
  }

  const finalScore = Math.max(
    1,
    Math.min(10, Math.round(Math.max(weightedScore, strongestSignal?.score ?? 1)))
  );

  const serviceLabels = [...new Set(usableSignals.map(signal => signal.service))];
  const sharedIndicators = usableSignals.map(signal =>
    `${signal.source.toUpperCase()}: ${signal.indicators.join('; ') || signal.type}`
  );
  const indicators = [
    ...sharedIndicators,
    ...(serviceLabels.length > 1
      ? [`Signals were mixed across ${serviceLabels.join(', ')}; fused on ${winningService}`]
      : [`Text, NLP, and vision aligned on ${winningService}`]),
    ...(strongestSignal?.source === 'vision' && strongestSignal.service === 'ambulance' && strongestSignal.score < 6
      ? ['Medical signal from vision was treated as low confidence and not allowed to override the text']
      : []),
    ...(imageAnalysisFailed ? ['Photo uploaded, but image assessment was unavailable'] : [])
  ];

  const services = detectRequiredServices(text, winningService, finalScore);
  for (const service of serviceLabels) services.push(service);

  return {
    type: strongestSignal?.type ?? 'General Emergency',
    service: winningService,
    score: finalScore,
    indicators: [...new Set(indicators)],
    services: [...new Set(services)],
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
  let privacyRegions: PrivacyRegion[] | undefined;
  let imageAnalysisFailed = false;

  if (photo) {
    const yoloDetections = await analyzeEmergencyWithYolo(photo);
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
      const imageResult: unknown = await analyzeEmergencyImage(photo);
      console.log('ROBOFLOW RESULT:', imageResult);
      const assessment = extractImageAssessment(imageResult);
      console.log('IMAGE ASSESSMENT:', assessment);
      if (assessment) {
        annotatedImage = assessment.annotatedImage;
        privacyRegions = assessment.privacyRegions;
        const roboflowClassification = classifyImage(assessment);
        if (
          roboflowClassification &&
          roboflowClassification.score >= (imageClassification?.score ?? 0)
        ) {
          imageClassification = roboflowClassification;
        }
      }
    } catch (error) {
      console.error('ROBOFLOW ERROR:', error);
      imageAnalysisFailed = true;
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

  const fused = fuseSignals(signals, text, imageAnalysisFailed);

  return {
    type: fused.type,
    service: fused.service,
    services: fused.services,
    severityScore: fused.score,
    severity: severityFromScore(fused.score),
    indicators: fused.indicators,
    annotatedImage,
    privacyRegions,
    isFalseReport: fused.isFalseReport,
    falseReportReason: fused.falseReportReason
  };
}
