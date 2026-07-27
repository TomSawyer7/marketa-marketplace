import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, Star, ShoppingBag, Send, Lock } from 'lucide-react';
import { store } from '../lib/supabase';
import type { Profile, Conversation, ReviewTag, ReviewToken } from '../types/marketplace';
import { toast } from 'sonner';

const ALL_TAGS: { value: ReviewTag; label: string; positive: boolean }[] = [
  { value: 'fast_shipper', label: 'Fast Shipper', positive: true },
  { value: 'good_communication', label: 'Good Communication', positive: true },
  { value: 'item_as_described', label: 'Item as Described', positive: true },
  { value: 'fair_price', label: 'Fair Price', positive: true },
  { value: 'friendly', label: 'Friendly', positive: true },
  { value: 'late_delivery', label: 'Late Delivery', positive: false },
  { value: 'item_not_as_described', label: 'Item Not as Described', positive: false },
  { value: 'poor_communication', label: 'Poor Communication', positive: false },
];

export const Transactions: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = store.getCurrentUser();
  const [transactions, setTransactions] = useState<Conversation[]>([]);
  const [reviewModal, setReviewModal] = useState<{ conv: Conversation; reviewee: Profile; token: ReviewToken } | null>(null);
  const [reviewTitle, setReviewTitle] = useState('');
  const [rating, setRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<ReviewTag[]>([]);
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (currentUser.id) {
      setTransactions(store.getTransactionsForUser(currentUser.id));
    }
  }, [currentUser.id]);

  const handleConfirm = (conv: Conversation) => {
    store.confirmTransaction(conv.id);
    toast.success('Purchase confirmed! Review window is now open for 30 days.');
    setTransactions(prev => prev.map(c => c.id === conv.id ? { ...c, status: 'completed' as const } : c));
  };

  const openReview = (conv: Conversation) => {
    const token = store.getValidReviewTokenForTransaction(currentUser.id, conv.id);
    if (!token) {
      toast.error('Review token expired or already used.');
      return;
    }
    const reviewee = conv.buyer_id === currentUser.id ? conv.seller : conv.buyer;
    if (!reviewee) return;
    setReviewModal({ conv, reviewee, token });
    setReviewTitle('');
    setRating(0);
    setSelectedTags([]);
    setComment('');
  };

  const submitReview = () => {
    if (!reviewModal || rating === 0) {
      toast.error('Please select a star rating');
      return;
    }
    const { conv, reviewee, token } = reviewModal;
    const result = store.addReview(conv.listing_id, currentUser.id, reviewee.id, rating, selectedTags, comment, reviewTitle || undefined, token.id);
    if (!result) {
      toast.error('Review token expired or invalid.');
      setReviewModal(null);
      return;
    }
    toast.success('Review submitted!');
    setReviewModal(null);
  };

  const toggleTag = (tag: ReviewTag) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const pendingConfirmation = transactions.filter(c => c.status === 'marked_done' && c.buyer_id === currentUser.id);
  const awaitingMe = transactions.filter(c => c.status === 'marked_done' && c.seller_id === currentUser.id);
  const completed = transactions.filter(c => c.status === 'completed');

  const getDaysLeft = (conv: Conversation): number => {
    if (!conv.review_window_expires_at) return 0;
    const diff = new Date(conv.review_window_expires_at).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 text-slate-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <ShoppingBag className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-extrabold text-slate-900">My Transactions</h1>
        </div>

        {pendingConfirmation.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2"><Clock className="w-4 h-4 text-amber-500" /> Awaiting Your Confirmation</h2>
            {pendingConfirmation.map(conv => (
              <div key={conv.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 shadow-sm">
                <img src={conv.listing?.image_url} alt="" className="w-16 h-16 rounded-xl object-cover border border-slate-200" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 text-sm truncate">{conv.listing?.title}</h3>
                  <p className="text-xs text-slate-500">Seller: {conv.seller?.full_name} — ₱{conv.listing?.price}</p>
                </div>
                <button onClick={() => handleConfirm(conv)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Confirm Purchase
                </button>
              </div>
            ))}
          </section>
        )}

        {awaitingMe.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2"><Clock className="w-4 h-4 text-slate-400" /> Waiting for Buyer</h2>
            {awaitingMe.map(conv => (
              <div key={conv.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 shadow-sm opacity-70">
                <img src={conv.listing?.image_url} alt="" className="w-16 h-16 rounded-xl object-cover border border-slate-200" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 text-sm truncate">{conv.listing?.title}</h3>
                  <p className="text-xs text-slate-500">Buyer: {conv.buyer?.full_name} — waiting for confirmation</p>
                </div>
              </div>
            ))}
          </section>
        )}

        {completed.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Completed</h2>
            {completed.map(conv => {
              const reviewee = conv.buyer_id === currentUser.id ? conv.seller : conv.buyer;
              const token = store.getValidReviewTokenForTransaction(currentUser.id, conv.id);
              const alreadyReviewed = !token;
              const daysLeft = getDaysLeft(conv);
              return (
                <div key={conv.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 shadow-sm">
                  <img src={conv.listing?.image_url} alt="" className="w-16 h-16 rounded-xl object-cover border border-slate-200" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 text-sm truncate">{conv.listing?.title}</h3>
                    <p className="text-xs text-slate-500">{conv.buyer_id === currentUser.id ? 'Seller' : 'Buyer'}: {reviewee?.full_name}</p>
                    {token && daysLeft > 0 && (
                      <p className="text-[10px] text-amber-600 font-medium mt-0.5">{daysLeft} days left to review</p>
                    )}
                    {token && daysLeft === 0 && (
                      <p className="text-[10px] text-red-500 font-medium mt-0.5">Review window expired</p>
                    )}
                  </div>
                  {token && daysLeft > 0 ? (
                    <button onClick={() => openReview(conv)} className="px-4 py-2 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5">
                      <Star className="w-4 h-4" /> Leave Review
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                      {alreadyReviewed ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Lock className="w-3.5 h-3.5" />}
                      {alreadyReviewed ? 'Reviewed' : 'Expired'}
                    </span>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {transactions.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3 shadow-sm">
            <ShoppingBag className="w-12 h-12 text-slate-200 mx-auto" />
            <h3 className="text-lg font-bold text-slate-900">No Transactions Yet</h3>
            <p className="text-sm text-slate-500">When sellers mark items as sold, they will appear here for confirmation and review.</p>
            <button onClick={() => navigate('/')} className="text-primary text-sm underline cursor-pointer">Browse Listings</button>
          </div>
        )}
      </div>

      {reviewModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setReviewModal(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <img src={reviewModal.reviewee.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
              <div>
                <h3 className="font-bold text-slate-900">Rate {reviewModal.reviewee.full_name}</h3>
                <p className="text-xs text-slate-500">{reviewModal.conv.listing?.title}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 justify-center py-2">
              {[1, 2, 3, 4, 5].map(s => (
                <button key={s} onClick={() => setRating(s)} className="cursor-pointer transition hover:scale-110">
                  <Star className={`w-8 h-8 ${s <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                </button>
              ))}
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-700 mb-1">Review Title (optional)</p>
              <input
                type="text"
                value={reviewTitle}
                onChange={e => setReviewTitle(e.target.value)}
                placeholder="e.g. Helpful, Great seller, Fast delivery..."
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-700 mb-2">Tags (optional)</p>
              <div className="flex flex-wrap gap-1.5">
                {ALL_TAGS.map(tag => (
                  <button key={tag.value} onClick={() => toggleTag(tag.value)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition cursor-pointer ${
                      selectedTags.includes(tag.value)
                        ? tag.positive ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-700 mb-1">Comment (optional)</p>
              <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3}
                className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                placeholder="Share your experience..." />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setReviewModal(null)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition cursor-pointer">Cancel</button>
              <button onClick={submitReview} className="flex-1 py-2.5 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 cursor-pointer">
                <Send className="w-4 h-4" /> Submit Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
