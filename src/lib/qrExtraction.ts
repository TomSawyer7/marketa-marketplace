import jsQR, { type QRCode } from 'jsqr';

export interface QrExtractionResult {
  payload: string | null;
  extractedAt: string | null;
  qrImageDataUrl?: string | null;
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for QR decoding'));
    img.src = dataUrl;
  });
}

function getImageData(img: HTMLImageElement): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, img.width, img.height);
}

function extractQrRegion(
  img: HTMLImageElement,
  location: QRCode['location']
): string {
  const corners = [
    location.topLeftCorner,
    location.topRightCorner,
    location.bottomRightCorner,
    location.bottomLeftCorner
  ];
  const minX = Math.max(0, Math.min(...corners.map(p => p.x)) - 10);
  const minY = Math.max(0, Math.min(...corners.map(p => p.y)) - 10);
  const maxX = Math.min(img.width, Math.max(...corners.map(p => p.x)) + 10);
  const maxY = Math.min(img.height, Math.max(...corners.map(p => p.y)) + 10);
  const cropW = maxX - minX;
  const cropH = maxY - minY;

  const canvas = document.createElement('canvas');
  canvas.width = cropW;
  canvas.height = cropH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(img, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
  return canvas.toDataURL('image/jpeg', 0.85);
}

export async function extractQrFromImage(imageDataUrl: string): Promise<QrExtractionResult> {
  try {
    const img = await loadImage(imageDataUrl);
    const imageData = getImageData(img);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (code && code.data) {
      const qrImageDataUrl = extractQrRegion(img, code.location);
      return {
        payload: code.data,
        extractedAt: new Date().toISOString(),
        qrImageDataUrl
      };
    }
    return { payload: null, extractedAt: null };
  } catch (err) {
    console.warn('QR extraction error:', err);
    return { payload: null, extractedAt: null };
  }
}
