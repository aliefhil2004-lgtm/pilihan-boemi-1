# Emergency Severity Scale Specification

## Overview

This document outlines the severity assessment system used in the EmergencyConnect Indonesia application. The system analyzes emergency reports (photos + descriptions) to determine severity levels and dispatch priority.

## Severity Scale (1-10)

The severity scale ranges from 1 (minimal emergency) to 10 (life-threatening critical emergency).

### Scale Breakdown

| Score | Level    | Response Time | Description                                    |
|-------|----------|---------------|------------------------------------------------|
| 1-3   | Low      | 15 minutes    | Minor incidents, non-urgent situations         |
| 4-6   | Medium   | 10 minutes    | Moderate emergencies requiring prompt response |
| 7-10  | Critical | 5 minutes     | Life-threatening situations, immediate action  |

## Severity Determination Factors

### 1. Photo Analysis (Future AI Implementation)

**Medical Emergencies:**
- Blood presence and volume (scale: minor spotting → severe hemorrhage)
- Visible injuries (scale: bruises → deep wounds → compound fractures)
- Patient consciousness level (responsive → semi-conscious → unresponsive)
- Burn severity (redness → blisters → charring)
- Number of affected individuals

**Fire Emergencies:**
- Flame height and spread
- Smoke density and color (white steam → gray → black toxic smoke)
- Structure involvement (isolated → partial → full engulfment)
- Proximity to populated areas
- Wind conditions and fire spread potential

**Police/Security:**
- Weapon presence
- Number of individuals involved
- Property damage extent
- Crowd size and behavior
- Evidence of violence

### 2. Description Text Analysis

**Keywords & Severity Mapping:**

**Critical (7-10):**
- Medical: "unconscious", "not breathing", "cardiac arrest", "severe bleeding", "chest pain", "stroke"
- Fire: "building on fire", "explosion", "gas leak", "people trapped"
- Police: "shooting", "armed", "hostage", "assault with weapon"

**Medium (4-6):**
- Medical: "broken bone", "difficulty breathing", "severe pain", "high fever"
- Fire: "small fire", "smoke alarm", "electrical fire"
- Police: "robbery", "car accident", "domestic dispute", "vandalism"

**Low (1-3):**
- Medical: "minor cut", "sprain", "bruise", "headache", "nausea"
- Fire: "smoke smell", "false alarm"
- Police: "suspicious person", "noise complaint", "lost item"

### 3. Location Context

- Urban vs rural (affects response time calculations)
- Proximity to emergency services
- Known high-risk areas
- Historical incident data for the location

### 4. Time Factors

- Time of day (affects traffic, availability)
- Day of week
- Weather conditions
- Current emergency load in the area

## Service Type Determination

The system automatically recommends the appropriate emergency service:

### Ambulance/Medical
- Injuries, illness, medical emergencies
- Traffic accidents with injuries
- Chemical exposure

### Fire Department
- Fire incidents
- Gas leaks
- Building collapses
- Vehicle extrication
- Hazmat situations

### Police
- Crime in progress
- Security threats
- Traffic accidents (non-injury)
- Public disturbances

## AI Integration Roadmap

### Phase 1: Computer Vision (Photo Analysis)

**Technologies:**
- TensorFlow.js or ONNX Runtime for edge inference
- Pre-trained models: ResNet, EfficientNet for classification
- Object detection: YOLO or SSD for identifying fire, blood, weapons
- Segmentation models for injury assessment

**Training Data Requirements:**
- Medical: 10,000+ labeled injury photos (burns, cuts, fractures)
- Fire: 5,000+ fire incident photos at various stages
- Police: Situational awareness dataset (crowds, weapons, damage)

**Model Outputs:**
```typescript
interface PhotoAnalysisResult {
  detectedObjects: Array<{
    label: string;
    confidence: number;
    bbox: [x, y, width, height];
  }>;
  severityIndicators: {
    bloodPresent: boolean;
    bloodVolume: 'minor' | 'moderate' | 'severe';
    firePresent: boolean;
    fireIntensity: number; // 0-1
    weaponDetected: boolean;
    personCount: number;
    consciousnessLevel: 'alert' | 'drowsy' | 'unresponsive' | 'unknown';
  };
  sceneSeverity: number; // 0-1
}
```

### Phase 2: Natural Language Processing (Description Analysis)

**Technologies:**
- Transformer models (BERT, DistilBERT)
- Named Entity Recognition for medical terms, locations
- Sentiment/urgency analysis

**Model Outputs:**
```typescript
interface TextAnalysisResult {
  urgencyScore: number; // 0-1
  detectedConditions: string[];
  emotionalState: 'calm' | 'distressed' | 'panic';
  timeReferences: {
    whenOccurred: string;
    durationEstimate: string;
  };
  entities: {
    medicalConditions: string[];
    locations: string[];
    peopleInvolved: number;
  };
}
```

### Phase 3: Multi-Modal Fusion

Combine photo + text analysis for comprehensive severity assessment:

```typescript
interface FusedAnalysisResult {
  finalSeverityScore: number; // 1-10
  confidence: number; // 0-1
  photoWeight: number; // How much photo influenced score
  textWeight: number; // How much text influenced score
  discrepancyWarning?: string; // If photo and text conflict
  recommendedService: 'ambulance' | 'fire' | 'police';
  priority: 'Critical' | 'Medium' | 'Low';
  estimatedResponseTime: number; // minutes
  suggestedActions: string[];
}
```

### Phase 4: Continuous Learning

- Collect feedback from dispatchers on accuracy
- Track actual vs predicted severity
- Retrain models monthly with new data
- A/B testing for model improvements

## Implementation Guidelines

### Current Rule-Based System

Location: `src/app/utils/severityScaleAnalyzer.ts`

The current implementation uses keyword matching and heuristics. This provides a baseline that can be replaced module-by-module with AI.

### Future AI Implementation

1. **Edge-First Approach**: Run models in browser using TensorFlow.js for privacy and speed
2. **Fallback to Rule-Based**: If AI confidence < 70%, use rule-based system
3. **Hybrid Scoring**: Combine AI predictions with rule-based scores
4. **Explainability**: Always show why a certain severity was assigned
5. **Privacy**: Process photos locally, only send metadata to server

## Example Scenarios

### Scenario 1: Traffic Accident
**Input:**
- Photo: Shows damaged vehicle, person holding head
- Description: "Car accident, hit my head, feeling dizzy"

**Expected Output:**
- Severity: 6 (Medium-High)
- Service: Ambulance
- Reasoning: Head injury + dizziness = potential concussion
- Response Time: 8 minutes

### Scenario 2: House Fire
**Input:**
- Photo: Shows flames in window, smoke
- Description: "My house is on fire! Flames in kitchen spreading fast!"

**Expected Output:**
- Severity: 9 (Critical)
- Service: Fire Department
- Reasoning: Active flames + structural fire + rapid spread
- Response Time: 5 minutes
- Additional: Notify ambulance standby

### Scenario 3: Minor Injury
**Input:**
- Photo: Shows small cut on finger
- Description: "Cut my finger cooking, bleeding a little"

**Expected Output:**
- Severity: 2 (Low)
- Service: Ambulance (or redirect to urgent care)
- Reasoning: Minor laceration, controlled bleeding
- Response Time: 15 minutes or self-transport

## Validation Metrics

Track these KPIs to measure system accuracy:

1. **Precision**: Of emergencies marked Critical, what % were actually critical?
2. **Recall**: Of actual critical emergencies, what % were correctly identified?
3. **Response Time Impact**: Did severity scoring improve response times?
4. **Dispatcher Override Rate**: How often do dispatchers change the severity?
5. **User Satisfaction**: Post-incident surveys

## Ethical Considerations

1. **Bias Detection**: Ensure model doesn't discriminate based on demographics
2. **Privacy**: Photo analysis happens locally, photos encrypted in transit
3. **Transparency**: Users told their emergency is being analyzed by AI
4. **Human Override**: Dispatchers can always override AI decisions
5. **Liability**: Clear documentation of AI assistance, not replacement of human judgment

## API Integration Points

For future AI service:

```typescript
// POST /api/analyze-emergency
interface AnalyzeRequest {
  photo?: string; // base64
  description: string;
  location: { lat: number; lng: number };
  timestamp: Date;
}

interface AnalyzeResponse {
  severityScore: number;
  severityLevel: 'Low' | 'Medium' | 'Critical';
  confidence: number;
  recommendedService: 'ambulance' | 'fire' | 'police';
  estimatedResponseTime: number;
  reasoning: string[];
  modelVersion: string;
}
```

## References

- Emergency Severity Index (ESI): https://www.ahrq.gov/
- Triage Systems: https://www.ncbi.nlm.nih.gov/books/NBK557583/
- Computer Vision in Emergency Medicine: Research papers on medical image analysis
- NASA FIRMS Fire Detection: https://firms.modaps.eosdis.nasa.gov/

---

**Document Version**: 1.0  
**Last Updated**: 2026-05-04  
**Maintained By**: EmergencyConnect Development Team
