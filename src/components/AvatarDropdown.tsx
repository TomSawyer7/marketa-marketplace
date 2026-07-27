import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Receipt, Settings, Shield, LogOut } from 'lucide-react';
import type { Profile } from '../types/marketplace';
import { signOut } from '../lib/supabase';

interface AvatarDropdownProps {
  currentUser: Profile;
  isOpen: boolean;
  onClose: () => void;
}

export const AvatarDropdown: React.FC<AvatarDropdownProps> = ({ currentUser, isOpen, onClose }) => {
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleNav = (path: string) => {
    onClose();
    navigate(path);
  };

  const handleLogout = () => {
    onClose();
    signOut().then(() => navigate('/'));
  };

  return (
    <div ref={ref} className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100">
        <p className="text-sm font-bold text-slate-900 truncate">{currentUser.full_name}</p>
        <p className="text-xs text-slate-400 truncate">{currentUser.email}</p>
      </div>

      {/* Menu Items */}
      <div className="py-1">
        <button
          onClick={() => handleNav(`/profile/${currentUser.id}`)}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition cursor-pointer"
        >
          <User className="w-4 h-4 text-slate-400" />
          <span>Profile</span>
        </button>
        <button
          onClick={() => handleNav('/transactions')}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition cursor-pointer"
        >
          <Receipt className="w-4 h-4 text-slate-400" />
          <span>Transactions</span>
        </button>
        <button
          onClick={() => handleNav('/account-settings')}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition cursor-pointer"
        >
          <Settings className="w-4 h-4 text-slate-400" />
          <span>Settings</span>
        </button>
        {currentUser.role === 'admin' && (
          <button
            onClick={() => handleNav('/admin')}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            <Shield className="w-4 h-4 text-slate-400" />
            <span>Admin</span>
          </button>
        )}
      </div>

      {/* Divider + Logout */}
      <div className="border-t border-slate-100 py-1">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span className="font-medium">Log out</span>
        </button>
      </div>
    </div>
  );
};
