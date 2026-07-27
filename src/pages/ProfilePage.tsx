import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Star, Flag, ChevronLeft, AlertTriangle, Lock, ChevronDown, LogOut, CheckCircle2, XCircle } from 'lucide-react';
import { store, signOut } from '../lib/supabase';
import type { Profile, Review, ReviewTag } from '../types/marketplace';
import { toast } from 'sonner';

const TAG_LABELS: Record<ReviewTag, string> = {
  fast_shipper: 'Fast Shipper',
  good_communication: 'Good Communication',
  item_as_described: 'Item as Described',
  fair_price: 'Fair Price',
  friendly: 'Friendly',
  late_delivery: 'Late Delivery',
  item_not_as_described: 'Item Not as Described',
  poor_communication: 'Poor Communication'
};

const TAG_COLORS: Record<ReviewTag, string> = {
  fast_shipper: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  good_communication: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  item_as_described: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  fair_price: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  friendly: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  late_delivery: 'bg-red-50 border-red-200 text-red-700',
  item_not_as_described: 'bg-red-50 border-red-200 text-red-700',
  poor_communication: 'bg-red-50 border-red-200 text-red-700'
};

type SortMode = 'most_recent' | 'highest' | 'lowest';

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

export const ProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const currentUser = store.getCurrentUser();
  const [profile, setProfile] = useState<Profile | undefined>(store.getUsers().find(u => u.id === userId));
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState({ average: 0, count: 0 });
  const [distribution, setDistribution] = useState<{ [star: number]: number }>({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  const [sortMode, setSortMode] = useState<SortMode>('most_recent');
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportedReviewId, setReportedReviewId] = useState<string | null>(null);
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(new Set());
  const [validToken, setValidToken] = useState<boolean>(false);

  useEffect(() => {
    if (userId) {
      const p = store.getUsers().find(u => u.id === userId);
      setProfile(p);
      const userReviews = store.getReviewsForUser(userId);
      setReviews(userReviews);
      setAvgRating(store.getAverageRating(userId));
      setDistribution(store.getRatingDistribution(userId));
      if (currentUser.id && currentUser.id !== userId) {
        const tokens = store.getValidReviewTokensForUser(currentUser.id, userId);
        setValidToken(tokens.length > 0);
      }
    }
  }, [userId, currentUser.id]);

  const sortedReviews = useMemo(() => {
    const sorted = [...reviews];
    switch (sortMode) {
      case 'most_recent': return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case 'highest': return sorted.sort((a, b) => b.rating - a.rating);
      case 'lowest': return sorted.sort((a, b) => a.rating - b.rating);
    }
  }, [reviews, sortMode]);

  const totalRatings = Object.values(distribution).reduce((a, b) => a + b, 0);
  const maxDist = Math.max(...Object.values(distribution), 1);

  const handleReport = (reviewId: string) => {
    setReportedReviewId(reviewId);
    setShowReportModal(true);
  };

  const submitReport = () => {
    if (!reportReason.trim() || !reportedReviewId) return;
    store.addReport(reportedReviewId, currentUser.id, reportReason.trim());
    toast.success('Report submitted. Admin will review it.');
    setShowReportModal(false);
    setReportReason('');
    setReportedReviewId(null);
  };

  const toggleExpand = (reviewId: string) => {
    setExpandedReviews(prev => {
      const next = new Set(prev);
      next.has(reviewId) ? next.delete(reviewId) : next.add(reviewId);
      return next;
    });
  };

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500">User not found</p>
      </div>
    );
  }

  const isOwnProfile = currentUser.id === profile.id;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 text-slate-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-5">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition cursor-pointer">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        {profile.is_restricted && !isOwnProfile && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-sm text-red-700">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span className="font-semibold">Account Restricted</span>
          </div>
        )}

        {/* Profile Header */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-4">
            <img src={profile.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-slate-200" />
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-extrabold text-slate-900">{profile.full_name}</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${profile.verification_status === 'verified' || profile.role === 'admin' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                  {profile.verification_status === 'verified' || profile.role === 'admin' ? 'National ID Verified' : 'Unverified'}
                </span>
              </div>
            </div>
          </div>

          {/* Aggregate Rating Header - App Store Style */}
          <div className="flex flex-col sm:flex-row items-center gap-6 py-4 border-t border-slate-100">
            <div className="text-center">
              <div className="text-5xl font-black text-slate-900 tracking-tight">
                {avgRating.count > 0 ? avgRating.average.toFixed(1) : '—'}
              </div>
              <div className="flex items-center gap-0.5 justify-center mt-1.5">
                {[1, 2, 3, 4, 5].map(s => (
                  <Star key={s} className={`w-4 h-4 ${s <= Math.round(avgRating.average) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                ))}
              </div>
              <div className="text-xs text-slate-400 font-medium mt-1">
                {avgRating.count.toLocaleString()} {avgRating.count === 1 ? 'Rating' : 'Ratings'}
              </div>
            </div>

            {/* Rating Breakdown Bars */}
            <div className="flex-1 w-full max-w-xs space-y-1.5">
              {[5, 4, 3, 2, 1].map(star => (
                <div key={star} className="flex items-center gap-2 text-xs">
                  <span className="w-3 text-right text-slate-500 font-medium">{star}</span>
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full transition-all"
                      style={{ width: `${totalRatings > 0 ? (distribution[star] / maxDist) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-slate-400 tabular-nums">{distribution[star]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Logout */}
          {isOwnProfile && (
            <div className="border-t border-slate-100 pt-4">
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to sign out?')) {
                    signOut().then(() => navigate('/'));
                  }
                }}
                className="w-full py-2.5 flex items-center justify-center gap-2 rounded-xl border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 text-sm font-semibold transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          )}

          {/* Admin Verification Controls */}
          {currentUser.role === 'admin' && !isOwnProfile && (
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Admin Verification Controls</span>
                <button onClick={() => navigate('/admin')} className="text-[10px] text-primary font-semibold hover:underline cursor-pointer">View in Admin Panel →</button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${profile.verification_status === 'verified' || profile.role === 'admin' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : profile.verification_status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                  {profile.verification_status === 'verified' || profile.role === 'admin' ? 'Verified' : profile.verification_status === 'pending' ? 'Pending' : 'Unverified'}
                </span>
                {profile.face_match_status && profile.face_match_status !== 'not_run' && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${profile.face_match_status === 'passed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : profile.face_match_status === 'needs_review' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    Face Match: {profile.face_match_status} ({profile.face_match_score})
                  </span>
                )}
                {profile.liveness_check_passed && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
                    Liveness Passed
                  </span>
                )}
                {profile.everify_status && profile.everify_status !== 'none' && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${profile.everify_status === 'passed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    eVerify: {profile.everify_status}
                  </span>
                )}
              </div>

              {profile.verification_status === 'pending' && (
                <div className="flex gap-2">
                  <button onClick={() => { store.updateProfileVerification(profile.id, 'verified'); toast.success('Identity Verified'); setProfile(prev => prev ? { ...prev, verification_status: 'verified' } : prev); }}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approve ID
                  </button>
                  <button onClick={() => { store.updateProfileVerification(profile.id, 'rejected'); toast.success('Verification Rejected'); setProfile(prev => prev ? { ...prev, verification_status: 'rejected' } : prev); }}
                    className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> Reject ID
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Locked CTA - App Store Style */}
          {!isOwnProfile && currentUser.id && currentUser.role !== 'admin' && (
            <div className="border-t border-slate-100 pt-4">
              {validToken ? (
                <button
                  onClick={() => navigate('/transactions')}
                  className="w-full py-3 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Star className="w-4 h-4 fill-white" /> Tap to Rate & Write a Review
                </button>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center space-y-2">
                  <Lock className="w-5 h-5 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-400 font-medium">
                    You can only rate users you have successfully transacted with.
                  </p>
                  <p className="text-[10px] text-slate-300">
                    Complete a verified transaction to unlock ratings.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Reviews Section - App Store Style */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-900">Reviews</h2>
            <div className="relative">
              <select
                value={sortMode}
                onChange={e => setSortMode(e.target.value as SortMode)}
                className="appearance-none bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-8 py-1.5 text-xs font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
              >
                <option value="most_recent">Most Recent</option>
                <option value="highest">Highest Rated</option>
                <option value="lowest">Lowest Rated</option>
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {sortedReviews.length === 0 ? (
            <div className="p-10 text-center">
              <Star className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400 font-medium">No Reviews Yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {sortedReviews.map(review => {
                const reviewer = store.getUsers().find(u => u.id === review.reviewer_id);
                const listing = store.getListings().find(l => l.id === review.listing_id);
                const isExpanded = expandedReviews.has(review.id);
                const shouldTruncate = review.comment.length > 120;

                return (
                  <div key={review.id} className="px-6 py-5 space-y-3">
                    {/* Title + Stars Row */}
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        {review.title && (
                          <h4 className="font-bold text-slate-900 text-sm leading-tight">{review.title}</h4>
                        )}
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map(s => (
                            <Star key={s} className={`w-3.5 h-3.5 ${s <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                          ))}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-semibold text-slate-900">{reviewer?.full_name || 'Unknown'}</p>
                        <p className="text-[10px] text-slate-400">{relativeTime(review.created_at)}</p>
                      </div>
                    </div>

                    {/* Tags */}
                    {review.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {review.tags.map(tag => (
                          <span key={tag} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${TAG_COLORS[tag] || 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                            {TAG_LABELS[tag] || tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Review Body with Read More */}
                    {review.comment && (
                      <div>
                        <p className="text-sm text-slate-600 leading-relaxed">
                          {shouldTruncate && !isExpanded ? review.comment.slice(0, 120) + '...' : review.comment}
                        </p>
                        {shouldTruncate && (
                          <button onClick={() => toggleExpand(review.id)} className="text-xs text-primary font-semibold mt-1 hover:underline cursor-pointer">
                            {isExpanded ? 'Show Less' : 'Read More'}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Listing Context + Report */}
                    <div className="flex items-center justify-between pt-1">
                      {listing && (
                        <span className="text-[10px] text-slate-400 italic">on {listing.title}</span>
                      )}
                      {!isOwnProfile && currentUser.id && (
                        <button onClick={() => handleReport(review.id)} className="text-[10px] text-slate-300 hover:text-red-500 flex items-center gap-1 transition cursor-pointer">
                          <Flag className="w-3 h-3" /> Report
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowReportModal(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-slate-900 flex items-center gap-2"><Flag className="w-5 h-5 text-red-500" /> Report Review</h3>
            <textarea value={reportReason} onChange={e => setReportReason(e.target.value)} rows={4}
              className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
              placeholder="Why are you reporting this review?" />
            <div className="flex gap-3">
              <button onClick={() => setShowReportModal(false)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition cursor-pointer">Cancel</button>
              <button onClick={submitReport} disabled={!reportReason.trim()} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:bg-slate-300 text-white font-bold rounded-xl text-sm transition cursor-pointer disabled:cursor-not-allowed">Submit Report</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
