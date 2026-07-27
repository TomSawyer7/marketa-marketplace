import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Star, ChevronLeft, AlertTriangle, Lock, CheckCircle2, XCircle, MapPin, Share2, Plus, Settings } from 'lucide-react';
import { store } from '../lib/supabase';
import { SellModal } from '../components/SellModal';
import type { Profile, Category } from '../types/marketplace';
import { toast } from 'sonner';

const CATEGORY_LABELS: Record<Category, string> = {
  Vehicles: 'vehicles',
  Rentals: 'rentals',
  Electronics: 'electronics',
  Clothing: 'clothing',
  Home: 'home',
  Toys: 'toys',
  Sports: 'sports',
};

export const ProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const currentUser = store.getCurrentUser();
  const [profile, setProfile] = useState<Profile | undefined>(store.getUsers().find(u => u.id === userId));
  const [avgRating, setAvgRating] = useState({ average: 0, count: 0 });
  const [distribution, setDistribution] = useState<{ [star: number]: number }>({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  const [validToken, setValidToken] = useState<boolean>(false);
  const [showSellModal, setShowSellModal] = useState(false);

  useEffect(() => {
    if (userId) {
      const p = store.getUsers().find(u => u.id === userId);
      setProfile(p);
      setAvgRating(store.getAverageRating(userId));
      setDistribution(store.getRatingDistribution(userId));
      if (currentUser.id && currentUser.id !== userId) {
        const tokens = store.getValidReviewTokensForUser(currentUser.id, userId);
        setValidToken(tokens.length > 0);
      }
    }
  }, [userId, currentUser.id]);

  const totalRatings = Object.values(distribution).reduce((a, b) => a + b, 0);
  const maxDist = Math.max(...Object.values(distribution), 1);

  const userListings = useMemo(() => {
    if (!profile) return [];
    return store.getListings().filter(l => l.seller_id === profile.id);
  }, [profile?.id]);

  const activeListings = userListings.filter(l => l.status === 'active').length;
  const successfulTransactions = userListings.filter(l => l.status === 'sold').length;

  const topCategory = useMemo<Category | null>(() => {
    if (userListings.length === 0) return null;
    const counts: Record<string, number> = {};
    for (const l of userListings) {
      counts[l.category] = (counts[l.category] || 0) + 1;
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0] ? (sorted[0][0] as Category) : null;
  }, [userListings]);

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500">User not found</p>
      </div>
    );
  }

  const isOwnProfile = currentUser.id === profile.id;

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Profile link copied!');
  };

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

        {/* ──── PROFILE HEADER CARD ──── */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <img src={profile.avatar_url} alt="" className="w-20 h-20 rounded-full object-cover border-2 border-slate-200" />
            <button
              onClick={handleShare}
              className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition cursor-pointer"
              title="Share profile"
            >
              <Share2 className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          <h1 className="text-2xl font-extrabold text-slate-900">{profile.full_name}</h1>

          {profile.location && (
            <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
              <MapPin className="w-4 h-4" /> {profile.location}
            </p>
          )}

          {topCategory && (
            <span className="inline-block mt-2 px-3 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full capitalize">
              {CATEGORY_LABELS[topCategory]}
            </span>
          )}

          {profile.bio && (
            <p className="text-sm text-slate-600 mt-3">{profile.bio}</p>
          )}

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-4 mt-5 py-3 border-t border-slate-100">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Star className="w-4 h-4 fill-primary text-primary" />
                <span className="font-bold text-slate-900 text-lg">{avgRating.count > 0 ? avgRating.average.toFixed(1) : '—'}</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Rating</p>
            </div>
            <div className="text-center">
              <span className="font-bold text-slate-900 text-lg">{activeListings}</span>
              <p className="text-xs text-slate-400 mt-0.5">Listings</p>
            </div>
            <div className="text-center">
              <span className="font-bold text-slate-900 text-lg">{successfulTransactions}</span>
              <p className="text-xs text-slate-400 mt-0.5">Successful Transactions</p>
            </div>
          </div>

          {/* Action Buttons */}
          {isOwnProfile ? (
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={() => navigate('/account-settings')}
                className="flex-1 py-3 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl text-sm transition cursor-pointer flex items-center justify-center gap-2"
              >
                <Settings className="w-4 h-4" /> Edit profile
              </button>
              <button
                onClick={() => setShowSellModal(true)}
                className="w-12 h-12 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center transition cursor-pointer shrink-0"
                title="Create listing"
              >
                <Plus className="w-6 h-6 text-slate-600" />
              </button>
            </div>
          ) : (
            currentUser.id && currentUser.role !== 'admin' && (
              <div className="mt-4">
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
            )
          )}
        </div>

        {/* ──── RATINGS & REVIEWS ──── */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="font-bold text-slate-900 mb-4">Ratings & Reviews</h2>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="text-center shrink-0">
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
            <div className="flex-1 w-full max-w-xs space-y-0.5">
              {[5, 4, 3, 2, 1].map(star => (
                <div key={star} className="flex items-center gap-1.5 text-xs">
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
        </div>

        {/* ──────────── ADMIN VERIFICATION CONTROLS ──────────── */}
        {currentUser.role === 'admin' && !isOwnProfile && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Admin Verification Controls</span>
              <button onClick={() => navigate('/admin')} className="text-[10px] text-primary font-semibold hover:underline cursor-pointer">View in Admin Panel</button>
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

      </div>

      {/* Sell Modal */}
      <SellModal
        isOpen={showSellModal}
        onClose={() => setShowSellModal(false)}
        currentUser={profile}
        onSuccess={() => { setShowSellModal(false); toast.success('Listing created!'); }}
      />
    </div>
  );
};
