import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, MapPin, MessageSquare, AlertCircle } from 'lucide-react';
import type { Listing, Profile } from '../types/marketplace';
import { store } from '../lib/supabase';
import { toast } from 'sonner';

interface ListingCardProps {
  listing: Listing;
  currentUser: Profile;
}

export const ListingCard: React.FC<ListingCardProps> = ({ listing, currentUser }) => {
  const navigate = useNavigate();
  const seller = listing.seller;
  const isSellerVerified = seller?.verification_status === 'verified' || seller?.role === 'admin';

  const handleMessageSeller = () => {
    if (currentUser.id === listing.seller_id) {
      toast.info("This is your own listing", { description: "You cannot message yourself." });
      return;
    }
    try {
      const conv = store.startOrCreateConversation(listing.id, currentUser.id);
      navigate(`/inbox?convId=${conv.id}`);
    } catch (err: any) {
      toast.error("Could not start conversation", { description: err.message || "An unexpected error occurred." });
    }
  };

  return (
    <div onClick={() => navigate('/listing/' + listing.id)} className="group bg-white border border-slate-200 rounded-lg overflow-hidden hover:shadow-md transition-all flex flex-col cursor-pointer">
      <div className="relative aspect-[4/3] w-full bg-slate-100 overflow-hidden">
        <img
          src={listing.image_url}
          alt={listing.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        <span className="absolute top-2 left-2 bg-white/90 backdrop-blur text-primary text-xs font-semibold px-2 py-0.5 rounded border border-slate-200">
          {listing.category}
        </span>
        <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur px-2 py-0.5 rounded border border-slate-200">
          <span className="text-sm font-bold text-slate-900">
            ${listing.price.toLocaleString('en-US', { minimumFractionDigits: 0 })}
          </span>
        </div>
        {listing.status !== 'active' && (
          <span className="absolute top-2 right-2 bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded border border-amber-200">
            {listing.status === 'pending_deal' ? 'Pending' : 'Sold'}
          </span>
        )}
      </div>

      <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
        <div>
          <h3 className="font-semibold text-slate-900 text-sm line-clamp-1 group-hover:text-primary transition-colors">
            {listing.title}
          </h3>
          <p className="text-slate-500 text-xs mt-0.5 line-clamp-2 leading-relaxed">
            {listing.description}
          </p>
        </div>

        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{listing.location}</span>
          </div>

          <div className="flex items-center justify-between gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
            <div className="flex items-center gap-2 min-w-0">
              <img
                src={seller?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
                alt={seller?.full_name || 'Seller'}
                className="w-6 h-6 rounded-full object-cover border border-slate-200 flex-shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-700 truncate">
                  {seller?.full_name || 'Anonymous Seller'}
                </p>
                <div className="flex items-center gap-1">
                  {isSellerVerified ? (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-600">
                      <ShieldCheck className="w-3 h-3" /> Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-slate-400">
                      <AlertCircle className="w-3 h-3" /> Unverified
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleMessageSeller}
            disabled={currentUser.id === listing.seller_id}
            className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
              currentUser.id === listing.seller_id
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-primary hover:bg-primary-dark text-white cursor-pointer'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            {currentUser.id === listing.seller_id ? 'Your Listing' : 'Message Seller'}
          </button>
        </div>
      </div>
    </div>
  );
};
