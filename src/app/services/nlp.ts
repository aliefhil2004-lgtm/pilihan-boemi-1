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
}

const labelMapping: Record<string, { service: ServiceType; type: string; baseScore: number }> = {
  'medical emergency': { service: 'ambulance', type: 'Medical Emergency', baseScore: 7 },
  'fire rescue emergency': { service: 'fire', type: 'Fire Emergency', baseScore: 7 },
  'police security emergency': { service: 'police', type: 'Police Emergency', baseScore: 7 },
  'natural disaster': { service: 'fire', type: 'Natural Disaster', baseScore: 8 },
  'lost property non emergency': { service: 'police', type: 'Lost Property Report', baseScore: 2 },
  'threatening incident': { service: 'police', type: 'Police Emergency', baseScore: 7 },
  'dangerous animal threat': { service: 'fire', type: 'Animal Rescue', baseScore: 6 },
  'drug related crime': { service: 'police', type: 'Police Emergency', baseScore: 8 }
};

export async function analyzeEmergencyTextWithNlp(text: string): Promise<NlpEmergencyResult | null> {
  if (!text.trim()) return null;

  try {
    const response = await fetch('/api/nlp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (!response.ok) return null;
    const result = await response.json() as {
      available?: boolean;
      model?: string;
      classifications?: NlpClassification[];
    };
    if (!result.available || !result.classifications?.length) return null;

    const strongest = [...result.classifications].sort((a, b) => b.score - a.score)[0];
    const mapping = labelMapping[strongest.label];
    if (!mapping || strongest.score < 0.42) return null;

    return {
      type: mapping.type,
      service: mapping.service,
      score: Math.max(1, Math.min(10, Math.round(mapping.baseScore + strongest.score * 2))),
      indicators: [
        `NLP text analysis: ${mapping.type} (${Math.round(strongest.score * 100)}% confidence)`
      ]
    };
  } catch {
    return null;
  }
}
