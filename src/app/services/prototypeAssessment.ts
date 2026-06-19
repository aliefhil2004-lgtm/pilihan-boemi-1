import type { AIResult } from './ai';
import type { EvidenceMetadata, PrivacyRegion, StoredEmergencyReport } from '../types/emergency';

type ReportPrototypeFields = Pick<
  StoredEmergencyReport,
  | 'aiConfidence'
  | 'reviewStatus'
  | 'reviewReason'
  | 'responseMetrics'
  | 'evidenceVerification'
  | 'anonymizationStatus'
  | 'offlineSyncStatus'
>;

function hasRegionalDialectRisk(text: string) {
  return /\b(gw|gue|gua|lu|lo|nih|dong|banget|bgt|tolongin|kebakar|kebakaran gede|nyangkut|pingsan|sesek|sesek napas|ga bisa|nggak bisa|gak bisa)\b/i.test(text);
}

function hasMixedSignals(indicators: string[]) {
  return indicators.some(indicator => /mixed|suppressed|manual review|operator verification|unavailable|responder verification/i.test(indicator));
}

export function estimateAiConfidence(
  aiResult: AIResult,
  description: string,
  hasPhoto: boolean
) {
  let confidence = 58 + aiResult.severityScore * 3;

  if (aiResult.indicators.length >= 2) confidence += 8;
  if (hasPhoto && aiResult.annotatedImage) confidence += 6;
  if (aiResult.privacyRegions?.length) confidence += 3;
  if (hasRegionalDialectRisk(description)) confidence -= 18;
  if (hasMixedSignals(aiResult.indicators)) confidence -= 14;
  if (aiResult.isFalseReport) confidence -= 22;

  return Math.max(28, Math.min(96, Math.round(confidence)));
}

export function buildEvidenceVerification(
  photo: string | null,
  coords?: { lat: number; lng: number },
  privacyRegions?: PrivacyRegion[],
  metadata?: EvidenceMetadata
): StoredEmergencyReport['evidenceVerification'] {
  const capturedAt = metadata?.capturedAt ?? metadata?.fileLastModifiedAt;
  const captureAgeMs = capturedAt ? Date.now() - new Date(capturedAt).getTime() : Number.POSITIVE_INFINITY;
  const isFresh = Number.isFinite(captureAgeMs) && captureAgeMs >= -60_000 && captureAgeMs <= 60 * 60 * 1000;
  const hasUsefulResolution = (metadata?.width ?? 0) >= 640 && (metadata?.height ?? 0) >= 360;
  const hasAccurateGps = typeof metadata?.gpsAccuracyMeters === 'number' && metadata.gpsAccuracyMeters <= 100;
  const previousReports = typeof localStorage === 'undefined'
    ? []
    : JSON.parse(localStorage.getItem('emergencyReports') || '[]') as StoredEmergencyReport[];
  const isUnique = !metadata?.fingerprint || !previousReports.some(
    report => report.evidenceMetadata?.fingerprint === metadata.fingerprint
  );
  const checks = [
    { label: 'Photo attached and readable', passed: Boolean(photo), points: 10 },
    { label: 'Capture timestamp is within one hour', passed: isFresh, points: 20 },
    { label: 'GPS coordinates available', passed: Boolean(coords), points: 15 },
    { label: 'GPS accuracy is 100 meters or better', passed: hasAccurateGps, points: 15 },
    { label: 'Image resolution is sufficient for triage', passed: hasUsefulResolution, points: 10 },
    { label: 'Image fingerprint is not a previous report duplicate', passed: isUnique, points: 15 },
    { label: 'Local privacy scan completed before upload', passed: Boolean(photo), points: 15 }
  ];

  return {
    score: checks.reduce((sum, check) => sum + (check.passed ? check.points : 0), 0),
    checks
  };
}

export function buildPrototypeAssessment(input: {
  aiResult: AIResult;
  description: string;
  photo: string | null;
  coords?: { lat: number; lng: number };
  privacyRegions?: PrivacyRegion[];
  evidenceMetadata?: EvidenceMetadata;
  analysisStartedAtMs: number;
  analysisCompletedAtMs: number;
}): ReportPrototypeFields {
  const aiConfidence = estimateAiConfidence(input.aiResult, input.description, Boolean(input.photo));
  const dialectRisk = hasRegionalDialectRisk(input.description);
  const mixedSignals = hasMixedSignals(input.aiResult.indicators);
  const needsHumanReview = aiConfidence < 68 || dialectRisk || mixedSignals;
  const aiTriageSeconds = Math.max(1, Math.ceil((input.analysisCompletedAtMs - input.analysisStartedAtMs) / 1000));
  const routedSeconds = aiTriageSeconds + 1;
  const manualTriageBaselineSeconds = 120;
  const stepSavings = [
    { step: 'Location validation', manualSeconds: 60, automatedSeconds: 1 },
    { step: 'Incident classification', manualSeconds: 45, automatedSeconds: aiTriageSeconds },
    { step: 'Agency routing', manualSeconds: 30, automatedSeconds: 1 }
  ].map(step => ({
    ...step,
    savedSeconds: Math.max(0, step.manualSeconds - step.automatedSeconds)
  }));

  return {
    aiConfidence,
    reviewStatus: needsHumanReview ? 'needs-human-review' : 'auto-routed',
    reviewReason: needsHumanReview
      ? dialectRisk
        ? 'Regional slang or informal wording detected; operator confirmation is required.'
        : mixedSignals
          ? 'AI signals are mixed or incomplete; operator confirmation is required.'
          : 'AI confidence is below the automatic routing threshold.'
      : 'AI confidence is above the automatic routing threshold.',
    responseMetrics: {
      submittedSeconds: 0,
      aiTriageSeconds,
      routedSeconds,
      dispatchTargetSeconds: 45,
      estimatedTriageSecondsSaved: Math.max(0, manualTriageBaselineSeconds - routedSeconds),
      jakartaBaselineSeconds: 24 * 60,
      simulatedTotalSeconds: 45 + routedSeconds,
      measuredAt: new Date().toISOString(),
      stepSavings
    },
    evidenceVerification: buildEvidenceVerification(
      input.photo,
      input.coords,
      input.privacyRegions,
      input.evidenceMetadata
    ),
    anonymizationStatus: input.privacyRegions?.length ? 'anonymized' : 'not-needed',
    offlineSyncStatus: typeof navigator !== 'undefined' && !navigator.onLine ? 'queued-for-sync' : 'syncing'
  };
}
