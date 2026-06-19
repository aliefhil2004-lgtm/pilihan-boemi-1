import type { PrivacyRegion } from '../types/emergency';

interface PixelPoint {
  x: number;
  y: number;
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
  count: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to load image for privacy detection'));
    image.src = src;
  });
}

function toRegion(
  label: string,
  box: Box,
  width: number,
  height: number,
  confidence: number
): PrivacyRegion {
  const padX = Math.max(2, Math.round((box.right - box.left) * 0.18));
  const padY = Math.max(2, Math.round((box.bottom - box.top) * 0.18));
  const left = Math.max(0, box.left - padX);
  const top = Math.max(0, box.top - padY);
  const right = Math.min(width, box.right + padX);
  const bottom = Math.min(height, box.bottom + padY);

  return {
    label,
    left: (left / width) * 100,
    top: (top / height) * 100,
    width: Math.max(5, ((right - left) / width) * 100),
    height: Math.max(5, ((bottom - top) / height) * 100),
    confidence,
    normalized: true
  };
}

function extractComponents(
  mask: Uint8Array,
  width: number,
  height: number,
  minPixels: number
): Box[] {
  const visited = new Uint8Array(mask.length);
  const boxes: Box[] = [];

  for (let index = 0; index < mask.length; index += 1) {
    if (!mask[index] || visited[index]) continue;

    const queue: PixelPoint[] = [{ x: index % width, y: Math.floor(index / width) }];
    visited[index] = 1;
    const box: Box = { left: width, top: height, right: 0, bottom: 0, count: 0 };

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const point = queue[cursor];
      box.left = Math.min(box.left, point.x);
      box.top = Math.min(box.top, point.y);
      box.right = Math.max(box.right, point.x + 1);
      box.bottom = Math.max(box.bottom, point.y + 1);
      box.count += 1;

      const neighbors = [
        { x: point.x + 1, y: point.y },
        { x: point.x - 1, y: point.y },
        { x: point.x, y: point.y + 1 },
        { x: point.x, y: point.y - 1 }
      ];

      neighbors.forEach(neighbor => {
        if (neighbor.x < 0 || neighbor.y < 0 || neighbor.x >= width || neighbor.y >= height) return;
        const neighborIndex = neighbor.y * width + neighbor.x;
        if (!mask[neighborIndex] || visited[neighborIndex]) return;
        visited[neighborIndex] = 1;
        queue.push(neighbor);
      });
    }

    if (box.count >= minPixels) boxes.push(box);
  }

  return boxes;
}

function detectBloodRegions(data: Uint8ClampedArray, width: number, height: number): PrivacyRegion[] {
  const mask = new Uint8Array(width * height);

  for (let i = 0; i < width * height; i += 1) {
    const offset = i * 4;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;
    const redDominant = r > 68 && r > g * 1.25 && r > b * 1.18 && saturation > 0.22;
    const darkBlood = r > 42 && r < 145 && g < 70 && b < 70 && r > g * 1.15;
    if (redDominant || darkBlood) mask[i] = 1;
  }

  return extractComponents(mask, width, height, Math.max(12, Math.round(width * height * 0.0016)))
    .filter(box => {
      const boxWidth = box.right - box.left;
      const boxHeight = box.bottom - box.top;
      return boxWidth >= 4 && boxHeight >= 4 && boxWidth * boxHeight < width * height * 0.42;
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map(box => toRegion(box.count > width * height * 0.018 ? 'graphic content' : 'blood', box, width, height, 0.62));
}

function detectLicensePlateRegions(data: Uint8ClampedArray, width: number, height: number): PrivacyRegion[] {
  const mask = new Uint8Array(width * height);

  for (let i = 0; i < width * height; i += 1) {
    const offset = i * 4;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const brightness = (r + g + b) / 3;
    const contrast = Math.max(r, g, b) - Math.min(r, g, b);
    if (brightness > 160 && contrast < 58) mask[i] = 1;
  }

  return extractComponents(mask, width, height, Math.max(14, Math.round(width * height * 0.0012)))
    .filter(box => {
      const boxWidth = box.right - box.left;
      const boxHeight = box.bottom - box.top;
      const aspect = boxWidth / Math.max(1, boxHeight);
      const area = boxWidth * boxHeight;
      return aspect >= 2.1 && aspect <= 6.8 && area < width * height * 0.12 && boxHeight <= height * 0.2;
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 2)
    .map(box => toRegion('license plate', box, width, height, 0.48));
}

async function detectFaceRegions(image: HTMLImageElement): Promise<PrivacyRegion[]> {
  const detectorConstructor = (globalThis as {
    FaceDetector?: new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => {
      detect: (source: CanvasImageSource) => Promise<Array<{ boundingBox: DOMRectReadOnly }>>;
    };
  }).FaceDetector;

  if (!detectorConstructor) return [];

  try {
    const detector = new detectorConstructor({ fastMode: true, maxDetectedFaces: 12 });
    const faces = await detector.detect(image);
    return faces.map(face => ({
      label: 'face',
      left: (face.boundingBox.x / image.naturalWidth) * 100,
      top: (face.boundingBox.y / image.naturalHeight) * 100,
      width: Math.max(6, (face.boundingBox.width / image.naturalWidth) * 100),
      height: Math.max(6, (face.boundingBox.height / image.naturalHeight) * 100),
      confidence: 0.75,
      normalized: true
    }));
  } catch {
    return [];
  }
}

function dedupeRegions(regions: PrivacyRegion[]) {
  return regions.filter((region, index) => {
    const centerX = region.left + region.width / 2;
    const centerY = region.top + region.height / 2;
    return !regions.slice(0, index).some(previous => {
      const previousCenterX = previous.left + previous.width / 2;
      const previousCenterY = previous.top + previous.height / 2;
      return (
        previous.label === region.label &&
        Math.abs(previousCenterX - centerX) < 6 &&
        Math.abs(previousCenterY - centerY) < 6
      );
    });
  });
}

export async function detectPrivacyRegionsFromPhoto(photo: string): Promise<PrivacyRegion[]> {
  if (typeof document === 'undefined') return [];

  try {
    const image = await loadImage(photo);
    const maxDimension = 220;
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return [];
    context.drawImage(image, 0, 0, width, height);
    const imageData = context.getImageData(0, 0, width, height);

    const regions = [
      ...await detectFaceRegions(image),
      ...detectBloodRegions(imageData.data, width, height),
      ...detectLicensePlateRegions(imageData.data, width, height)
    ];

    return dedupeRegions(regions);
  } catch {
    return [];
  }
}

function getPixelRegion(region: PrivacyRegion, width: number, height: number) {
  const normalized = region.normalized || (
    region.left <= 100 && region.top <= 100 && region.width <= 100 && region.height <= 100
  );
  const left = normalized ? region.left / 100 * width : region.left;
  const top = normalized ? region.top / 100 * height : region.top;
  const regionWidth = normalized ? region.width / 100 * width : region.width;
  const regionHeight = normalized ? region.height / 100 * height : region.height;

  return {
    left: Math.max(0, Math.floor(left)),
    top: Math.max(0, Math.floor(top)),
    width: Math.max(1, Math.min(width - left, Math.ceil(regionWidth))),
    height: Math.max(1, Math.min(height - top, Math.ceil(regionHeight)))
  };
}

export async function anonymizePhotoPixels(
  photo: string,
  regions: PrivacyRegion[]
): Promise<string> {
  if (!regions.length || typeof document === 'undefined') return photo;

  const image = await loadImage(photo);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) return photo;
  context.drawImage(image, 0, 0);

  for (const region of regions) {
    const box = getPixelRegion(region, canvas.width, canvas.height);
    const sampleWidth = Math.max(1, Math.min(12, Math.round(box.width / 10)));
    const sampleHeight = Math.max(1, Math.min(12, Math.round(box.height / 10)));
    const sample = document.createElement('canvas');
    sample.width = sampleWidth;
    sample.height = sampleHeight;
    const sampleContext = sample.getContext('2d');
    if (!sampleContext) continue;
    sampleContext.drawImage(
      canvas,
      box.left,
      box.top,
      box.width,
      box.height,
      0,
      0,
      sampleWidth,
      sampleHeight
    );
    context.save();
    context.imageSmoothingEnabled = false;
    context.drawImage(sample, 0, 0, sampleWidth, sampleHeight, box.left, box.top, box.width, box.height);
    context.restore();
  }

  return canvas.toDataURL('image/jpeg', 0.82);
}
