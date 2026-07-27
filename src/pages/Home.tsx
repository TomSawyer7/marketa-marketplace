import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingBag, SlidersHorizontal, Sparkles, PlusCircle } from 'lucide-react';
import type { Category, Listing, Profile } from '../types/marketplace';
import { store } from '../lib/supabase';
import { ListingCard } from '../components/ListingCard';
import { SellModal } from '../components/SellModal';
import { toast } from 'sonner';

interface HomeProps {
  searchQuery: string;
  selectedCategory: Category | 'All';
  setSelectedCategory: (cat: Category | 'All') => void;
}

export const Home: React.FC<HomeProps> = ({
  searchQuery,
  selectedCategory,
  setSelectedCategory
}) => {
  const [currentUser, setCurrentUser] = useState<Profile>(store.getCurrentUser());
  const [listings, setListings] = useState<Listing[]>(store.getListings());
  const [sortBy, setSortBy] = useState<'newest' | 'price_low' | 'price_high'>('newest');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
      setListings(store.getListings());
    });
    return () => unsubscribe();
  }, []);

  const filteredListings = useMemo(() => {
    return listings.filter((item) => {
      if (selectedCategory !== 'All' && item.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesDesc = item.description.toLowerCase().includes(q);
        const matchesLoc = item.location.toLowerCase().includes(q);
        const matchesCat = item.category.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesLoc && !matchesCat) return false;
      }
      if (minPrice && item.price < parseFloat(minPrice)) return false;
      if (maxPrice && item.price > parseFloat(maxPrice)) return false;
      return true;
    }).sort((a, b) => {
      if (sortBy === 'price_low') return a.price - b.price;
      if (sortBy === 'price_high') return b.price - a.price;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [listings, selectedCategory, searchQuery, minPrice, maxPrice, sortBy]);

  const handleSellClick = () => {
    if (currentUser.verification_status === 'verified' || currentUser.role === 'admin') {
      setIsSellModalOpen(true);
    } else {
      toast.error('ID Verification Required', {
        description: 'Verify your ID in the portal before creating a listing.'
      });
    }
  };

  return (
    <main className="min-h-[calc(100vh-6rem)] bg-slate-50 pb-16">
      <div className="bg-white border-b border-slate-200 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" /> Next-Gen C2C Marketplace
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Buy & Sell with Verified Trust
            </h1>
            <p className="text-slate-500 text-sm max-w-xl">
              Marketa pairs Facebook Marketplace speed with strict ID verification and Dual-Consent dispute resolution for maximum user protection.
            </p>
          </div>

          <button
            onClick={handleSellClick}
            className="px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white font-semibold text-sm flex items-center gap-2 transition cursor-pointer"
          >
            <PlusCircle className="w-5 h-5" />
            <span>+ List New Item</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6 bg-white p-4 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-500">
              Filter ({filteredListings.length} items)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
              <span className="text-slate-400 font-medium">$</span>
              <input
                type="number"
                placeholder="Min"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="w-14 bg-transparent text-slate-700 placeholder-slate-400 focus:outline-none"
              />
              <span className="text-slate-300">-</span>
              <span className="text-slate-400 font-medium">$</span>
              <input
                type="number"
                placeholder="Max"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-14 bg-transparent text-slate-700 placeholder-slate-400 focus:outline-none"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-white border border-slate-200 text-slate-700 text-xs font-medium rounded-lg px-3 py-2 focus:outline-none focus:border-primary cursor-pointer"
            >
              <option value="newest">Sort: Newest First</option>
              <option value="price_low">Price: Low to High</option>
              <option value="price_high">Price: High to Low</option>
            </select>
          </div>
        </div>

        {filteredListings.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {filteredListings.map((item) => (
              <ListingCard key={item.id} listing={item} currentUser={currentUser} />
            ))}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg p-12 text-center space-y-4">
            <div className="w-14 h-14 bg-slate-100 rounded-lg flex items-center justify-center mx-auto text-slate-400">
              <ShoppingBag className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No items match your query</h3>
            <p className="text-slate-500 text-sm max-w-md mx-auto">
              Try adjusting your category selection, search terms, or price range filters.
            </p>
            <button
              onClick={() => { setSelectedCategory('All'); setMinPrice(''); setMaxPrice(''); }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition cursor-pointer"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      <SellModal isOpen={isSellModalOpen} onClose={() => setIsSellModalOpen(false)} currentUser={currentUser} />
    </main>
  );
};
