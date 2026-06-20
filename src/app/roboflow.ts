function inferIncidentType(reportText: string) {
  const lower = reportText.toLowerCase();
  if (/tsunami/.test(lower)) return 'tsunami';
  if (/earthquake|gempa/.test(lower)) return 'earthquake';
  if (/flood|banjir/.test(lower)) return 'flood';
  if (/landslide|longsor/.test(lower)) return 'landslide';
  if (/volcanic|gunung meletus|erupsi/.test(lower)) return 'volcanic eruption';
  if (/gas leak|gas odor|kebocoran gas|gas bocor|bau gas|carbon monoxide|karbon monoksida|hazmat|bau kimia|asap kimia/.test(lower)) {
    return 'gas leak hazmat emergency';
  }
  if (/luka bakar|luka kebakar|kulit terbakar|burn wound|burn injury|burned skin|scald|iritasi|luka sobek|luka robek|lecet|gores|wound|laceration|abrasion/.test(lower)) {
    return 'medical emergency';
  }
  if (/(\bkebakaran\b|\bfire\b|\bflames?\b|\bsmoke\b|\basap\b|kobaran api|api (menyala|besar|menjalar|menyebar)|burning (house|building|vehicle|car|forest|room)|\bexplod(?:e|es|ed|ing)?\b|\bexplosion\b|\bblast(?:ed|ing)?\b|\bdetonat(?:e|es|ed|ing|ion)\b|\bblew up\b|\bblown up\b|ledakan|meledak+k?|meleduk|letupan|meletup|sumabog|pagsabog)/.test(lower)) return 'fire emergency';
  if (/weapon|gun|knife|robbery|assault|theft|crime|pistol|pisau|rampok|pencurian|kekerasan|polisi/.test(lower)) {
    return 'police emergency';
  }
  if (/snake|ular|animal rescue|hewan terjebak|sarang tawon|wasp nest|civet|musang|anjing galak/.test(lower)) {
    return 'animal rescue';
  }
  if (/chest pain|nyeri dada|heart attack|serangan jantung|stroke|difficulty breathing|sesak napas|not breathing|tidak bernapas/.test(lower)) {
    return 'medical emergency';
  }
  if (/injury|bleeding|wound|fracture|accident|luka|darah|pendarahan|patah|kecelakaan|tabrakan/.test(lower)) {
    return 'medical emergency';
  }
  return 'general emergency';
}

function inferSeverityScore(incidentType: string, reportText: string) {
  const lower = `${incidentType} ${reportText}`.toLowerCase();
  if (/tsunami|earthquake|gempa|gas leak|hazmat|heart attack|stroke|not breathing|tidak bernapas|explosion|ledakan/.test(lower)) return 9;
  if (/fire|kebakaran|smoke|asap|police|weapon|crime|animal rescue|injury|bleeding|accident/.test(lower)) return 7;
  if (/flood|banjir|landslide|longsor|medical/.test(lower)) return 6;
  return 5;
}

type WorkflowPrediction = {
  class?: unknown;
  confidence?: unknown;
};

type DetectorAssessment = {
  incidentType: string;
  severityScore: number;
  confidence: number;
  evidence: string;
};

function isEnhancementOnlyIncident(value: string) {
  return /(upscale|super resolution|enhancement|lighting|light|brightness|contrast|sharpen|denoise|noise reduction|quality|blur|deblur|color correction|image preprocessing|preprocessing|image enhancement|photo quality)/i.test(value);
}

function readPredictions(value: unknown): WorkflowPrediction[] {
  if (!value || typeof value !== 'object') return [];
  const predictions = (value as { predictions?: unknown }).predictions;
  return Array.isArray(predictions) ? predictions : [];
}

function predictionConfidence(prediction: WorkflowPrediction) {
  const confidence = Number(prediction.confidence);
  return Number.isFinite(confidence) ? confidence : 0;
}

function inferDetectorAssessment(output: Record<string, unknown>): DetectorAssessment | null {
  const detectorGroups: Array<{
    key: string;
    incidentType: string;
    severityScore: number;
  }> = [
    { key: 'gun_and_knife_predictions', incidentType: 'police emergency', severityScore: 9 },
    { key: 'injured_person_predictions', incidentType: 'medical emergency', severityScore: 8 },
    { key: 'fire_predictions', incidentType: 'fire emergency', severityScore: 8 },
    { key: 'vehicle_accident_predictions', incidentType: 'traffic accident', severityScore: 8 },
  ];

  const candidates = detectorGroups.flatMap(group =>
    readPredictions(output[group.key])
      .filter(prediction => predictionConfidence(prediction) >= 0.35)
      .map(prediction => ({
        incidentType: group.incidentType,
        severityScore: group.severityScore,
        confidence: predictionConfidence(prediction),
        evidence: typeof prediction.class === 'string' ? prediction.class : group.key,
      }))
  );

  const enhancementOnlyGroups = ['upscale_predictions', 'lighting_predictions', 'enhancement_predictions', 'quality_predictions'];
  const enhancementSignals = enhancementOnlyGroups.flatMap(key =>
    readPredictions(output[key])
      .filter(prediction => predictionConfidence(prediction) >= 0.35)
      .map(prediction => typeof prediction.class === 'string' ? prediction.class.toLowerCase() : key)
  );

  const genericPredictions = [
    ...readPredictions(output.detections),
    ...readPredictions(output.my_first_project_predictions),
  ];

  genericPredictions.forEach(prediction => {
    const label = typeof prediction.class === 'string' ? prediction.class.toLowerCase() : '';
    const confidence = predictionConfidence(prediction);
    if (confidence < 0.35) return;

    if (/gun|knife|weapon|pistol|rifle|senjata|pisau/.test(label)) {
      candidates.push({ incidentType: 'police emergency', severityScore: 9, confidence, evidence: label });
    } else if (/injur|blood|wound|unconscious|person down|korban|luka|darah/.test(label)) {
      candidates.push({ incidentType: 'medical emergency', severityScore: 8, confidence, evidence: label });
    } else if (/fire|flame|smoke|kebakaran|api|asap/.test(label)) {
      candidates.push({ incidentType: 'fire emergency', severityScore: 8, confidence, evidence: label });
    } else if (/accident|collision|crash|wreck|kecelakaan|tabrakan/.test(label)) {
      candidates.push({ incidentType: 'traffic accident', severityScore: 8, confidence, evidence: label });
    } else if (isEnhancementOnlyIncident(label)) {
      enhancementSignals.push(label);
    }
  });

  if (!candidates.length && enhancementSignals.length) {
    return {
      incidentType: 'general emergency',
      severityScore: 2,
      confidence: Math.max(...enhancementSignals.map(() => 0.35), 0.35),
      evidence: enhancementSignals.join(', ')
    };
  }

  const medicalCandidates = candidates.filter(candidate => candidate.incidentType === 'medical emergency');
  const description = typeof output.description === 'string' ? output.description.toLowerCase() : '';
  const concreteFireScene = /(visible flames?|open flames?|active fire|heavy smoke|thick smoke|black smoke|burning (house|building|vehicle|car|forest|room)|kobaran api|api (menyala|besar|menjalar|menyebar)|asap (tebal|hitam)|rumah terbakar|gedung terbakar|bangunan terbakar|kendaraan terbakar)/i.test(description);
  if (medicalCandidates.length && !concreteFireScene) {
    return medicalCandidates.sort((left, right) => right.confidence - left.confidence)[0];
  }

  return candidates.sort((left, right) =>
    right.severityScore - left.severityScore || right.confidence - left.confidence
  )[0] ?? null;
}

function normalizeRoboflowResult(value: unknown, reportText: string) {
  if (!value || typeof value !== 'object') return value;
  const payload = value as {
    outputs?: Array<Record<string, unknown>>;
  };
  const output = payload.outputs?.[0];
  if (!output || typeof output !== 'object') return value;

  const detectorAssessment = inferDetectorAssessment(output);
  const currentIncident = typeof output.incident_type === 'string'
    ? output.incident_type.trim().toLowerCase()
    : '';
  const currentSeverity = Number(output.severity_score);
  const hasSpecificIncident = Boolean(currentIncident) && !/^(none|general emergency|unknown)$/.test(currentIncident);

  if (/burn injury|luka bakar|burn wound|burned skin|scald/i.test(currentIncident)) {
    const severityScore = Number.isFinite(currentSeverity) ? currentSeverity : 7.5;
    return {
      ...payload,
      outputs: [
        {
          ...output,
          incident_type: 'burn injury medical emergency',
          severity_score: severityScore,
          confidence: Math.max(Number(output.confidence ?? 0), 0.7),
          description: typeof output.description === 'string' ? output.description : 'Burn injury detected by Roboflow workflow.'
        },
        ...payload.outputs.slice(1),
      ],
    };
  }

  // Prefer the workflow's own incident/severity fields when they are already present.
  // Only fall back to local inference when Roboflow omits the metadata entirely.
  if (hasSpecificIncident && Number.isFinite(currentSeverity)) {
    return value;
  }

  if (
    detectorAssessment &&
    !isEnhancementOnlyIncident(detectorAssessment.incidentType) &&
    (!hasSpecificIncident || !Number.isFinite(currentSeverity) || detectorAssessment.severityScore > currentSeverity)
  ) {
    return {
      ...payload,
      outputs: [
        {
          ...output,
          incident_type: detectorAssessment.incidentType,
          severity_score: Math.max(
            detectorAssessment.severityScore,
            Number.isFinite(currentSeverity) ? currentSeverity : 0
          ),
          confidence: Math.max(
            detectorAssessment.confidence,
            typeof output.confidence === 'number' ? output.confidence : 0
          ),
          description: [
            typeof output.description === 'string' ? output.description : '',
            `Detector evidence: ${detectorAssessment.evidence}.`,
          ].filter(Boolean).join(' '),
        },
        ...payload.outputs.slice(1),
      ],
    };
  }

  if (typeof output.incident_type === 'string') return value;

  const incidentType = inferIncidentType(reportText);
  return {
    ...payload,
    outputs: [
      {
        description: 'Roboflow workflow returned visual evidence without incident metadata; incident was inferred from report text.',
        confidence: typeof output.confidence === 'number' ? output.confidence : 0.45,
        ...output,
        incident_type: isEnhancementOnlyIncident(incidentType) ? 'general emergency' : incidentType,
        severity_score: inferSeverityScore(incidentType, reportText),
      },
      ...payload.outputs.slice(1),
    ],
  };
}

export function isRoboflowEnhancementOnlyIncident(value: unknown) {
  if (!value || typeof value !== 'object') return false;
  const payload = value as { outputs?: Array<Record<string, unknown>> };
  const output = payload.outputs?.[0];
  if (!output || typeof output !== 'object') return false;
  const incidentType = typeof output.incident_type === 'string' ? output.incident_type : '';
  return /(upscale|super resolution|enhancement|lighting|light|brightness|contrast|sharpen|denoise|noise reduction|quality|blur|deblur|color correction|image preprocessing|preprocessing|image enhancement|photo quality)/i.test(incidentType);
}

function compressImageForInference(imageBase64: string): Promise<string> {
  if (typeof document === 'undefined' || !imageBase64.startsWith('data:image/')) {
    return Promise.resolve(imageBase64);
  }

  return new Promise(resolve => {
    const image = new Image();
    image.onerror = () => resolve(imageBase64);
    image.onload = () => {
      const maxDimension = 1600;
      const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        resolve(imageBase64);
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    image.src = imageBase64;
  });
}

export async function analyzeEmergencyImage(imageBase64: string, reportText = '') {
  const inferenceImage = await compressImageForInference(imageBase64);
  const cleanBase64 = inferenceImage.includes(',')
    ? inferenceImage.split(',')[1]
    : inferenceImage;

  const response = await fetch(
    '/api/roboflow',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {
          image: {
            type: 'base64',
            value: cleanBase64,
          },
          report_text: reportText,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Roboflow request failed with status ${response.status}`);
  }

  return normalizeRoboflowResult(await response.json(), reportText);
}
