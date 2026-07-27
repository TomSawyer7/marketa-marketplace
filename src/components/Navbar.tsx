import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ShoppingBag,
  Search,
  PlusCircle,
  ShieldCheck,
  Clock,
  ShieldAlert,
  MessageSquare,
  Shield,
  Menu,
  X,
  ShoppingCart,
  User
} from 'lucide-react';
import type { Category, Profile } from '../types/marketplace';
import { store } from '../lib/supabase';
import { SellModal } from './SellModal';
import { toast } from 'sonner';

interface NavbarProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedCategory: Category | 'All';
  setSelectedCategory: (cat: Category | 'All') => void;
}

const CATEGORIES: (Category | 'All')[] = [
  'All',
  'Vehicles',
  'Rentals',
  'Electronics',
  'Clothing',
  'Home',
  'Toys',
  'Sports'
];

export const Navbar: React.FC<NavbarProps> = ({
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState<Profile>(store.getCurrentUser());
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
    });
    return () => unsubscribe();
  }, []);

  const handleSellClick = () => {
    if (currentUser.verification_status === 'verified' || currentUser.role === 'admin') {
      setIsSellModalOpen(true);
    } else if (currentUser.verification_status === 'pending') {
      toast.warning('Verification Pending Review', {
        description: 'Your ID document is under administrative review. You can create listings once verified.'
      });
      navigate('/verify-id');
    } else {
      toast.error('Identity Verification Required', {
        description: 'You must verify your government ID before selling items on Marketa.'
      });
      navigate('/verify-id');
    }
  };

  const renderVerificationBadge = () => {
    const status = currentUser.verification_status;
    if (status === 'verified') {
      return (
        <span
          title="Identity Verified"
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Verified</span>
        </span>
      );
    } else if (status === 'pending') {
      return (
        <Link
          to="/verify-id"
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition"
        >
          <Clock className="w-4 h-4 animate-pulse" />
          <span>Pending</span>
        </Link>
      );
    } else {
      return (
        <Link
          to="/verify-id"
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition"
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Verify ID</span>
        </Link>
      );
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 gap-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <span className="text-lg font-bold tracking-tight text-slate-900">
                MARKETA
              </span>
            </Link>
          </div>

          <div className="flex-1 max-w-md hidden md:block">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search marketplace items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              {renderVerificationBadge()}
            </div>

            <button
              onClick={handleSellClick}
              className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-dark text-white font-semibold text-xs flex items-center gap-1.5 transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">+ Sell</span>
            </button>

            <Link
              to="/inbox"
              className={`p-2 rounded-lg border transition ${
                location.pathname === '/inbox'
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300'
              }`}
              title="Messenger Inbox"
            >
              <MessageSquare className="w-4 h-4" />
            </Link>

            <Link
              to="/transactions"
              className={`p-2 rounded-lg border transition ${
                location.pathname === '/transactions'
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300'
              }`}
              title="My Transactions"
            >
              <ShoppingCart className="w-4 h-4" />
            </Link>

            {currentUser.role === 'admin' && (
              <Link
                to="/admin"
                className={`p-2 rounded-lg border transition ${
                  location.pathname === '/admin'
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300'
                }`}
                title="Admin Dashboard"
              >
                <Shield className="w-4 h-4" />
              </Link>
            )}

            <Link
              to={'/profile/' + currentUser.id}
              className={`p-2 rounded-lg border transition ${
                location.pathname.startsWith('/profile/')
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300'
              }`}
              title="My Profile"
            >
              <User className="w-4 h-4" />
            </Link>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-400 hover:text-slate-900 rounded-lg"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden py-3 border-t border-slate-200 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search marketplace items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-900"
              />
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Status:</span>
                {renderVerificationBadge()}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-slate-50 border-t border-slate-200 py-2 px-4 overflow-x-auto no-scrollbar">
        <div className="max-w-7xl mx-auto flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-2 flex-shrink-0">
            Categories:
          </span>
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition ${
                  isSelected
                    ? 'bg-primary text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      <SellModal
        isOpen={isSellModalOpen}
        onClose={() => setIsSellModalOpen(false)}
        currentUser={currentUser}
      />
    </header>
  );
};
