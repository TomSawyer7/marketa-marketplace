import * as faceapi from '@vladmandic/face-api';
import { loadFaceApiModels } from './faceVerification';

export type LivenessChallenge = 'blink' | 'turn_left' | 'turn_right';

export interface LivenessResult {
  passed: boolean;
  challengeType: LivenessChallenge;
  attempts: number;
}

const BASELINE_FRAMES = 30;
const BLINK_THRESHOLD_RATIO = 0.65;
const BLINK_MIN_FRAMES = 3;
const REQUIRED_BLINKS = 2;
const HEAD_TURN_THRESHOLD = 0.12;
const REQUIRED_TURN_FRAMES = 10;
const MAX_ATTEMPTS = 5;
const DETECTION_TIMEOUT_MS = 30000;

const CHALLENGES: LivenessChallenge[] = ['blink', 'turn_left', 'turn_right'];

export function pickRandomChallenge(): LivenessChallenge {
  return CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
}

export function getChallengeInstruction(challenge: LivenessChallenge): string {
  switch (challenge) {
    case 'blink':
      return 'Blink your eyes twice naturally';
    case 'turn_left':
      return 'Slowly turn your head to the left';
    case 'turn_right':
      return 'Slowly turn your head to the right';
  }
}

function euclidean(a: faceapi.Point, b: faceapi.Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function computeEAR(landmarks: faceapi.FaceLandmarks68): number {
  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();

  const leftEAR =
    (euclidean(leftEye[1], leftEye[5]) + euclidean(leftEye[2], leftEye[4])) /
    (2 * euclidean(leftEye[0], leftEye[3]));

  const rightEAR =
    (euclidean(rightEye[1], rightEye[5]) + euclidean(rightEye[2], rightEye[4])) /
    (2 * euclidean(rightEye[0], rightEye[3]));

  return (leftEAR + rightEAR) / 2;
}

function detectHeadTurn(
  landmarks: faceapi.FaceLandmarks68,
  box: faceapi.Box
): 'left' | 'right' | 'center' {
  const noseTip = landmarks.getNose()[2];
  const faceCenterX = box.x + box.width / 2;
  const displacement = (noseTip.x - faceCenterX) / box.width;

  if (displacement > HEAD_TURN_THRESHOLD) return 'right';
  if (displacement < -HEAD_TURN_THRESHOLD) return 'left';
  return 'center';
}

export async function runLivenessCheck(
  video: HTMLVideoElement,
  challenge: LivenessChallenge,
  signal: AbortSignal,
  onProgress?: (message: string) => void
): Promise<boolean> {
  const modelsLoaded = await loadFaceApiModels();
  if (!modelsLoaded) return false;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  const earValues: number[] = [];
  let baselineDone = false;
  let avgBaselineEAR = 0;

  let blinkState: 'open' | 'closing' | 'closed' = 'open';
  let blinkCloseFrames = 0;
  let blinksCompleted = 0;

  const requiredDir = challenge === 'turn_left' ? 'left' : challenge === 'turn_right' ? 'right' : null;
  let turnFrames = 0;

  const startTime = Date.now();

  return new Promise((resolve) => {
    let animationId: number;

    const frame = async () => {
      if (signal.aborted || Date.now() - startTime > DETECTION_TIMEOUT_MS) {
        cancelAnimationFrame(animationId);
        resolve(false);
        return;
      }

      if (video.readyState < 2) {
        animationId = requestAnimationFrame(frame);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      try {
        const result = await faceapi.detectSingleFace(canvas).withFaceLandmarks();
        if (!result) {
          animationId = requestAnimationFrame(frame);
          return;
        }

        const ear = computeEAR(result.landmarks);
        earValues.push(ear);

        if (!baselineDone) {
          if (earValues.length >= BASELINE_FRAMES) {
            avgBaselineEAR = earValues.reduce((a, b) => a + b, 0) / earValues.length;
            baselineDone = true;
            onProgress?.(getChallengeInstruction(challenge));
          } else {
            onProgress?.(`Preparing... ${earValues.length}/${BASELINE_FRAMES}`);
          }
          animationId = requestAnimationFrame(frame);
          return;
        }

        if (challenge === 'blink') {
          const ratio = ear / avgBaselineEAR;

          if (ratio < BLINK_THRESHOLD_RATIO) {
            if (blinkState === 'open') {
              blinkState = 'closing';
              blinkCloseFrames = 1;
            } else if (blinkState === 'closing') {
              blinkCloseFrames++;
              if (blinkCloseFrames >= BLINK_MIN_FRAMES) {
                blinkState = 'closed';
              }
            }
          } else {
            if (blinkState === 'closed') {
              blinksCompleted++;
              onProgress?.(`Blink ${blinksCompleted}/${REQUIRED_BLINKS}`);
              if (blinksCompleted >= REQUIRED_BLINKS) {
                cancelAnimationFrame(animationId);
                resolve(true);
                return;
              }
            }
            blinkState = 'open';
            blinkCloseFrames = 0;
          }
        } else if (requiredDir) {
          const turn = detectHeadTurn(result.landmarks, result.detection.box);
          if (turn === requiredDir) {
            turnFrames++;
            onProgress?.(`Turning ${requiredDir}... ${turnFrames}/${REQUIRED_TURN_FRAMES}`);
            if (turnFrames >= REQUIRED_TURN_FRAMES) {
              cancelAnimationFrame(animationId);
              resolve(true);
              return;
            }
          } else {
            if (turnFrames > 0) {
              turnFrames = 0;
              onProgress?.(`Hold still, then turn ${requiredDir}`);
            }
          }
        }
      } catch {
        // frame detection failed, continue
      }

      animationId = requestAnimationFrame(frame);
    };

    frame();
  });
}

export { MAX_ATTEMPTS };
