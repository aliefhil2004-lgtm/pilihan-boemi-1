/**
 * Severity Scale Analyzer for Emergency Photos
 *
 * This module provides functionality to analyze emergency photos and determine
 * severity levels. Currently uses rule-based analysis, designed to be replaced
 * with AI/ML model in the future.
 *
 * Severity Scale: 1-10
 * - 1-3: Low severity (minor injuries, small incidents)
 * - 4-6: Medium severity (moderate injuries, significant incidents)
 * - 7-10: Critical severity (life-threatening, major disasters)
 */

export interface SeverityAnalysisResult {
  severityScore: number;
  severityLevel: 'Low' | 'Medium' | 'Critical';
  confidence: number;
  detectedIndicators: string[];
  recommendedService: 'ambulance' | 'fire' | 'police';
  priority: 'Critical' | 'Medium' | 'Low';
  estimatedResponseTime: number; // in minutes
}

export interface PhotoAnalysisInput {
  photoDataUrl?: string;
  description: string;
  location: string;
  timestamp?: Date;
}

/**
 * Analyzes emergency photo and description to determine severity
 *
 * @param input - Photo and contextual information
 * @returns Severity analysis result with score, level, and recommendations
 */
export function analyzeSeverity(input: PhotoAnalysisInput): SeverityAnalysisResult {
  const indicators: string[] = [];
  let severityScore = 5; // Default medium severity
  let recommendedService: 'ambulance' | 'fire' | 'police' = 'ambulance';

  const descLower = input.description.toLowerCase();

  // Medical/Injury Keywords (Ambulance)
  const medicalCritical = ['unconscious', 'bleeding', 'cardiac', 'heart attack', 'stroke', 'severe pain', 'chest pain', 'difficulty breathing', 'unresponsive'];
  const medicalMedium = ['injury', 'broken', 'fracture', 'burn', 'cut', 'wound', 'pain', 'sick', 'fever'];
  const medicalLow = ['minor', 'scratch', 'bruise', 'headache', 'nausea'];

  // Fire Keywords
  const fireCritical = ['fire', 'explosion', 'smoke', 'burning building', 'flames', 'gas leak'];
  const fireMedium = ['smoke alarm', 'small fire', 'burning'];

  // Police Keywords
  const policeCritical = ['shooting', 'armed', 'assault', 'robbery', 'violence', 'weapon', 'hostage'];
  const policeMedium = ['theft', 'accident', 'fight', 'dispute', 'vandalism'];

  // Analyze for critical medical conditions
  if (medicalCritical.some(keyword => descLower.includes(keyword))) {
    severityScore = Math.max(severityScore, 8);
    indicators.push('Critical medical condition detected');
    recommendedService = 'ambulance';
  }

  // Analyze for fire emergencies
  if (fireCritical.some(keyword => descLower.includes(keyword))) {
    severityScore = Math.max(severityScore, 9);
    indicators.push('Fire emergency detected');
    recommendedService = 'fire';
  }

  // Analyze for police emergencies
  if (policeCritical.some(keyword => descLower.includes(keyword))) {
    severityScore = Math.max(severityScore, 8);
    indicators.push('Security threat detected');
    recommendedService = 'police';
  }

  // Medium severity conditions
  if (medicalMedium.some(keyword => descLower.includes(keyword))) {
    severityScore = Math.max(severityScore, 5);
    indicators.push('Moderate medical condition');
    recommendedService = 'ambulance';
  }

  if (fireMedium.some(keyword => descLower.includes(keyword))) {
    severityScore = Math.max(severityScore, 6);
    indicators.push('Fire risk detected');
    recommendedService = 'fire';
  }

  if (policeMedium.some(keyword => descLower.includes(keyword))) {
    severityScore = Math.max(severityScore, 5);
    indicators.push('Police assistance needed');
    recommendedService = 'police';
  }

  // Low severity conditions
  if (medicalLow.some(keyword => descLower.includes(keyword))) {
    severityScore = Math.min(severityScore, 3);
    indicators.push('Minor medical issue');
  }

  // Photo analysis (placeholder for future AI implementation)
  if (input.photoDataUrl) {
    indicators.push('Photo provided for analysis');
    // Future: Use computer vision AI to analyze photo
    // - Detect visible injuries, blood, fire, smoke
    // - Assess damage extent
    // - Identify number of people affected
    // This will increase accuracy significantly
    severityScore += 1; // Bonus for having photo evidence
  }

  // Multiple people mentioned increases severity
  if (descLower.match(/\d+\s*(people|persons|victims|injured)/)) {
    severityScore += 2;
    indicators.push('Multiple people involved');
  }

  // Clamp severity score between 1-10
  severityScore = Math.max(1, Math.min(10, severityScore));

  // Determine severity level
  let severityLevel: 'Low' | 'Medium' | 'Critical';
  if (severityScore >= 7) {
    severityLevel = 'Critical';
  } else if (severityScore >= 4) {
    severityLevel = 'Medium';
  } else {
    severityLevel = 'Low';
  }

  // Determine priority
  const priority: 'Critical' | 'Medium' | 'Low' = severityLevel;

  // Calculate estimated response time based on severity
  const estimatedResponseTime =
    severityLevel === 'Critical' ? 5 :
    severityLevel === 'Medium' ? 10 :
    15;

  // Confidence level (higher with photo)
  const confidence = input.photoDataUrl ? 0.85 : 0.65;

  return {
    severityScore,
    severityLevel,
    confidence,
    detectedIndicators: indicators,
    recommendedService,
    priority,
    estimatedResponseTime
  };
}

/**
 * Future AI Integration Points:
 *
 * 1. Computer Vision for Photo Analysis:
 *    - Blood detection and quantification
 *    - Fire/smoke detection and spread assessment
 *    - Injury type classification (burns, fractures, wounds)
 *    - Vehicle damage assessment
 *    - Number of people affected
 *
 * 2. Natural Language Processing for Description:
 *    - Emotion/urgency detection in text
 *    - Context extraction
 *    - Temporal information (how long ago)
 *
 * 3. Multi-modal AI:
 *    - Combine photo and text analysis
 *    - Cross-validate findings
 *    - Generate detailed incident report
 *
 * 4. Historical Data Learning:
 *    - Learn from past emergencies
 *    - Improve accuracy over time
 *    - Regional pattern recognition
 */

/**
 * Get human-readable severity description
 */
export function getSeverityDescription(score: number): string {
  if (score >= 9) return 'Life-threatening emergency requiring immediate response';
  if (score >= 7) return 'Critical situation requiring urgent attention';
  if (score >= 5) return 'Moderate emergency requiring prompt response';
  if (score >= 3) return 'Minor incident requiring standard response';
  return 'Low priority situation';
}

/**
 * Get recommended actions based on severity
 */
export function getRecommendedActions(result: SeverityAnalysisResult): string[] {
  const actions: string[] = [];

  if (result.severityLevel === 'Critical') {
    actions.push('Dispatch immediately');
    actions.push('Alert nearest available units');
    actions.push('Notify hospital/station in advance');
    actions.push('Request backup if needed');
  } else if (result.severityLevel === 'Medium') {
    actions.push('Dispatch within 10 minutes');
    actions.push('Assign appropriate units');
    actions.push('Prepare necessary equipment');
  } else {
    actions.push('Schedule response');
    actions.push('Route to nearest available unit');
  }

  return actions;
}
