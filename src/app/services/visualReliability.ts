export interface VisualReliabilityAssessment {
  blurRisk: number;
  reflectionRisk: number;
  fireVisualSupport: number;
  indicators: string[];
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to inspect visual evidence'));
    image.src = src;
  });
}

export async function assessVisualReliability(photo: string): Promise<VisualReliabilityAssessment> {
  const neutral: VisualReliabilityAssessment = {
    blurRisk: 0,
    reflectionRisk: 0,
    fireVisualSupport: 0,
    indicators: []
  };
  if (typeof document === 'undefined') return neutral;

  try {
    const image = await loadImage(photo);
    const maxDimension = 240;
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return neutral;
    context.drawImage(image, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;

    let warmPixels = 0;
    let brightWarmPixels = 0;
    let lowerWarmPixels = 0;
    let edgeEnergy = 0;
    let edgeSamples = 0;
    const luminance = new Float32Array(width * height);

    for (let index = 0; index < width * height; index += 1) {
      const offset = index * 4;
      const r = pixels[offset];
      const g = pixels[offset + 1];
      const b = pixels[offset + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const saturation = max === 0 ? 0 : (max - min) / max;
      const warm = r > 110 && r > g * 1.12 && g > b * 1.05 && saturation > 0.22;
      const brightWarm = warm && (r + g + b) / 3 > 145;
      luminance[index] = r * 0.299 + g * 0.587 + b * 0.114;
      if (warm) {
        warmPixels += 1;
        if (Math.floor(index / width) >= height * 0.55) lowerWarmPixels += 1;
      }
      if (brightWarm) brightWarmPixels += 1;
    }

    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const index = y * width + x;
        const gradient = Math.abs(luminance[index + 1] - luminance[index - 1]) +
          Math.abs(luminance[index + width] - luminance[index - width]);
        edgeEnergy += gradient;
        edgeSamples += 1;
      }
    }

    const total = Math.max(1, width * height);
    const warmRatio = warmPixels / total;
    const brightWarmRatio = brightWarmPixels / total;
    const lowerWarmShare = warmPixels ? lowerWarmPixels / warmPixels : 0;
    const averageEdge = edgeEnergy / Math.max(1, edgeSamples);
    const blurRisk = Math.max(0, Math.min(1, (13 - averageEdge) / 9));
    const reflectionRisk = Math.max(0, Math.min(1,
      lowerWarmShare * 0.7 + (warmRatio < 0.07 ? 0.2 : 0) + (brightWarmRatio < 0.025 ? 0.1 : 0)
    ));
    const fireVisualSupport = Math.max(0, Math.min(1,
      warmRatio * 7 + brightWarmRatio * 5 + (1 - lowerWarmShare) * 0.25
    ));
    const indicators: string[] = [];
    if (blurRisk >= 0.6) indicators.push('Image sharpness is low; operator visual confirmation required');
    if (reflectionRisk >= 0.68 && fireVisualSupport < 0.58) {
      indicators.push('Warm light is concentrated near the lower frame and may be a wet-road reflection');
    }
    if (fireVisualSupport >= 0.65) indicators.push('Warm saturated regions provide visual support for active fire');

    return { blurRisk, reflectionRisk, fireVisualSupport, indicators };
  } catch {
    return neutral;
  }
}
