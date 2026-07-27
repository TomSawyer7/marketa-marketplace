import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ShoppingBag,
  Search,
  PlusCircle,
  MessageSquare,
  Menu,
  X,
  LayoutList,
  Car,
  Home,
  Smartphone,
  Shirt,
  Sofa,
  Gamepad2,
  Dumbbell,
  type LucideIcon,
} from 'lucide-react';
import type { Category, Profile } from '../types/marketplace';
import { store } from '../lib/supabase';
import { SellModal } from './SellModal';
import { AvatarDropdown } from './AvatarDropdown';
import { toast } from 'sonner';

interface NavbarProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedCategory: Category | 'All';
  setSelectedCategory: (cat: Category | 'All') => void;
}

interface CategoryItem {
  key: Category | 'All';
  label: string;
  icon: LucideIcon;
}

const CATEGORIES: CategoryItem[] = [
  { key: 'All', label: 'All', icon: LayoutList },
  { key: 'Vehicles', label: 'Vehicles', icon: Car },
  { key: 'Rentals', label: 'Rentals', icon: Home },
  { key: 'Electronics', label: 'Electronics', icon: Smartphone },
  { key: 'Clothing', label: 'Clothing', icon: Shirt },
  { key: 'Home', label: 'Home', icon: Sofa },
  { key: 'Toys', label: 'Toys', icon: Gamepad2 },
  { key: 'Sports', label: 'Sports', icon: Dumbbell },
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
  const [dropdownOpen, setDropdownOpen] = useState(false);

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

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 gap-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 group shrink-0">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <span className="text-lg font-bold tracking-tight text-slate-900">
                Marketa
              </span>
            </Link>
          </div>

          <div className="hidden md:flex flex-1 max-w-lg mx-auto">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search Marketa"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-full pl-10 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/inbox"
              className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg transition ${
                location.pathname === '/inbox'
                  ? 'text-primary'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Inbox"
            >
              <MessageSquare className="w-5 h-5" />
              <span className="text-[9px] font-medium leading-none">Inbox</span>
            </Link>

            <button
              onClick={handleSellClick}
              className="px-3 py-1.5 rounded-full bg-primary hover:bg-primary-dark text-white font-semibold text-xs flex items-center gap-1.5 transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">+ Sell</span>
            </button>

            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-9 h-9 rounded-full overflow-hidden border-2 border-slate-200 hover:border-primary transition cursor-pointer"
              >
                <img
                  src={currentUser.avatar_url}
                  alt={currentUser.full_name}
                  className="w-full h-full object-cover"
                />
              </button>
              <AvatarDropdown
                currentUser={currentUser}
                isOpen={dropdownOpen}
                onClose={() => setDropdownOpen(false)}
              />
            </div>

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
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search Marketa"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-full pl-10 pr-4 py-2 text-sm text-slate-900"
              />
            </div>
          </div>
        )}
      </div>

      {/* Category Pill Row */}
      <div className="bg-slate-50 border-t border-slate-200 py-2 px-4 overflow-x-auto no-scrollbar">
        <div className="max-w-7xl mx-auto flex items-center gap-2">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.key;
            const Icon = cat.icon;
            return (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
                  isSelected
                    ? 'bg-primary text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {cat.label}
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
