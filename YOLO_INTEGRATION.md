# YOLO Integration

The frontend sends uploaded images to:

```text
POST /api/yolo
```

Expected response:

```json
{
  "detections": [
    { "class": "fire", "confidence": 0.92 },
    { "class": "smoke", "confidence": 0.81 }
  ]
}
```

The Vite development server currently exposes a placeholder response so the
application remains functional before a YOLO inference server is connected.
Replace the `/api/yolo` placeholder middleware in `vite.config.ts` with a proxy
to an Ultralytics YOLO API when the trained model and hosting URL are ready.

Recommended initial classes:

```text
fire, smoke, person, injured_person, vehicle_crash, weapon, firearm, handgun,
rifle, knife, person_with_weapon, flood
```

For CCTV footage, train with blurry, low-light, distant, and partially occluded
examples. A generic pretrained YOLO model usually detects `person`, but it will
not reliably classify small firearms without a custom emergency dataset.
