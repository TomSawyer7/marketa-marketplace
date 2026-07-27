import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, RotateCcw, Check, RefreshCw, ShieldAlert, Eye, ArrowLeft, ArrowRight, Loader2, Upload } from 'lucide-react';
import { runLivenessCheck, pickRandomChallenge, getChallengeInstruction, MAX_ATTEMPTS } from '../lib/livenessDetection';
import type { LivenessChallenge, LivenessResult } from '../lib/livenessDetection';

interface CameraCaptureProps {
  title: string;
  subtitle?: string;
  overlayType?: 'id_card' | 'face';
  onCapture: (dataUrl: string) => void;
  capturedImage?: string | null;
  onRetake?: () => void;
  enableLiveness?: boolean;
  onLivenessResult?: (result: LivenessResult) => void;
}

type CameraState = 'requesting-permission' | 'live' | 'liveness-detecting' | 'liveness-failed' | 'permission-denied' | 'no-camera-found' | 'captured';

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  title, subtitle, overlayType = 'id_card', onCapture, capturedImage, onRetake, enableLiveness, onLivenessResult
}) => {
  const [cameraState, setCameraState] = useState<CameraState>(capturedImage ? 'captured' : 'requesting-permission');
  const [previewImage, setPreviewImage] = useState<string | null>(capturedImage || null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [livenessChallenge, setLivenessChallenge] = useState<LivenessChallenge>('blink');
  const [livenessMessage, setLivenessMessage] = useState<string>('');
  const [livenessAttempts, setLivenessAttempts] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach((track) => track.stop()); streamRef.current = null; }
  }, []);

  const startCamera = useCallback(async () => {
    stopStream(); if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    setCameraState('requesting-permission'); setErrorMessage(null); setLivenessAttempts(0); setLivenessMessage('');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraState('no-camera-found'); setErrorMessage('Camera access is not supported by this browser.'); return;
      }
      const videoMode = overlayType === 'id_card' ? 'environment' : 'user';
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: videoMode },
          audio: false
        });
      } catch (firstErr: any) {
        if (firstErr.name === 'OverconstrainedError' || firstErr.name === 'ConstraintNotSatisfiedError') {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: videoMode },
              audio: false
            });
          } catch {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
          }
        } else {
          throw firstErr;
        }
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try { await videoRef.current.play(); setCameraState('live'); }
        catch (playErr) { console.warn('Video play interrupted:', playErr); setCameraState('live'); }
      } else { setCameraState('live'); }
    } catch (err: any) {
      console.error('Camera initialization error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraState('permission-denied'); setErrorMessage('Camera access was denied. Please allow camera permissions in browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraState('no-camera-found'); setErrorMessage('No camera device was detected on your hardware.');
      } else {
        setCameraState('permission-denied'); setErrorMessage(`Unable to access camera: ${err.message || 'Unknown error'}`);
      }
    }
  }, [stopStream, overlayType]);

  useEffect(() => {
    if (!capturedImage) { startCamera(); } else { setCameraState('captured'); setPreviewImage(capturedImage); }
    return () => { stopStream(); if (abortRef.current) abortRef.current.abort(); };
  }, [capturedImage, startCamera, stopStream]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreviewImage(dataUrl); setCameraState('captured'); onCapture(dataUrl);
    };
    reader.readAsDataURL(file);
  }, [onCapture]);

  const handleCapture = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (overlayType === 'id_card') {
        const vr = video.getBoundingClientRect();
        const displayW = vr.width;
        const displayH = vr.height;

        const scale = Math.max(displayW / vw, displayH / vh);
        const vidDisplayW = vw * scale;
        const vidDisplayH = vh * scale;
        const offsetX = (displayW - vidDisplayW) / 2;
        const offsetY = (displayH - vidDisplayH) / 2;

        const frameDisplayW = Math.min(displayW * 0.85, 340);
        const frameDisplayH = frameDisplayW / (85.6 / 53.9);
        const frameDisplayX = (displayW - frameDisplayW) / 2;
        const frameDisplayY = (displayH - frameDisplayH) / 2;

        let srcX = (frameDisplayX - offsetX) / scale;
        let srcY = (frameDisplayY - offsetY) / scale;
        let srcW = frameDisplayW / scale;
        let srcH = frameDisplayH / scale;

        srcX = Math.max(0, srcX);
        srcY = Math.max(0, srcY);
        srcW = Math.min(srcW, vw - srcX);
        srcH = Math.min(srcH, vh - srcY);

        canvas.width = Math.round(srcW);
        canvas.height = Math.round(srcH);
        ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);
      } else {
        canvas.width = vw;
        canvas.height = vh;
        ctx.drawImage(video, 0, 0, vw, vh);
      }

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      setPreviewImage(dataUrl); setCameraState('captured'); stopStream(); onCapture(dataUrl);
    }
  }, [onCapture, stopStream, overlayType]);

  const startLiveness = useCallback(() => {
    const challenge = pickRandomChallenge();
    setLivenessChallenge(challenge);
    setLivenessMessage(getChallengeInstruction(challenge));
    setCameraState('liveness-detecting');

    const controller = new AbortController();
    abortRef.current = controller;

    const video = videoRef.current;
    if (!video) return;

    runLivenessCheck(video, challenge, controller.signal, (msg) => {
      if (!controller.signal.aborted) setLivenessMessage(msg);
    }).then((passed) => {
      if (controller.signal.aborted) return;
      if (passed) {
        onLivenessResult?.({ passed: true, challengeType: challenge, attempts: livenessAttempts + 1 });
        handleCapture();
      } else {
        const newAttempts = livenessAttempts + 1;
        setLivenessAttempts(newAttempts);
        if (newAttempts >= MAX_ATTEMPTS) {
          onLivenessResult?.({ passed: false, challengeType: challenge, attempts: newAttempts });
          setCameraState('liveness-failed');
          setErrorMessage(`Verification check failed after ${MAX_ATTEMPTS} attempts. Please try again.`);
        } else {
          startLiveness();
        }
      }
    });
  }, [livenessAttempts, handleCapture, onLivenessResult]);

  useEffect(() => {
    if (cameraState === 'live' && enableLiveness && overlayType === 'face') {
      startLiveness();
    }
  }, [cameraState, enableLiveness, overlayType, startLiveness]);

  const handleRetakeClick = () => {
    stopStream();
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    setPreviewImage(null); setLivenessAttempts(0); setLivenessMessage('');
    if (onRetake) onRetake();
    startCamera();
  };

  const livenessIcon = () => {
    if (livenessChallenge === 'blink') return <Eye className="w-5 h-5 text-primary" />;
    if (livenessChallenge === 'turn_left') return <ArrowLeft className="w-5 h-5 text-primary" />;
    return <ArrowRight className="w-5 h-5 text-primary" />;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Camera className="w-4 h-4 text-primary" /> {title}
          </h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-primary/10 text-primary tracking-wider">
          Live Camera Required
        </span>
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-100 min-h-[280px]">
        {/* Captured preview — replaces the video entirely */}
        {cameraState === 'captured' && previewImage ? (
          <div className="relative w-full h-72 bg-slate-100 flex items-center justify-center">
            <img src={previewImage} alt="Captured Snapshot" className="w-full h-full object-contain" />
            <div className="absolute top-2 right-2 bg-emerald-500 text-white px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1">
              <Check className="w-3 h-3" /> Captured
            </div>
          </div>
        ) : (
          <>
            {/* Video container — always rendered so videoRef is valid when stream resolves */}
            <div className="relative w-full h-72 bg-black flex items-center justify-center overflow-hidden">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

              {overlayType === 'id_card' && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-[85%] max-w-[340px] aspect-[85.6/53.9] border-2 border-dashed border-primary/70 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] flex flex-col justify-between p-3">
                    <div className="flex justify-between text-[10px] text-primary font-mono font-bold uppercase tracking-wider">
                      <span>National ID</span>
                      <span>Align Card Frame</span>
                    </div>
                    <div className="text-center text-[10px] text-white/90 font-medium">
                      Fit entire ID card inside rectangle
                    </div>
                  </div>
                </div>
              )}

              {overlayType === 'face' && (
                <>
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-52 h-68 rounded-[50%] shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]" />
                    <div className="absolute w-52 h-68 rounded-[50%] border-[3px] border-primary/70" />
                    <div className="absolute w-[13rem] h-[17rem] rounded-[50%] border border-primary/30" />
                    <div className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-3 h-3 bg-primary rounded-sm rotate-45" />
                    <div className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-3 h-3 bg-primary rounded-sm rotate-45" />
                    <div className="absolute left-1/2 -translate-x-1/2 -top-1.5 w-3 h-3 bg-primary rounded-sm rotate-45" />
                    <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3 h-3 bg-primary rounded-sm rotate-45" />
                    <span className="absolute bottom-7 text-[10px] text-white font-bold uppercase tracking-wider bg-black/70 px-2.5 py-1 rounded">
                      Center Face Here
                    </span>
                  </div>

                  {(cameraState === 'liveness-detecting') && (
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-black/80 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-semibold shadow-lg max-w-[90%]">
                      {livenessMessage.includes('Preparing') || livenessMessage.includes('Blink') ? (
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      ) : (
                        livenessIcon()
                      )}
                      <span className="truncate">{livenessMessage}</span>
                    </div>
                  )}

                  {(cameraState === 'liveness-detecting') && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 bg-black/60 text-white/80 px-3 py-1 rounded text-[10px]">
                      Attempt {livenessAttempts + 1} / {MAX_ATTEMPTS}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Overlay: requesting permission */}
            {cameraState === 'requesting-permission' && (
              <div className="absolute inset-0 bg-white/95 flex items-center justify-center z-20">
                <div className="p-8 text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto" />
                  <p className="text-sm font-semibold text-slate-700">Initializing Live Camera Feed...</p>
                  <p className="text-xs text-slate-500">Please grant camera permission in your browser if prompted.</p>
                </div>
              </div>
            )}

            {/* Overlay: permission denied / no camera */}
            {(cameraState === 'permission-denied' || cameraState === 'no-camera-found') && (
              <div className="absolute inset-0 bg-white flex items-center justify-center z-20">
                <div className="p-8 text-center space-y-4 max-w-md">
                  <ShieldAlert className="w-10 h-10 text-red-400 mx-auto" />
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-red-600">Camera Access Unavailable</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">{errorMessage}</p>
                  </div>
                  <div className="flex flex-col items-center gap-3">
                    <button type="button" onClick={startCamera}
                      className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-xs font-semibold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer">
                      <RefreshCw className="w-3.5 h-3.5" /> Try Re-enabling Camera
                    </button>
                    <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">or</span>
                    <label className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer">
                      <Upload className="w-3.5 h-3.5" /> Upload Photo Instead
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Overlay: liveness failed */}
            {cameraState === 'liveness-failed' && (
              <div className="absolute inset-0 bg-white flex items-center justify-center z-20">
                <div className="p-8 text-center space-y-4 max-w-md">
                  <ShieldAlert className="w-10 h-10 text-red-400 mx-auto" />
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-red-600">Verification Check Failed</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">{errorMessage}</p>
                  </div>
                  <button type="button" onClick={startCamera}
                    className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-xs font-semibold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer">
                    <RefreshCw className="w-3.5 h-3.5" /> Try Again
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center justify-between pt-1">
        {cameraState === 'live' && !enableLiveness && (
          <button type="button" onClick={handleCapture}
            className="w-full py-2.5 bg-primary hover:bg-primary-dark text-white font-semibold rounded-lg text-sm transition flex items-center justify-center gap-2 cursor-pointer">
            <Camera className="w-4 h-4" /> Capture Live Snapshot
          </button>
        )}
        {cameraState === 'captured' && (
          <div className="w-full flex items-center justify-between gap-3">
            <button type="button" onClick={handleRetakeClick}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg text-xs flex items-center gap-2 transition cursor-pointer">
              <RotateCcw className="w-4 h-4 text-slate-500" /> Retake Photo
            </button>
            <div className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
              <Check className="w-4 h-4" /> Snapshot Saved
            </div>
          </div>
        )}
        {(cameraState === 'liveness-detecting' || enableLiveness) && cameraState !== 'captured' && (
          <div className="w-full text-center">
            <span className="text-xs text-slate-400 animate-pulse">
              {cameraState === 'liveness-detecting' ? 'Verification check in progress...' : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
