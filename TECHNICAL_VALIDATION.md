# ResponAI Technical Validation

This document describes prototype controls. It does not claim a production SLA or legal certification.

## Jakarta response-time simulation

The product presents the mentor-provided 24-minute average as a comparison baseline, not as a measured ResponAI result. Each report records the actual browser-side AI duration and estimates the following manual comparison steps:

| Triage step | Simulated manual time | Automated value |
| --- | ---: | ---: |
| Location validation | 60 seconds | 1 second |
| Incident classification | 45 seconds | Measured per report |
| Agency routing | 30 seconds | 1 second |
| Operator dispatch decision | Not claimed | 45-second target |

The UI labels the result as a prototype estimate. A field pilot must replace manual assumptions with observed control-group measurements before any operational claim is made.

## Low-confidence language fallback

Regional slang, mixed signals, or an AI confidence below 68% sets the report to `needs-human-review`. The report remains visible so an emergency is not hidden, but dispatch is blocked in both the service dashboard and incident API until an operator:

1. enters a review reason;
2. confirms or changes the service routing; and
3. creates a timestamped `human_override` audit record with operator identity.

## Automated anonymization

The device scans images for identity-bearing face and license-plate regions. Those identity regions are expanded and irreversibly pixelated on a canvas before remote AI inference or persistence. Graphic-content regions remain available to the triage model and authorized responders, while the UI masks them for ordinary viewers. Live-camera analysis uses the same identity-sanitized frame. For the no-cost prototype, the sanitized image is compressed to a thumbnail below 220 KB and stored inline with the Firestore report; Cloud Storage is not required. A CSS blur is retained as display-layer protection.

Firebase rules require an authenticated user and apply report-owner or service-role access checks. Production deployment still requires a formal privacy impact assessment, retention policy approval, detector recall testing, incident-response procedures, and legal review for every operating country.

## Offline-first reporting

Reports are assigned stable IDs and saved locally before network submission. Statuses are `queued-for-sync`, `syncing`, `online-synced`, or `sync-failed`. Reconnection triggers retry with exponential delay, up to five attempts. Server writes use the report ID as the document ID to avoid duplicate incidents.

Only sanitized evidence is queued. A production mobile release should migrate the queue from browser local storage to encrypted device storage.

## Accountability and retraining

The audit trail records report creation, AI triage, manual review, human override, dispatch, arrival, and closure. Overrides include operator identity and reason. These records are candidates for a ground-truth review set, but they must pass supervisor quality review before model retraining.

## Wet-road reflection versus active fire

The local reliability check does not rely on orange color alone. It measures sharpness, warm-pixel saturation, bright-region density, and whether warm light is concentrated in the lower portion of the frame. A lower-frame, low-support pattern raises reflection risk. When text does not corroborate fire, the visual fire score is suppressed and operator confirmation is required.

This is a conservative still-image heuristic. Production validation should add temporal flame motion, smoke detection, weather context, and optional user audio without making audio mandatory for emergency submission.

## Evidence Verification Score

The score uses capture freshness, GPS availability, GPS accuracy, image resolution, duplicate fingerprint checks, and confirmation that local privacy scanning occurred. Missing metadata receives no points; freshness is never assumed. The score supports prioritization and cannot independently reject an emergency report.

## ASEAN interoperability

Emergency numbers and routing are country configuration, separate from the triage engine. Legal retention periods, consent wording, agency interfaces, and escalation policy must also remain country-specific configuration and be approved before each launch.
