import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Clock,
  ArrowLeft,
  Sparkles,
  Loader2,
  ScanFace,
  XCircle,
  FileCheck2,
  Info
} from 'lucide-react';
import { store } from '../lib/supabase';
import type { Profile, NationalIdFields } from '../types/marketplace';
import { compareFaces, type MatchResult } from '../lib/faceVerification';
import { extractIdFields } from '../lib/ocrExtraction';
import type { OcrExtractionResult } from '../lib/ocrExtraction';
import { CameraCapture } from '../components/CameraCapture';
import type { LivenessResult } from '../lib/livenessDetection';
import { extractQrFromImage } from '../lib/qrExtraction';
import { toast } from 'sonner';

export const VerifyID: React.FC = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<Profile>(store.getCurrentUser());

  // Step State: 1 = Front ID, 2 = Back ID, 3 = OCR Edit, 4 = Selfie, 5 = Face Match
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Capture State & Timestamps
  const [idFrontImage, setIdFrontImage] = useState<string | null>(currentUser.id_front_url || currentUser.id_document_url || null);
  const [idFrontCapturedAt, setIdFrontCapturedAt] = useState<string | null>(currentUser.id_front_captured_at || null);

  const [idBackImage, setIdBackImage] = useState<string | null>(currentUser.id_back_url || null);
  const [idBackCapturedAt, setIdBackCapturedAt] = useState<string | null>(currentUser.id_back_captured_at || null);

  const [selfieImage, setSelfieImage] = useState<string | null>(currentUser.selfie_url || null);
  const [selfieCapturedAt, setSelfieCapturedAt] = useState<string | null>(currentUser.selfie_captured_at || null);

  // Liveness Detection State
  const [livenessResult, setLivenessResult] = useState<LivenessResult | null>(null);

  // QR Extraction State (from ID Back)
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [qrExtractedAt, setQrExtractedAt] = useState<string | null>(null);
  const [qrImageDataUrl, setQrImageDataUrl] = useState<string | null>(null);

  // OCR Processing State
  const [isExtractingOcr, setIsExtractingOcr] = useState(false);
  const [ocrRawText, setOcrRawText] = useState<string>(currentUser.ocr_raw_text || '');
  const [ocrConfidence, setOcrConfidence] = useState<Partial<Record<keyof NationalIdFields, number>>>(
    currentUser.ocr_confidence || {}
  );
  const [confirmedFields, setConfirmedFields] = useState<NationalIdFields>({
    full_name: currentUser.ocr_fields?.full_name || currentUser.full_name || '',
    id_number: currentUser.ocr_fields?.id_number || currentUser.id_number || '',
    date_of_birth: currentUser.ocr_fields?.date_of_birth || '',
    expiry_date: currentUser.ocr_fields?.expiry_date || '',
          nationality: currentUser.ocr_fields?.nationality || ''
  });

  // Post-submission state
  const [submitted, setSubmitted] = useState(false);

  // Face Matching State
  const [isComparing, setIsComparing] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(
    currentUser.face_match_score !== undefined && currentUser.face_match_score !== null
      ? {
          distance: currentUser.face_match_score,
          status: currentUser.face_match_status || 'not_run'
        }
      : null
  );

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Admin and already-verified accounts skip verification entirely
  if (currentUser.role === 'admin' || currentUser.verification_status === 'verified') {
    navigate('/', { replace: true });
    return null;
  }

  // Step 1: Front ID captured
  const handleFrontCaptured = (dataUrl: string) => {
    setIdFrontImage(dataUrl);
    setIdFrontCapturedAt(new Date().toISOString());
    toast.success('Front of ID Captured ✓');
  };

  // Step 2: Back ID captured -> Trigger OCR Extraction + QR Decoding
  const handleBackCaptured = async (dataUrl: string) => {
    setIdBackImage(dataUrl);
    const now = new Date().toISOString();
    setIdBackCapturedAt(now);
    toast.success('Back of ID Captured ✓');

    // Run QR extraction on the back-of-ID image in parallel
    extractQrFromImage(dataUrl).then((qrResult) => {
      if (qrResult.payload) {
        setQrPayload(qrResult.payload);
        setQrExtractedAt(qrResult.extractedAt);
        setQrImageDataUrl(qrResult.qrImageDataUrl || null);
        toast.success('QR Code Detected on ID Back ✓');
      }
    });

    if (idFrontImage || dataUrl) {
      setIsExtractingOcr(true);
      setStep(3);
      try {
        const ocrResult: OcrExtractionResult = await extractIdFields(
          idFrontImage || dataUrl,
          idFrontImage ? { backImage: dataUrl } : undefined
        );
        setOcrRawText(ocrResult.rawText);
        setOcrConfidence(ocrResult.confidence);

        setConfirmedFields((prev) => ({
          full_name: ocrResult.fields.full_name || prev.full_name || '',
          id_number: ocrResult.fields.id_number || prev.id_number || '',
          date_of_birth: ocrResult.fields.date_of_birth || prev.date_of_birth || '',
          expiry_date: ocrResult.fields.expiry_date || prev.expiry_date || '',
          nationality: ocrResult.fields.nationality || prev.nationality || ''
        }));

        if (ocrResult.rawText.trim()) {
          toast.success('Text Read from ID ✓', {
            description: 'Please review and confirm your information below.'
          });
        } else {
          toast.info('Could not read text from your ID photo. Fill in your details manually.', {
            description: 'Ensure good lighting and the ID card is clearly visible.'
          });
        }
      } catch (err) {
        toast.error('Could not read text from photo', {
          description: 'Please fill in your details manually.'
        });
      } finally {
        setIsExtractingOcr(false);
      }
    } else {
      setStep(3);
    }
  };

  // Step 3: OCR Data Confirmation -> Proceed to Selfie
  const handleConfirmOcrFields = (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmedFields.id_number.trim()) {
      toast.error('Please enter a valid National ID Number.');
      return;
    }
    if (!confirmedFields.full_name.trim()) {
      toast.error('Please enter Full Name as shown on ID.');
      return;
    }
    setStep(4);
    toast.info('Proceeding to selfie capture');
  };

  // Step 4: Selfie Captured -> Run Face Matching
  const handleSelfieCaptured = (dataUrl: string) => {
    setSelfieImage(dataUrl);
    setSelfieCapturedAt(new Date().toISOString());
    toast.success('Selfie Captured ✓');
  };

  const handleRunBiometricMatch = async () => {
    if (!idFrontImage || !selfieImage) {
      toast.error('Missing ID front image or selfie capture.');
      return;
    }

    setStep(5);
    setIsComparing(true);

    try {
      const result = await compareFaces(idFrontImage, selfieImage);
      setMatchResult(result);

      await store.updateNationalIdVerification(currentUser.id, {
        idFrontUrl: idFrontImage,
        idBackUrl: idBackImage || idFrontImage,
        selfieUrl: selfieImage,
        idFrontCapturedAt: idFrontCapturedAt || new Date().toISOString(),
        idBackCapturedAt: idBackCapturedAt || new Date().toISOString(),
        selfieCapturedAt: selfieCapturedAt || new Date().toISOString(),
        ocrFields: confirmedFields,
        ocrRawText: ocrRawText,
        ocrConfidence: ocrConfidence,
        faceMatchScore: result.distance,
        faceMatchStatus: result.status,
        livenessCheckPassed: livenessResult?.passed ?? false,
        livenessChallengeType: livenessResult?.challengeType ?? null,
        qrPayload: qrPayload,
        qrExtractedAt: qrExtractedAt,
        qrImageDataUrl: qrImageDataUrl,
        verificationStatus: 'pending'
      });

      setSubmitted(true);
      toast.info('Verification Submitted for Admin Review', {
        description: 'Your ID has been submitted. An admin will review and approve it.'
      });
    } catch (err) {
      toast.error('Verification error');
    } finally {
      setIsComparing(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 text-slate-900 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Back Link */}
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Marketplace
        </button>

        {/* Page Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider">
            <ScanFace className="w-3.5 h-3.5" /> National ID & Identity Verification
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
            National ID Verification
          </h1>
          <p className="text-slate-500 text-sm max-w-lg mx-auto">
            Requires live camera capture of your National ID (Front & Back) and a selfie photo.
          </p>
        </div>

        {/* Pending / submitted → show confirmation, hide flow */}
        {(submitted || currentUser.verification_status === 'pending') ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto text-amber-600 border border-amber-200 animate-pulse">
              <Clock className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-amber-700">Verification Submitted</h2>
            <p className="text-slate-600 text-sm max-w-md mx-auto">
              Please wait while an admin reviews your ID. You'll be notified once it's approved.
            </p>
            <div className="pt-2">
              <button
                onClick={() => navigate('/')}
                className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg text-sm transition cursor-pointer"
              >
                Return to Home
              </button>
            </div>
          </div>
        ) : (
          <>
        {/* STEPPER PROGRESS BAR */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-center justify-between gap-1 text-[11px] sm:text-xs font-bold text-slate-500 overflow-x-auto">
          <div className={`flex items-center gap-1.5 whitespace-nowrap ${step >= 1 ? 'text-primary' : ''}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 1 ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'}`}>1</span>
            <span>ID Front</span>
          </div>
          <div className="h-0.5 w-4 bg-slate-200" />
          <div className={`flex items-center gap-1.5 whitespace-nowrap ${step >= 2 ? 'text-primary' : ''}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 2 ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'}`}>2</span>
            <span>ID Back</span>
          </div>
          <div className="h-0.5 w-4 bg-slate-200" />
          <div className={`flex items-center gap-1.5 whitespace-nowrap ${step >= 3 ? 'text-primary' : ''}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 3 ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'}`}>3</span>
            <span>Review Info</span>
          </div>
          <div className="h-0.5 w-4 bg-slate-200" />
          <div className={`flex items-center gap-1.5 whitespace-nowrap ${step >= 4 ? 'text-primary' : ''}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 4 ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'}`}>4</span>
            <span>Selfie</span>
          </div>
          <div className="h-0.5 w-4 bg-slate-200" />
          <div className={`flex items-center gap-1.5 whitespace-nowrap ${step >= 5 ? 'text-primary' : ''}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 5 ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'}`}>5</span>
            <span>Verify</span>
          </div>
        </div>

        {/* STEP 1: LIVE CAPTURE FRONT OF NATIONAL ID */}
        {step === 1 && (
          <div className="space-y-4">
            <CameraCapture
              title="Step 1: Capture Front of National ID"
              subtitle="Align the front side of your official National ID card inside the guide frame."
              overlayType="id_card"
              onCapture={handleFrontCaptured}
              capturedImage={idFrontImage}
              onRetake={() => setIdFrontImage(null)}
            />
            {idFrontImage && (
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full py-3 bg-primary hover:bg-primary-dark text-white font-bold rounded-lg text-sm shadow-sm transition cursor-pointer"
              >
                Proceed to Step 2: Capture Back of National ID →
              </button>
            )}
          </div>
        )}

        {/* STEP 2: LIVE CAPTURE BACK OF NATIONAL ID */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1"
              >
                ← Back to Front ID
              </button>
            </div>
            <CameraCapture
              title="Step 2: Capture Back of National ID"
              subtitle="Align the reverse side of your National ID card inside the frame."
              overlayType="id_card"
              onCapture={handleBackCaptured}
              capturedImage={idBackImage}
              onRetake={() => setIdBackImage(null)}
            />
            {idBackImage && (
              <button
                type="button"
                onClick={() => handleBackCaptured(idBackImage)}
                className="w-full py-3 bg-primary hover:bg-primary-dark text-white font-bold rounded-lg text-sm shadow-sm transition cursor-pointer"
              >
                Read Text from ID →
              </button>
            )}
          </div>
        )}

        {/* STEP 3: OCR EXTRACTION & HUMAN CONFIRMATION FORM */}
        {step === 3 && (
          <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 space-y-6 animate-in fade-in">
            {isExtractingOcr ? (
              <div className="py-12 text-center space-y-4">
                <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
                <h3 className="text-xl font-bold text-slate-900">Reading your ID information...</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Scanning your ID photo for your name, ID number and other details.
                </p>
              </div>
            ) : (
              <form onSubmit={handleConfirmOcrFields} className="space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                  <div className="flex items-center gap-3">
                    <FileCheck2 className="w-6 h-6 text-primary" />
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Step 3: Confirm Your ID Information</h3>
                      <p className="text-xs text-slate-500">
                        Review the information from your National ID and make any corrections.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="text-xs text-slate-500 hover:text-slate-900"
                  >
                    ← Back to ID Back
                  </button>
                </div>

                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-start gap-3">
                  <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Reading accuracy depends on lighting and photo clarity. Yellow highlighted fields may be less accurate — please double-check them.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                      <span>Full Name *</span>
                      {ocrConfidence.full_name !== undefined && (
                        <span className={`text-[10px] font-mono font-bold ${
                          ocrConfidence.full_name < 75 ? 'text-amber-600' : 'text-emerald-600'
                        }`}>
                          Confidence: {ocrConfidence.full_name}%
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      required
                      value={confirmedFields.full_name}
                      onChange={(e) => setConfirmedFields({ ...confirmedFields, full_name: e.target.value })}
                      className={`w-full bg-slate-50 border rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-primary transition ${
                        (ocrConfidence.full_name ?? 100) < 75
                          ? 'border-amber-400 bg-amber-50'
                          : 'border-slate-200'
                      }`}
                    />
                  </div>

                  {/* ID Number */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                      <span>National ID Number *</span>
                      {ocrConfidence.id_number !== undefined && (
                        <span className={`text-[10px] font-mono font-bold ${
                          ocrConfidence.id_number < 75 ? 'text-amber-600' : 'text-emerald-600'
                        }`}>
                          Confidence: {ocrConfidence.id_number}%
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      required
                      value={confirmedFields.id_number}
                      onChange={(e) => setConfirmedFields({ ...confirmedFields, id_number: e.target.value })}
                      className={`w-full bg-slate-50 border rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-primary transition ${
                        (ocrConfidence.id_number ?? 100) < 75
                          ? 'border-amber-400 bg-amber-50'
                          : 'border-slate-200'
                      }`}
                    />
                  </div>

                  {/* Date of Birth */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                      <span>Date of Birth</span>
                      {ocrConfidence.date_of_birth !== undefined && (
                        <span className={`text-[10px] font-mono font-bold ${
                          ocrConfidence.date_of_birth < 75 ? 'text-amber-600' : 'text-emerald-600'
                        }`}>
                          Confidence: {ocrConfidence.date_of_birth}%
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      placeholder="DD/MM/YYYY"
                      value={confirmedFields.date_of_birth}
                      onChange={(e) => setConfirmedFields({ ...confirmedFields, date_of_birth: e.target.value })}
                      className={`w-full bg-slate-50 border rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-primary transition ${
                        (ocrConfidence.date_of_birth ?? 100) < 75
                          ? 'border-amber-400 bg-amber-50'
                          : 'border-slate-200'
                      }`}
                    />
                  </div>

                  {/* Expiry Date */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                      <span>Expiry Date</span>
                      {ocrConfidence.expiry_date !== undefined && (
                        <span className={`text-[10px] font-mono font-bold ${
                          ocrConfidence.expiry_date < 75 ? 'text-amber-600' : 'text-emerald-600'
                        }`}>
                          Confidence: {ocrConfidence.expiry_date}%
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      placeholder="DD/MM/YYYY"
                      value={confirmedFields.expiry_date}
                      onChange={(e) => setConfirmedFields({ ...confirmedFields, expiry_date: e.target.value })}
                      className={`w-full bg-slate-50 border rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-primary transition ${
                        (ocrConfidence.expiry_date ?? 100) < 75
                          ? 'border-amber-400 bg-amber-50'
                          : 'border-slate-200'
                      }`}
                    />
                  </div>
                </div>

                {/* Nationality */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Nationality / Country
                  </label>
                  <input
                    type="text"
                    value={confirmedFields.nationality}
                    onChange={(e) => setConfirmedFields({ ...confirmedFields, nationality: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-primary transition"
                  />
                </div>

                {/* Preview Captured ID Images */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      National ID Front
                    </span>
                    <div className="h-28 rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                      <img src={idFrontImage!} alt="ID Front" className="w-full h-full object-contain" />
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      National ID Back
                    </span>
                    <div className="h-28 rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                      <img src={idBackImage || idFrontImage!} alt="ID Back" className="w-full h-full object-contain" />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-primary hover:bg-primary-dark text-white font-bold rounded-lg text-sm shadow-sm transition cursor-pointer"
                >
                  Confirm & Take Selfie →
                </button>
              </form>
            )}
          </div>
        )}

        {/* STEP 4: LIVE SELFIE CAPTURE */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="text-xs text-slate-500 hover:text-slate-900"
              >
                ← Back to ID Info
              </button>
            </div>
            <CameraCapture
              title="Step 4: Live Selfie Snapshot"
              subtitle="Complete a quick check to verify you are a real person."
              overlayType="face"
              onCapture={handleSelfieCaptured}
              capturedImage={selfieImage}
              onRetake={() => setSelfieImage(null)}
              enableLiveness
              onLivenessResult={setLivenessResult}
            />
            {selfieImage && (
              <button
                type="button"
                onClick={handleRunBiometricMatch}
                className="w-full py-3 bg-primary hover:bg-primary-dark text-white font-bold rounded-lg text-sm shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" /> Verify Identity →
              </button>
            )}
          </div>
        )}

        {/* STEP 5: BIOMETRIC MATCH RESULTS */}
        {step === 5 && (
          <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 space-y-6 text-center animate-in fade-in">
            {isComparing ? (
              <div className="py-12 space-y-4">
                <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
                <h3 className="text-xl font-bold text-slate-900">Comparing your photos...</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Comparing your ID photo with your selfie to verify your identity.
                </p>
              </div>
            ) : matchResult ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-2xl font-extrabold text-slate-900">Identity Verification Result</h3>
                  <p className="text-xs text-slate-500">ID Photo vs. Live Selfie</p>
                </div>

                {/* Captured Artifacts Trio */}
                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 max-w-lg mx-auto">
                  <div>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      ID Front
                    </span>
                    <div className="h-24 rounded-lg overflow-hidden border border-slate-200 bg-white">
                      <img src={idFrontImage!} alt="ID Front" className="w-full h-full object-cover" />
                    </div>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      ID Back
                    </span>
                    <div className="h-24 rounded-lg overflow-hidden border border-slate-200 bg-white">
                      <img src={idBackImage || idFrontImage!} alt="ID Back" className="w-full h-full object-cover" />
                    </div>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-primary uppercase tracking-wider block mb-1">
                      Live Selfie
                    </span>
                    <div className="h-24 rounded-lg overflow-hidden border border-primary/30 bg-white">
                      <img src={selfieImage!} alt="Selfie" className="w-full h-full object-cover" />
                    </div>
                  </div>
                </div>

                {/* Confirmed Data Summary */}
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 max-w-lg mx-auto text-left text-xs space-y-1">
                  <div className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">
                    Confirmed National ID Record
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-600">
                    <div>
                      <span className="text-slate-500 block">Name:</span>
                      <strong className="text-slate-900">{confirmedFields.full_name}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">ID Number:</span>
                      <strong className="text-slate-900">{confirmedFields.id_number}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">DOB:</span>
                      <span className="text-slate-700">{confirmedFields.date_of_birth || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Expiry:</span>
                      <span className="text-slate-700">{confirmedFields.expiry_date || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Score Card */}
                <div className={`p-6 rounded-lg border max-w-lg mx-auto space-y-2 ${
                  matchResult.status === 'passed'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : matchResult.status === 'needs_review'
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}>
                  <div className="flex items-center justify-center gap-2 text-xl font-black">
                    {matchResult.status === 'passed' && <ShieldCheck className="w-7 h-7 text-emerald-600" />}
                    {matchResult.status === 'needs_review' && <Clock className="w-7 h-7 text-amber-600" />}
                    {matchResult.status === 'failed' && <XCircle className="w-7 h-7 text-rose-600" />}
                    <span>
                      {matchResult.status === 'passed'
                        ? 'VERIFICATION PASSED'
                        : matchResult.status === 'needs_review'
                        ? 'MANUAL COMPLIANCE AUDIT REQUIRED'
                        : 'VERIFICATION MISMATCH DETECTED'}
                    </span>
                  </div>

                  <div className="text-xs font-mono pt-1">
                    Match Score: <strong className="text-slate-900 text-sm">{matchResult.distance}</strong>
                  </div>
                </div>

                <div className="flex justify-center gap-3 pt-4">
                  <button
                    onClick={() => navigate('/')}
                    className="px-6 py-3 bg-primary hover:bg-primary-dark text-white font-bold rounded-lg text-sm shadow-sm cursor-pointer"
                  >
                    Return to Marketplace
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
};
