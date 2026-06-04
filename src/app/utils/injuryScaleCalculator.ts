export type Severity = 'minor' | 'moderate' | 'severe' | 'critical';

interface InjuryCalculationParams {
  severity: Severity;
  description: string;
  hasPhoto?: boolean;
}

/**
 * Calculates injury scale from 0-10 based on multiple factors
 *
 * Factors considered:
 * 1. Base severity level (1-10)
 * 2. Keywords indicating severity in description
 * 3. Presence of photo evidence
 *
 * Returns a score from 0-10 where:
 * 0-2.9: Minor injuries
 * 3-4.9: Moderate injuries
 * 5-7.9: Severe injuries
 * 8-10: Critical/life-threatening
 */
export function calculateInjuryScale(params: InjuryCalculationParams): number {
  const { severity, description, hasPhoto = false } = params;

  // Base score from severity level
  const baseSeverityScores: Record<Severity, number> = {
    minor: 2,
    moderate: 5,
    severe: 7,
    critical: 9
  };

  let score = baseSeverityScores[severity];

  // Critical keywords that increase severity
  const criticalKeywords = [
    'unconscious', 'not breathing', 'cardiac arrest', 'heart attack',
    'severe bleeding', 'gunshot', 'stabbed', 'multiple casualties',
    'head trauma', 'spine injury', 'can\'t move', 'paralyzed',
    'amputation', 'trapped', 'fire', 'explosion', 'chemical'
  ];

  const highSeverityKeywords = [
    'bleeding', 'broken bone', 'fracture', 'dislocated', 'burn',
    'chest pain', 'difficulty breathing', 'fell', 'collision',
    'accident', 'injured', 'pain', 'swollen'
  ];

  const moderateSeverityKeywords = [
    'cut', 'bruise', 'sprain', 'twisted', 'minor', 'small'
  ];

  const descriptionLower = description.toLowerCase();

  // Check for critical keywords (+0.5 to +2.0)
  let criticalCount = 0;
  criticalKeywords.forEach(keyword => {
    if (descriptionLower.includes(keyword)) {
      criticalCount++;
    }
  });
  score += Math.min(criticalCount * 0.8, 2.0);

  // Check for high severity keywords (+0.2 to +1.0)
  let highCount = 0;
  highSeverityKeywords.forEach(keyword => {
    if (descriptionLower.includes(keyword)) {
      highCount++;
    }
  });
  score += Math.min(highCount * 0.3, 1.0);

  // Check for moderate keywords (neutral to slightly lower)
  let moderateCount = 0;
  moderateSeverityKeywords.forEach(keyword => {
    if (descriptionLower.includes(keyword)) {
      moderateCount++;
    }
  });
  if (moderateCount > 0 && criticalCount === 0) {
    score -= 0.5;
  }

  // Multiple people mentioned increases score
  if (descriptionLower.match(/\d+\s*(people|person|victim|injured|casualties)/)) {
    score += 1.0;
  }

  // Photo evidence adds credibility (+0.3)
  if (hasPhoto) {
    score += 0.3;
  }

  // Emergency service mentions
  if (descriptionLower.includes('ambulance') || descriptionLower.includes('paramedic')) {
    score += 0.5;
  }

  // Time-sensitive keywords
  if (descriptionLower.includes('immediate') || descriptionLower.includes('urgent') ||
      descriptionLower.includes('emergency') || descriptionLower.includes('help')) {
    score += 0.3;
  }

  // Ensure score stays within 0-10 range
  score = Math.max(0, Math.min(10, score));

  // Round to 1 decimal place
  return Math.round(score * 10) / 10;
}

/**
 * Get injury classification label from scale
 */
export function getInjuryLabel(scale: number): string {
  if (scale >= 8) return 'CRITICAL';
  if (scale >= 5) return 'SEVERE';
  if (scale >= 3) return 'MODERATE';
  return 'MINOR';
}

/**
 * Get priority level for emergency response
 */
export function getPriorityLevel(scale: number): 1 | 2 | 3 | 4 {
  if (scale >= 8) return 1; // Highest priority
  if (scale >= 5) return 2;
  if (scale >= 3) return 3;
  return 4; // Lowest priority
}

/**
 * Get recommended response units based on injury scale
 */
export function getRecommendedUnits(scale: number, description: string): string[] {
  const units: string[] = [];
  const descriptionLower = description.toLowerCase();

  // Always recommend ambulance for injuries
  if (scale >= 3) {
    units.push('Ambulance');
  }

  // Fire department for specific scenarios
  if (descriptionLower.includes('fire') || descriptionLower.includes('burn') ||
      descriptionLower.includes('trapped') || descriptionLower.includes('explosion')) {
    units.push('Fire Department');
  }

  // Police for accidents, violence, or crowd control
  if (descriptionLower.includes('accident') || descriptionLower.includes('collision') ||
      descriptionLower.includes('gunshot') || descriptionLower.includes('stabbed') ||
      descriptionLower.includes('assault') || descriptionLower.includes('multiple')) {
    units.push('Police');
  }

  // Critical injuries need multiple units
  if (scale >= 8 && units.length < 2) {
    if (!units.includes('Ambulance')) units.push('Ambulance');
    if (!units.includes('Fire Department')) units.push('Fire Department');
  }

  return units.length > 0 ? units : ['Ambulance'];
}
