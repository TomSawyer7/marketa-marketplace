import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import {
  ShieldCheck,
  ShieldAlert,
  FileText,
  CheckCircle2,
  XCircle,
  Shield,
  Eye,
  ScanFace,
  Clock,
  Filter,
  AlertTriangle,
  Copy,
  ExternalLink,
  QrCode,
  Check,
  X,
  Flag,
  Scale
} from 'lucide-react';
import { store, supabase, syncProfilesFromSupabase } from '../lib/supabase';
import type { Conversation, Message, Profile, FaceMatchStatus, Appeal } from '../types/marketplace';
import { toast } from 'sonner';

export const Admin: React.FC = () => {
  const currentUser = store.getCurrentUser();
  if (currentUser.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  const [users, setUsers] = useState<Profile[]>(store.getUsers());
  const [conversations, setConversations] = useState<Conversation[]>(store.getAllConversations());
  const [activeTab, setActiveTab] = useState<'id_queue' | 'disputes' | 'trust_safety'>('id_queue');
  const [selectedDisputeConv, setSelectedDisputeConv] = useState<Conversation | null>(null);
  const [disputeMessages, setDisputeMessages] = useState<Message[]>([]);
  const [filterFaceStatus, setFilterFaceStatus] = useState<FaceMatchStatus | 'ALL'>('ALL');
  const [reports, setReports] = useState<any[]>([]);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [tsTab, setTsTab] = useState<'reports' | 'appeals'>('reports');

  useEffect(() => {
    const refreshFromStore = () => {
      // Must copy arrays so React detects reference changes
      setUsers([...store.getUsers()]);
      setConversations([...store.getAllConversations()]);
      if (selectedDisputeConv) {
        setDisputeMessages([...store.getMessagesForConversation(selectedDisputeConv.id)]);
      }
      setReports([...store.getReports()]);
      setAppeals([...store.getAppeals()]);
    };

    const fetchPendingFromSupabase = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('verification_status', 'pending');
      console.log('Pending Verifications:', data, error);
      if (error) {
        console.error('Supabase fetch pending error:', error.message);
        return;
      }
      if (data) {
        await syncProfilesFromSupabase();
        refreshFromStore();
      }
    };

    fetchPendingFromSupabase();
    refreshFromStore();
    const unsubscribe = store.subscribe(refreshFromStore);

    // Subscribe to real-time profile changes so admin sees pending submissions instantly
    const channel = supabase
      .channel('admin-profiles-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        async () => {
          await syncProfilesFromSupabase();
          refreshFromStore();
        }
      )
      .subscribe();

    // 5-second polling fallback in case WebSockets miss an event
    const pollInterval = setInterval(fetchPendingFromSupabase, 5000);

    return () => {
      unsubscribe();
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [selectedDisputeConv]);

  // Sort pending users so 'needs_review' and 'failed' surface first
  const pendingUsers = users
    .filter((u) => u.verification_status === 'pending')
    .filter((u) => filterFaceStatus === 'ALL' || u.face_match_status === filterFaceStatus)
    .sort((a, b) => {
      if (a.face_match_status === 'needs_review') return -1;
      if (b.face_match_status === 'needs_review') return 1;
      return 0;
    });

  const verifiedUsers = users.filter((u) => u.verification_status === 'verified');
  const underReviewDisputes = conversations.filter((c) => c.dispute_status === 'under_review');

  const handleApproveID = async (userId: string, userName: string) => {
    store.updateProfileVerification(userId, 'verified');
    const { error } = await supabase.from('profiles').update({ verification_status: 'verified' }).eq('id', userId);
    if (error) console.error('Supabase verification update failed:', error);
    toast.success(`Identity Verified`, {
      description: `${userName}'s National ID document & face match approved by Admin.`
    });
  };

  const handleRejectID = async (userId: string, userName: string) => {
    store.updateProfileVerification(userId, 'rejected');
    const { error } = await supabase.from('profiles').update({ verification_status: 'rejected' }).eq('id', userId);
    if (error) console.error('Supabase verification update failed:', error);
    toast.error(`Verification Rejected`, {
      description: `${userName}'s National ID document rejected by Admin.`
    });
  };

  const handleResolveDispute = (convId: string) => {
    store.resolveDispute(convId);
    setSelectedDisputeConv(null);
    toast.success(`Dispute Resolved`, {
      description: `The conversation compliance audit has been marked as resolved.`
    });
  };

  const handleInspectDispute = (conv: Conversation) => {
    setSelectedDisputeConv(conv);
    setDisputeMessages(store.getMessagesForConversation(conv.id));
  };

  const handleEverifyPassed = (userId: string, userName: string) => {
    store.updateEverifyStatus(userId, 'passed');
    toast.success(`eVerify Passed`, {
      description: `${userName}'s QR payload verified on eVerify.gov.ph.`
    });
  };

  const handleEverifyFailed = (userId: string, userName: string) => {
    const notes = prompt('Optional notes for eVerify failure reason:');
    store.updateEverifyStatus(userId, 'failed', notes || undefined);
    toast.success(`eVerify Failed`, {
      description: `${userName}'s QR payload failed verification.`
    });
  };

  const handleCopyQrPayload = (payload: string) => {
    navigator.clipboard.writeText(payload).then(() => {
      toast.success('QR Payload Copied to Clipboard');
    }).catch(() => {
      toast.error('Failed to copy QR payload');
    });
  };

  const renderLivenessBadge = (passed?: boolean, challengeType?: string | null) => {
    if (passed) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-sky-50 border border-sky-200 text-sky-700">
          <Eye className="w-3 h-3 text-sky-600" /> Liveness Passed ({challengeType})
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
        <Eye className="w-3 h-3 text-slate-400" /> No Liveness Check
      </span>
    );
  };

  const renderFaceMatchBadge = (score?: number | null, status?: FaceMatchStatus) => {
    if (status === 'passed') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700">
          <ShieldCheck className="w-3 h-3 text-emerald-600" /> Face Passed ({score ?? 0.42})
        </span>
      );
    } else if (status === 'needs_review') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 animate-pulse">
          <Clock className="w-3 h-3 text-amber-600" /> Needs Review ({score ?? 0.68})
        </span>
      );
    } else if (status === 'failed') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-red-50 border border-red-200 text-red-700">
          <ShieldAlert className="w-3 h-3 text-red-600" /> Score Failed ({score ?? 0.79})
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
        <ScanFace className="w-3 h-3 text-slate-400" /> Not Analyzed
      </span>
    );
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 text-slate-900 p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider">
            <Shield className="w-3.5 h-3.5" /> Marketa Biometric & Compliance Console
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900">Admin Operations Workspace</h1>
          <p className="text-slate-500 text-sm">
            Review National ID front/back captures, live webcam selfies, confirmed OCR data, and face match scores.
          </p>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
            <span className="text-xs text-slate-500 font-medium block">Total Users</span>
            <span className="text-xl font-bold text-slate-900">{users.length}</span>
          </div>
          <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-center">
            <span className="text-xs text-amber-700 font-medium block">Pending IDs</span>
            <span className="text-xl font-bold text-amber-700">{pendingUsers.length}</span>
          </div>
          <div className="bg-primary/5 p-3 rounded-lg border border-primary/20 text-center">
            <span className="text-xs text-primary font-medium block">Disputes</span>
            <span className="text-xl font-bold text-primary">{underReviewDisputes.length}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setActiveTab('id_queue'); setSelectedDisputeConv(null); }}
            className={`px-5 py-2.5 rounded-lg font-bold text-sm transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'id_queue'
                ? 'bg-primary text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" /> Pending ID & OCR Queue ({pendingUsers.length})
          </button>

          <button
            onClick={() => setActiveTab('disputes')}
            className={`px-5 py-2.5 rounded-lg font-bold text-sm transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'disputes'
                ? 'bg-primary text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ShieldAlert className="w-4 h-4" /> Dual-Consent Appeals ({underReviewDisputes.length})
          </button>

          <button
            onClick={() => setActiveTab('trust_safety')}
            className={`px-5 py-2.5 rounded-lg font-bold text-sm transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'trust_safety'
                ? 'bg-primary text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Scale className="w-4 h-4" /> Trust & Safety ({reports.filter(r => r.status === 'pending').length})
          </button>
        </div>

        {activeTab === 'id_queue' && (
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500">Filter Face Score:</span>
            <select
              value={filterFaceStatus}
              onChange={(e) => setFilterFaceStatus(e.target.value as any)}
              className="bg-transparent text-slate-700 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="needs_review">Needs Review First</option>
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: PENDING ID & OCR QUEUE */}
      {activeTab === 'id_queue' && (
        <div className="space-y-6">
          {pendingUsers.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {pendingUsers.map((u) => {
                const ocrName = u.ocr_fields?.full_name || '';
                const nameMismatch = Boolean(
                  ocrName && u.full_name && ocrName.trim().toLowerCase() !== u.full_name.trim().toLowerCase()
                );

                return (
                  <div
                    key={u.id}
                    className="bg-white border border-slate-200 rounded-lg p-6 space-y-4 shadow-sm flex flex-col justify-between"
                  >
                    <div className="space-y-4">
                      {/* Header Row */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={u.avatar_url}
                            alt={u.full_name}
                            className="w-12 h-12 rounded-full object-cover border-2 border-slate-200 flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <h3 className="font-bold text-slate-900 text-base truncate">{u.full_name}</h3>
                            <p className="text-xs text-slate-500 truncate">{u.email}</p>
                          </div>
                        </div>
                        {renderFaceMatchBadge(u.face_match_score, u.face_match_status)}
                        {renderLivenessBadge(u.liveness_check_passed, u.liveness_challenge_type)}
                      </div>

                      {/* Name Mismatch Warning Banner */}
                      {nameMismatch && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2 text-xs text-amber-700">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>
                            <strong>Name Mismatch:</strong> Registered name "<em>{u.full_name}</em>" differs from OCR confirmed name "<em>{ocrName}</em>".
                          </span>
                        </div>
                      )}

                      {/* 3 LIVE CAPTURED IMAGES: ID FRONT, ID BACK, SELFIE */}
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                        <span className="text-xs font-bold text-slate-700 block">
                          Mandatory Live Captured Photo Artifacts:
                        </span>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                              ID Front
                            </span>
                            <div className="rounded-lg overflow-hidden border border-slate-200 h-28 bg-slate-100">
                              <img
                                src={u.id_front_url || u.id_document_url || 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600&auto=format&fit=crop&q=80'}
                                alt="ID Front"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </div>

                          <div>
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                              ID Back
                            </span>
                            <div className="rounded-lg overflow-hidden border border-slate-200 h-28 bg-slate-100">
                              <img
                                src={u.id_back_url || u.id_document_url || 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600&auto=format&fit=crop&q=80'}
                                alt="ID Back"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </div>

                          <div>
                            <span className="text-[9px] font-bold text-primary uppercase tracking-wider block mb-1">
                              Live Selfie
                            </span>
                            <div className="rounded-lg overflow-hidden border border-primary/20 h-28 bg-slate-100">
                              <img
                                src={u.selfie_url || u.avatar_url}
                                alt="Live Selfie"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* CONFIRMED OCR FIELDS DETAILS */}
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5 text-xs">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary block">
                          OCR Extracted & Confirmed Fields
                        </span>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-700">
                          <div>
                            <span className="text-slate-500">ID Number:</span>{' '}
                            <strong className="text-slate-900">{u.id_number || u.ocr_fields?.id_number || 'N/A'}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500">Nationality:</span>{' '}
                            <strong className="text-slate-900">{u.ocr_fields?.nationality || 'USA'}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500">DOB:</span>{' '}
                            <span className="text-slate-700">{u.ocr_fields?.date_of_birth || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Expiry:</span>{' '}
                            <span className="text-slate-700">{u.ocr_fields?.expiry_date || 'N/A'}</span>
                          </div>
                        </div>
                      </div>

                      {/* QR CODE / eVERIFY SECTION */}
                      {u.qr_payload && (
                        <div className="bg-sky-50 p-3 rounded-lg border border-sky-200 space-y-2">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-700 flex items-center gap-1.5">
                            <QrCode className="w-3.5 h-3.5" /> QR Code Decoded from ID Back
                          </span>

                          {/* QR Image Crop + Payload row */}
                          <div className="flex gap-3">
                            {u.qr_image_data_url && (
                              <div className="shrink-0">
                                <div className="w-16 h-16 rounded-lg overflow-hidden border border-sky-200 bg-white">
                                  <img src={u.qr_image_data_url} alt="QR Crop" className="w-full h-full object-contain" />
                                </div>
                              </div>
                            )}
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="bg-white rounded border border-sky-200 p-2 text-xs font-mono text-slate-700 break-all max-h-20 overflow-y-auto">
                                {u.qr_payload}
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                <button
                                  onClick={() => handleCopyQrPayload(u.qr_payload!)}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-white hover:bg-sky-100 text-sky-700 border border-sky-200 rounded text-[10px] font-semibold transition cursor-pointer"
                                >
                                  <Copy className="w-3 h-3" /> Copy
                                </button>
                                <a
                                  href="https://everify.gov.ph"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-sky-600 hover:bg-sky-500 text-white border border-sky-600 rounded text-[10px] font-semibold transition no-underline"
                                >
                                  <ExternalLink className="w-3 h-3" /> Verify on eVerify.gov.ph
                                </a>
                              </div>
                            </div>
                          </div>

                          {/* eVerify Result Badge or Action Buttons */}
                          <div className="flex items-center gap-2 pt-1">
                            {u.everify_status === 'passed' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700">
                                <Check className="w-3 h-3" /> eVerify Passed
                              </span>
                            ) : u.everify_status === 'failed' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-red-50 border border-red-200 text-red-700">
                                <X className="w-3 h-3" /> eVerify Failed
                              </span>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-slate-500 font-medium">Mark result:</span>
                                <button
                                  onClick={() => handleEverifyPassed(u.id, u.full_name)}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold transition cursor-pointer"
                                >
                                  <Check className="w-3 h-3" /> Passed
                                </button>
                                <button
                                  onClick={() => handleEverifyFailed(u.id, u.full_name)}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-[10px] font-bold transition cursor-pointer"
                                >
                                  <X className="w-3 h-3" /> Failed
                                </button>
                              </div>
                            )}
                            {u.everify_notes && (
                              <span className="text-[10px] text-slate-500 italic ml-1 truncate" title={u.everify_notes}>
                                Note: {u.everify_notes}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                    </div>

                    {/* Manual Actions */}
                    <div className="grid grid-cols-2 gap-3 pt-3">
                      <button
                        onClick={() => handleRejectID(u.id, u.full_name)}
                        className="py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <XCircle className="w-4 h-4" /> Reject ID
                      </button>
                      <button
                        onClick={() => handleApproveID(u.id, u.full_name)}
                        className="py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Approve ID
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg p-12 text-center space-y-3 shadow-sm">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h3 className="text-xl font-bold text-slate-900">National ID Queue Clean!</h3>
              <p className="text-slate-500 text-sm">No pending National ID or biometric audit items in queue.</p>
            </div>
          )}

          {/* Authenticated Users */}
          <div className="pt-8 border-t border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" /> Authenticated Users ({verifiedUsers.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {verifiedUsers.map((v) => (
                <div key={v.id} className="bg-white p-4 rounded-lg border border-slate-200 flex items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <img src={v.avatar_url} alt={v.full_name} className="w-10 h-10 rounded-full object-cover" />
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-slate-700 truncate">{v.full_name}</h4>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        National ID Verified ✓
                      </span>
                    </div>
                  </div>
                  {renderFaceMatchBadge(v.face_match_score, v.face_match_status)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TRUST & SAFETY */}
      {activeTab === 'trust_safety' && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
            <button onClick={() => setTsTab('reports')} className={`px-4 py-2 rounded-lg font-bold text-xs transition cursor-pointer ${tsTab === 'reports' ? 'bg-primary text-white' : 'text-slate-500 hover:text-slate-900'}`}>
              <Flag className="w-3.5 h-3.5 inline mr-1.5" />Reported Reviews ({reports.filter(r => r.status === 'pending').length})
            </button>
            <button onClick={() => setTsTab('appeals')} className={`px-4 py-2 rounded-lg font-bold text-xs transition cursor-pointer ${tsTab === 'appeals' ? 'bg-primary text-white' : 'text-slate-500 hover:text-slate-900'}`}>
              <Scale className="w-3.5 h-3.5 inline mr-1.5" />Restriction Appeals ({appeals.filter(a => a.status === 'pending').length})
            </button>
          </div>

          {tsTab === 'reports' && (
            <div className="space-y-4">
              {reports.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-lg p-12 text-center space-y-3">
                  <Flag className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-sm text-slate-500 font-semibold">No reported reviews</p>
                </div>
              ) : (
                reports.map((rpt: any) => {
                  const review = store.getReviewById(rpt.review_id);
                  const reporter = store.getUsers().find((u: Profile) => u.id === rpt.reporter_id);
                  const reviewee = review ? store.getUsers().find((u: Profile) => u.id === review.reviewee_id) : null;
                  return (
                    <div key={rpt.id} className="bg-white border border-slate-200 rounded-lg p-5 space-y-3 shadow-sm">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-900">Report by {reporter?.full_name || 'Unknown'}</p>
                          <p className="text-xs text-slate-500">Review of {reviewee?.full_name || 'Unknown'} &middot; {new Date(rpt.created_at).toLocaleString()}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          rpt.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          rpt.status === 'resolved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}>{rpt.status}</span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-sm text-slate-700">
                        <span className="font-semibold text-slate-900">Reason: </span>{rpt.reason}
                      </div>
                      {review && (
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-600">
                          <span className="font-semibold text-slate-900">Review content: </span>
                          Rating: {review.rating}/5 &middot; {review.comment || 'No comment'}
                        </div>
                      )}
                      {rpt.status === 'pending' && (
                        <div className="flex gap-2">
                          <button onClick={() => { store.updateReportStatus(rpt.id, 'resolved', currentUser.id); toast.success('Report marked as resolved'); }}
                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Uphold Report
                          </button>
                          <button onClick={() => { store.updateReportStatus(rpt.id, 'dismissed', currentUser.id); toast.success('Report dismissed'); }}
                            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1">
                            <X className="w-3.5 h-3.5" /> Dismiss
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {tsTab === 'appeals' && (
            <div className="space-y-4">
              {appeals.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-lg p-12 text-center space-y-3">
                  <Scale className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-sm text-slate-500 font-semibold">No restriction appeals</p>
                </div>
              ) : (
                appeals.map((apl) => {
                  const user = store.getUsers().find((u: Profile) => u.id === apl.user_id);
                  return (
                    <div key={apl.id} className="bg-white border border-slate-200 rounded-lg p-5 space-y-3 shadow-sm">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <img src={user?.avatar_url || ''} alt="" className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                          <div>
                            <p className="font-bold text-slate-900 text-sm">{user?.full_name || 'Unknown'}</p>
                            <p className="text-xs text-slate-500">{user?.email} &middot; {new Date(apl.created_at).toLocaleString()}</p>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          apl.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          apl.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          'bg-red-50 text-red-700 border border-red-200'
                        }`}>{apl.status}</span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-sm text-slate-700">
                        <span className="font-semibold text-slate-900">Appeal Reason: </span>{apl.reason}
                      </div>
                      <div className="bg-red-50 p-3 rounded-lg border border-red-200 text-xs text-red-700">
                        <span className="font-semibold">Restriction: </span>{user?.restriction_reason || 'N/A'}
                      </div>
                      {apl.status === 'pending' && (
                        <div className="flex gap-2">
                          <button onClick={() => { store.updateAppealStatus(apl.id, 'approved', currentUser.id); store.reinstateUser(apl.user_id); toast.success('Appeal approved, user reinstated'); }}
                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Approve & Reinstate
                          </button>
                          <button onClick={() => { store.updateAppealStatus(apl.id, 'denied', currentUser.id); toast.success('Appeal denied'); }}
                            className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" /> Deny
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: REVIEW DISPUTE QUEUE */}
      {activeTab === 'disputes' && (
        <div className="space-y-6">
          {underReviewDisputes.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Disputes with Dual Consent Granted ({underReviewDisputes.length})
                </h3>
                {underReviewDisputes.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleInspectDispute(c)}
                    className={`w-full p-4 rounded-lg border text-left transition-all cursor-pointer ${
                      selectedDisputeConv?.id === c.id
                        ? 'bg-primary/5 border-primary shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={c.listing?.image_url}
                        alt="Item"
                        className="w-12 h-12 rounded-lg object-cover border border-slate-200"
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-sm text-slate-900 truncate">{c.listing?.title}</h4>
                        <p className="text-xs text-slate-500">
                          Buyer: {c.buyer?.full_name} | Seller: {c.seller?.full_name}
                        </p>
                        <span className="inline-block mt-2 text-[10px] font-extrabold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                          DUAL CONSENT GRANTED ✓
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-6 space-y-6 shadow-sm flex flex-col justify-between min-h-[500px]">
                {selectedDisputeConv ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                      <div>
                        <span className="text-xs font-bold text-primary uppercase tracking-wider">
                          Official Compliance Transcript Audit
                        </span>
                        <h3 className="text-lg font-extrabold text-slate-900">
                          {selectedDisputeConv.listing?.title}
                        </h3>
                      </div>
                      <button
                        onClick={() => handleResolveDispute(selectedDisputeConv.id)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Mark Dispute Resolved
                      </button>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3 max-h-96 overflow-y-auto">
                      {disputeMessages.map((msg) => (
                        <div key={msg.id} className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span className="font-bold text-primary">{msg.sender?.full_name}</span>
                            <span>{new Date(msg.created_at).toLocaleString()}</span>
                          </div>
                          {msg.image_url && (
                            <img src={msg.image_url} alt="Attachment" className="w-32 h-24 object-cover rounded-lg my-1 border border-slate-200" />
                          )}
                          <p className="text-slate-700 text-sm leading-relaxed">{msg.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="m-auto text-center space-y-2 text-slate-500">
                    <Eye className="w-10 h-10 mx-auto text-primary" />
                    <p className="text-sm font-semibold">Select a dispute from the left to audit the chat transcript.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg p-12 text-center space-y-3 shadow-sm">
              <ShieldCheck className="w-12 h-12 text-primary mx-auto" />
              <h3 className="text-xl font-bold text-slate-900">No Active Dispute Appeals</h3>
              <p className="text-slate-500 text-sm max-w-md mx-auto">
                Disputes appear here only when BOTH Buyer and Seller independently click "Grant Consent" in the Messenger Inbox.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
