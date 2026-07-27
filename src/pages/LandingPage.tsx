import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowRight, ChevronLeft, ChevronRight, ShieldCheck, Lock, Plus, Loader2 } from 'lucide-react';
import { fetchPublicListings } from '../lib/supabase';
import { AuthModal } from '../components/AuthModal';
import type { Profile, Listing } from '../types/marketplace';

interface LandingPageProps {
  currentUser?: Profile | null;
}

export const LandingPage: React.FC<LandingPageProps> = ({ currentUser }) => {
  const navigate = useNavigate();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'signin' | 'signup'>('signup');
  const [searchQuery, setSearchQuery] = useState('');
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPublicListings().then((data) => {
      if (!cancelled) {
        setListings(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const isUnverifiedUser = currentUser && currentUser.verification_status !== 'verified' && currentUser.role !== 'admin';

  const handleGuardAction = () => {
    if (!currentUser) {
      setAuthModalTab('signup');
      setIsAuthModalOpen(true);
    } else if (currentUser.verification_status !== 'verified' && currentUser.role !== 'admin') {
      navigate('/verify-id');
    }
  };

  const handleOpenSignup = () => {
    setAuthModalTab('signup');
    setIsAuthModalOpen(true);
  };

  const handleOpenSignin = () => {
    setAuthModalTab('signin');
    setIsAuthModalOpen(true);
  };

  const categories = ['Vehicles', 'Rentals', 'Electronics', 'Clothing', 'Home', 'Toys', 'Sports'];
  const quickPills = ["Women's clothes", "Beauty", "Men's clothes", "Kids clothes", "Hobbies"];

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans pb-16">
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialTab={authModalTab}
      />

      <header className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-8">
          <a href="/" className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white">
              <ShieldCheck className="w-4 h-4" />
            </div>
            MARKETA
          </a>
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-500">
            {categories.map((cat) => (
              <button key={cat} onClick={handleGuardAction} className="hover:text-slate-900 transition cursor-pointer">
                {cat}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleGuardAction}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 text-slate-600 text-xs font-medium transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Sell
          </button>
          {currentUser ? (
            <button
              onClick={() => navigate('/verify-id')}
              className="px-4 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              Verify ID
            </button>
          ) : (
            <>
              <button
                onClick={handleOpenSignup}
                className="px-4 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold transition cursor-pointer"
              >
                Sign up
              </button>
              <button
                onClick={handleOpenSignin}
                className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition cursor-pointer"
              >
                Log in
              </button>
            </>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-10">
        {isUnverifiedUser && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">National ID Verification Required</h3>
                <p className="text-xs text-slate-500 max-w-xl">
                  Welcome <strong>{currentUser.full_name}</strong>! Live marketplace listings and messaging require biometric National ID authentication.
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/verify-id')}
              className="px-5 py-2 bg-primary hover:bg-primary-dark text-white font-semibold rounded-lg text-xs transition shrink-0 cursor-pointer"
            >
              Verify National ID
            </button>
          </div>
        )}

        <section className="relative rounded-lg overflow-hidden min-h-[320px] sm:min-h-[400px] flex flex-col items-center justify-center p-6 sm:p-12 text-center bg-slate-900">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-20 pointer-events-none"
            style={{ backgroundImage: `url('https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=1600&auto=format&fit=crop&q=80')` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/80 to-slate-900/60 pointer-events-none" />

          <div className="relative z-10 max-w-3xl mx-auto space-y-6">
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Change your wardrobe. Find exciting goods.
            </h1>

            <div className="relative max-w-xl mx-auto bg-white rounded-lg p-1.5 shadow-lg flex items-center gap-2">
              <Search className="w-5 h-5 text-slate-400 ml-3 shrink-0" />
              <input
                type="text"
                placeholder="What are you looking for?"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleGuardAction(); }}
                className="w-full bg-transparent border-none focus:outline-none text-slate-900 text-sm placeholder-slate-400 px-2"
              />
              <button
                type="button"
                onClick={handleGuardAction}
                className="w-9 h-9 rounded-lg bg-primary hover:bg-primary-dark text-white flex items-center justify-center shrink-0 transition cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              {quickPills.map((pill) => (
                <button
                  key={pill}
                  onClick={handleGuardAction}
                  className="px-4 py-2 rounded-lg bg-white/90 hover:bg-white text-slate-700 text-xs font-medium shadow transition cursor-pointer border border-slate-200"
                >
                  {pill}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Listed recently</h2>
            <div className="flex items-center gap-1">
              <button onClick={handleGuardAction} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition cursor-pointer">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={handleGuardAction} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition cursor-pointer">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span className="text-sm">Loading listings...</span>
            </div>
          ) : listings.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {listings.map((item) => (
                <div
                  key={item.id}
                  onClick={handleGuardAction}
                  className="group bg-white border border-slate-200 rounded-lg overflow-hidden hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div className="relative aspect-square overflow-hidden bg-slate-100">
                    <img src={item.image_url} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute top-2 left-2 bg-white/90 backdrop-blur text-slate-900 text-xs font-bold px-2 py-0.5 rounded shadow-sm">
                      ₱{item.price}
                    </div>
                  </div>
                  <div className="p-3 space-y-1">
                    <h3 className="font-semibold text-slate-900 text-sm truncate">{item.title}</h3>
                    <p className="text-xs text-slate-500">{item.location || item.category}</p>
                    <div className="pt-1 flex items-center gap-1 text-[10px] font-semibold text-primary">
                      <ShieldCheck className="w-3 h-3" /> Verified
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-10 text-center">
              <p className="text-slate-500 text-sm">No listings available yet. Be the first to list an item!</p>
            </div>
          )}
        </section>

        <section className="bg-slate-900 rounded-lg p-8 text-white flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center sm:text-left">
            <span className="text-xs font-bold uppercase tracking-wider text-accent-light">
              Zero Fraud C2C Protocol
            </span>
            <h3 className="text-2xl font-bold">Safe, Biometrically Verified Local Trading</h3>
            <p className="text-xs text-slate-400 max-w-lg">
              Every seller and buyer on Marketa passes live webcam National ID extraction and face matching. No fake accounts or anonymous spammers.
            </p>
          </div>
          <button
            onClick={handleGuardAction}
            className="px-6 py-3 bg-primary hover:bg-primary-dark text-white font-bold text-xs rounded-lg transition shrink-0 cursor-pointer"
          >
            Get Verified & Start Trading
          </button>
        </section>
      </main>
    </div>
  );
};
