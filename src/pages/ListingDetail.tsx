import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, CheckCircle2, UserCheck, MapPin, Clock, ShoppingBag } from 'lucide-react';
import { store } from '../lib/supabase';
import type { Profile, Listing, Conversation } from '../types/marketplace';
import { toast } from 'sonner';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export const ListingDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentUser = store.getCurrentUser();
  const [listing, setListing] = useState<Listing | undefined>(store.getListingById(id || ''));
  const [showSoldModal, setShowSoldModal] = useState(false);
  const [selectedBuyerId, setSelectedBuyerId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    if (id) {
      const l = store.getListingById(id);
      setListing(l);
      if (l) {
        setConversations(store.getConversationsForListing(id));
      }
    }
  }, [id]);

  if (!listing) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto" />
          <p className="text-slate-500 font-semibold">Listing not found</p>
          <button onClick={() => navigate('/')} className="text-primary text-sm underline cursor-pointer">Back to Marketplace</button>
        </div>
      </div>
    );
  }

  const isSeller = currentUser.id === listing.seller_id;
  const hasSold = listing.status === 'sold';

  const conversationBuyers = conversations
    .filter(c => c.status !== 'completed')
    .map(c => c.buyer)
    .filter((b): b is Profile => !!b && b.id !== currentUser.id);

  const uniqueBuyers = conversationBuyers.filter((b, i, arr) => arr.findIndex(x => x.id === b.id) === i);

  const handleMarkAsSold = () => {
    if (!selectedBuyerId) {
      toast.error('Please select a buyer');
      return;
    }
    const conv = conversations.find(c => c.buyer_id === selectedBuyerId);
    store.updateListingStatus(listing.id, 'pending_deal', selectedBuyerId);
    if (conv) {
      store.updateTransactionStatus(conv.id, 'marked_done');
    }
    toast.success('Marked as sold! Awaiting buyer confirmation.');
    setShowSoldModal(false);
    setListing(prev => prev ? { ...prev, status: 'pending_deal', buyer_id: selectedBuyerId } : prev);
  };

  const handleMessageSeller = () => {
    if (!currentUser.id) return;
    try {
      const conv = store.startOrCreateConversation(listing.id, currentUser.id);
      navigate(`/inbox?convId=${conv.id}`);
    } catch {
      toast.error('Could not start conversation');
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 text-slate-900">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <button onClick={() => navigate('/')} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> Back to Marketplace
        </button>

        {currentUser.is_restricted && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 flex items-center gap-2">
            <span className="font-bold">Account Restricted:</span> {currentUser.restriction_reason || 'Your account has been restricted.'}
            <button onClick={() => navigate('/profile/' + currentUser.id)} className="ml-auto underline text-xs cursor-pointer">Appeal</button>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <div className="relative h-72 sm:h-96 bg-slate-200">
            <img src={listing.image_url} alt={listing.title} className="w-full h-full object-cover" />
            {hasSold && (
              <div className="absolute top-4 right-4 bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" /> Sold
              </div>
            )}
            {listing.status === 'pending_deal' && (
              <div className="absolute top-4 right-4 bg-amber-500 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2">
                <Clock className="w-5 h-5" /> Pending Confirmation
              </div>
            )}
          </div>

          <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{listing.title}</h1>
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {listing.location}</span>
                  <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {new Date(listing.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="text-3xl font-black text-primary">₱{listing.price.toLocaleString('en-US', { minimumFractionDigits: 0 })}</div>
            </div>

            <div className="flex items-center gap-3">
              {listing.seller && (
                <button onClick={() => navigate('/profile/' + listing.seller_id)} className="flex items-center gap-2 group cursor-pointer">
                  <img src={listing.seller.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-slate-200" />
                  <div className="text-left">
                    <p className="font-semibold text-slate-900 group-hover:text-primary transition text-sm">{listing.seller.full_name}</p>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${listing.seller.verification_status === 'verified' || listing.seller.role === 'admin' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {listing.seller.verification_status === 'verified' || listing.seller.role === 'admin' ? 'Verified' : 'Unverified'}
                    </span>
                  </div>
                </button>
              )}
            </div>

            <div>
              <h3 className="font-bold text-slate-900 mb-2">Description</h3>
              <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{listing.description}</p>
            </div>

            {listing.latitude && listing.longitude && (
              <div>
                <h3 className="font-bold text-slate-900 mb-2">Location</h3>
                <div className="rounded-lg overflow-hidden border border-slate-200 h-[200px]">
                  <MapContainer center={[listing.latitude, listing.longitude]} zoom={14} className="h-full w-full" scrollWheelZoom={false} dragging={false} zoomControl={false}>
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={[listing.latitude, listing.longitude]} />
                  </MapContainer>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-200">
              {!isSeller && currentUser.id && (
                <button onClick={handleMessageSeller} className="px-6 py-2.5 bg-primary hover:bg-primary-dark text-white font-bold rounded-lg text-sm transition flex items-center gap-2 cursor-pointer">
                  <MessageSquare className="w-4 h-4" /> Message Seller
                </button>
              )}

              {isSeller && !hasSold && listing.status === 'active' && (
                <button onClick={() => setShowSoldModal(true)} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-sm transition flex items-center gap-2 cursor-pointer">
                  <CheckCircle2 className="w-4 h-4" /> Mark as Sold
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showSoldModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowSoldModal(false)}>
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-primary" /> Select Buyer
            </h3>
            <p className="text-xs text-slate-500">Choose the buyer who is purchasing this item.</p>

            {uniqueBuyers.length === 0 ? (
              <p className="text-sm text-slate-400 italic py-4 text-center">No active conversations yet. Buyers will appear here once they message you.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {uniqueBuyers.map(buyer => (
                  <button key={buyer.id} onClick={() => setSelectedBuyerId(buyer.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition cursor-pointer ${
                      selectedBuyerId === buyer.id ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <img src={buyer.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                    <div className="text-left">
                      <p className="font-semibold text-sm text-slate-900">{buyer.full_name}</p>
                      <p className="text-xs text-slate-500">{buyer.email}</p>
                    </div>
                    {selectedBuyerId === buyer.id && <CheckCircle2 className="w-5 h-5 text-primary ml-auto" />}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowSoldModal(false)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-sm transition cursor-pointer">Cancel</button>
              <button onClick={handleMarkAsSold} disabled={!selectedBuyerId} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 text-white font-bold rounded-lg text-sm transition cursor-pointer disabled:cursor-not-allowed">
                Confirm Sale
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
