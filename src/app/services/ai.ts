import { analyzeEmergencyImage } from '../roboflow';
import { analyzeEmergencyWithYolo } from './yolo';
import { analyzeEmergencyTextWithNlp } from './nlp';
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
}

interface ImageAssessment {
  incidentType: string;
  severityScore: number;
  description?: string;
  annotatedImage?: string;
}

interface Classification {
  type: string;
  service: ServiceType;
  score: number;
  indicators: string[];
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
    keywords: ['theft', 'fight', 'vandalism', 'police', 'pencurian', 'berkelahi', 'kerusuhan', 'polisi']
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
    }>;
  }).outputs?.[0];

  if (!output || typeof output.incident_type !== 'string') return null;

  return {
    incidentType: output.incident_type.toLowerCase(),
    severityScore: typeof output.severity_score === 'number' ? output.severity_score : 0,
    description: typeof output.description === 'string' ? output.description : undefined,
    annotatedImage:
      typeof output.annotated_image?.value === 'string'
        ? `data:image/jpeg;base64,${output.annotated_image.value}`
        : undefined
  };
}

function classifyText(text: string): Classification {
  const lower = text.toLowerCase();
  const matches = rules.filter(rule => includesAny(lower, rule.keywords));
  const strongest = matches.sort((a, b) => b.score - a.score)[0];
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
  const match = rules.find(rule => includesAny(imageText, rule.keywords));
  if (!match || assessment.incidentType === 'none') return null;

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
  const multiAgencyIncident =
    /(train accident|train crash|railway accident|kecelakaan kereta|kereta anjlok|plane crash|pesawat jatuh|mass casualty|banyak korban|building collapse|gedung runtuh|tsunami|volcanic eruption|volcano eruption|gunung meletus|erupsi gunung|earthquake|gempa|typhoon|hurricane|cyclone|tornado|topan|puting beliung|landslide|longsor|flash flood|flood|banjir)/i;

  if (multiAgencyIncident.test(lower)) {
    services.add('ambulance');
    services.add('fire');
    services.add('police');
  }

  if (primary === 'fire' && severityScore >= 8) {
    services.add('ambulance');
  }

  rules.forEach(rule => {
    if (includesAny(lower, rule.keywords)) services.add(rule.service);
  });

  return [...services];
}

export async function analyzeEmergency(
  text: string,
  photo?: string | null
): Promise<AIResult> {
  const textClassification = classifyText(text);
  const nlpClassification = await analyzeEmergencyTextWithNlp(text);
  let imageClassification: Classification | null = null;
  let annotatedImage: string | undefined;
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

  const strongest =
    imageClassification &&
    (imageClassification.score >= textClassification.score || textClassification.type === 'General Emergency')
      ? imageClassification
      : nlpClassification && nlpClassification.score > textClassification.score
      ? nlpClassification
      : textClassification;
  const score = Math.max(textClassification.score, nlpClassification?.score ?? 0, imageClassification?.score ?? 0);
  const indicators = [
    ...textClassification.indicators,
    ...(nlpClassification?.indicators ?? []),
    ...(imageClassification?.indicators ?? []),
    ...(imageAnalysisFailed ? ['Photo uploaded, but image assessment was unavailable'] : [])
  ];
  const assessmentText =
    `${text} ${strongest.type} ${nlpClassification?.type ?? ''} ${nlpClassification?.indicators.join(' ') ?? ''} ${imageClassification?.type ?? ''} ${imageClassification?.indicators.join(' ') ?? ''}`;
  const services = detectRequiredServices(
    assessmentText,
    strongest.service,
    score
  );
  if (services.length > 1) indicators.push('Multi-agency response required');

  return {
    type: strongest.type,
    service: strongest.service,
    services,
    severityScore: score,
    severity: severityFromScore(score),
    indicators: [...new Set(indicators)],
    annotatedImage
  };
}
