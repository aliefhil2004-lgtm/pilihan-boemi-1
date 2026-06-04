export interface YoloDetection {
  class: string;
  confidence: number;
}

export async function analyzeEmergencyWithYolo(
  imageBase64: string
): Promise<YoloDetection[]> {
  try {
    const response = await fetch('/api/yolo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageBase64 })
    });

    if (!response.ok) return [];
    const result = await response.json() as { detections?: YoloDetection[] };
    return result.detections ?? [];
  } catch {
    // YOLO is optional until a local or hosted inference server is attached.
    return [];
  }
}
