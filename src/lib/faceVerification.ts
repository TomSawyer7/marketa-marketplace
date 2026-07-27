import * as faceapi from '@vladmandic/face-api';
import type { FaceMatchStatus } from '../types/marketplace';

let modelsLoaded = false;
let modelsLoadingPromise: Promise<boolean> | null = null;

export async function loadFaceApiModels(): Promise<boolean> {
  if (modelsLoaded) return true;
  if (modelsLoadingPromise) return modelsLoadingPromise;

  modelsLoadingPromise = (async () => {
    try {
      const MODEL_URL = '/models';
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      ]);
      modelsLoaded = true;
      return true;
    } catch (err) {
      console.warn('Face-api models could not be loaded:', err);
      modelsLoaded = false;
      return false;
    }
  })();

  return modelsLoadingPromise;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image failed to load'));
    img.src = src;
  });
}

export async function extractFaceDescriptor(imageSource: string | HTMLImageElement | HTMLCanvasElement): Promise<Float32Array | null> {
  try {
    const loaded = await loadFaceApiModels();
    if (!loaded) return null;

    let inputElement: HTMLImageElement | HTMLCanvasElement;
    if (typeof imageSource === 'string') {
      try {
        inputElement = await loadImageElement(imageSource);
      } catch (imgErr) {
        console.warn('Failed to load image for face detection:', imgErr);
        return null;
      }
    } else {
      inputElement = imageSource;
    }

    const detection = await faceapi
      .detectSingleFace(inputElement)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) return null;
    return detection.descriptor;
  } catch (err) {
    console.error('Error extracting face descriptor:', err);
    return null;
  }
}

export interface MatchResult {
  distance: number;
  status: FaceMatchStatus;
  isMock?: boolean;
}

export function evaluateDistance(distance: number): FaceMatchStatus {
  if (distance < 0.6) return 'passed';
  if (distance <= 0.75) return 'needs_review';
  return 'failed';
}

export function computeDescriptorDistance(descriptorA: Float32Array, descriptorB: Float32Array): number {
  return faceapi.euclideanDistance(descriptorA, descriptorB);
}

export async function compareFaces(idImageUrl: string, selfieImageUrl: string): Promise<MatchResult> {
  try {
    const loaded = await loadFaceApiModels();

    if (loaded) {
      const idDesc = await extractFaceDescriptor(idImageUrl);
      const selfieDesc = await extractFaceDescriptor(selfieImageUrl);

      if (idDesc && selfieDesc) {
        const distance = Math.round(computeDescriptorDistance(idDesc, selfieDesc) * 1000) / 1000;
        const status = evaluateDistance(distance);
        return { distance, status, isMock: false };
      }
    }
  } catch (err) {
    console.warn('Face recognition engine error:', err);
  }

  return { distance: 1.0, status: 'failed', isMock: false };
}
