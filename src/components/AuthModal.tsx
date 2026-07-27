import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Lock, Mail, User, ShieldCheck, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react';
import { signUpWithEmail, signInWithEmail, sendPasswordReset } from '../lib/supabase';
import { toast } from 'sonner';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'signup' | 'login';
}

type View = 'signup' | 'login' | 'forgot' | 'forgot_sent';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialTab = 'signup' }) => {
  const navigate = useNavigate();
  const [view, setView] = useState<View>(initialTab);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const clearError = () => setFormError('');

  const mapSignUpError = (msg: string): string => {
    if (msg.includes('rate') || msg.includes('Rate') || msg.includes('too many')) {
      return 'Too many attempts. Please wait a moment and try again.';
    }
    if (msg.includes('already registered') || msg.includes('already been registered')) {
      return 'An account with this email already exists. Try logging in.';
    }
    if (msg.includes('Password should be at least') || msg.toLowerCase().includes('password')) {
      return 'Password must be at least 6 characters.';
    }
    if (msg.includes('valid email') || msg.includes('invalid')) {
      return 'Please enter a valid email address.';
    }
    return msg;
  };

  const mapLoginError = (msg: string): string => {
    if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
      return 'Wrong email or password. Please try again.';
    }
    if (msg.includes('Email not confirmed')) {
      return 'Please confirm your email address before logging in. Check your inbox.';
    }
    return msg;
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault(); clearError();
    if (!fullName.trim()) { setFormError('Full name is required.'); return; }
    if (!email.trim()) { setFormError('Email address is required.'); return; }
    if (!password) { setFormError('Password is required.'); return; }
    if (password.length < 6) { setFormError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      const { user, error } = await signUpWithEmail(email.trim(), password, fullName.trim());
      if (error) { setFormError(mapSignUpError(error)); return; }
      if (user) {
        toast.success('Account created!', { description: 'Complete National ID verification to start trading.' });
        onClose(); navigate('/verify-id');
      }
    } catch (err: any) { setFormError(err.message || 'An unexpected error occurred.');
    } finally { setLoading(false); }
  };

  const handleLogIn = async (e: React.FormEvent) => {
    e.preventDefault(); clearError();
    if (!email.trim()) { setFormError('Email address is required.'); return; }
    if (!password) { setFormError('Password is required.'); return; }
    setLoading(true);
    try {
      const { user, error } = await signInWithEmail(email.trim(), password);
      if (error) { setFormError(mapLoginError(error)); return; }
      if (user) {
        toast.success(`Welcome back, ${user.full_name}!`);
        onClose();
        navigate(user.verification_status === 'verified' || user.role === 'admin' ? '/' : '/verify-id');
      }
    } catch (err: any) { setFormError(err.message || 'An unexpected error occurred.');
    } finally { setLoading(false); }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault(); clearError();
    if (!email.trim()) { setFormError('Please enter your email address.'); return; }
    setLoading(true);
    try {
      const { error } = await sendPasswordReset(email.trim());
      if (error) { setFormError(error); return; }
      setView('forgot_sent');
    } catch (err: any) { setFormError(err.message || 'Failed to send reset email.');
    } finally { setLoading(false); }
  };

  const switchTab = (tab: 'signup' | 'login') => { setView(tab); clearError(); setPassword(''); };

  const inputCls = 'w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-lg p-6 sm:p-8 shadow-xl space-y-6">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer">
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" /> ID-Verified C2C Marketplace
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            {view === 'forgot' || view === 'forgot_sent' ? 'Reset Password' : 'Join Marketa'}
          </h2>
          <p className="text-xs text-slate-500">
            {view === 'signup' ? 'Create an account and verify your National ID to access live trading.'
              : view === 'login' ? 'Log in to your account to access your messages and listings.'
              : view === 'forgot' ? "Enter your email and we'll send you a reset link."
              : 'Check your inbox for the reset link.'}
          </p>
        </div>

        {(view === 'signup' || view === 'login') && (
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-lg text-xs font-semibold">
            <button type="button" onClick={() => switchTab('signup')}
              className={`py-2 rounded-md transition cursor-pointer ${view === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>
              Sign Up
            </button>
            <button type="button" onClick={() => switchTab('login')}
              className={`py-2 rounded-md transition cursor-pointer ${view === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>
              Log In
            </button>
          </div>
        )}

        {view === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input type="text" required placeholder="e.g. Sarah Jenkins" value={fullName}
                  onChange={(e) => { setFullName(e.target.value); clearError(); }} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input type="email" required placeholder="name@example.com" value={email}
                  onChange={(e) => { setEmail(e.target.value); clearError(); }} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password *</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input type="password" required placeholder="Min. 6 characters" value={password}
                  onChange={(e) => { setPassword(e.target.value); clearError(); }} className={inputCls} />
              </div>
            </div>
            {formError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-primary hover:bg-primary-dark disabled:opacity-60 text-white font-semibold rounded-lg text-sm transition flex items-center justify-center gap-2 cursor-pointer">
              <span>{loading ? 'Creating account...' : 'Create Account & Verify National ID'}</span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        )}

        {view === 'login' && (
          <form onSubmit={handleLogIn} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input type="email" required placeholder="name@example.com" value={email}
                  onChange={(e) => { setEmail(e.target.value); clearError(); }} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password *</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input type="password" required placeholder="........" value={password}
                  onChange={(e) => { setPassword(e.target.value); clearError(); }} className={inputCls} />
              </div>
            </div>
            {formError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-primary hover:bg-primary-dark disabled:opacity-60 text-white font-semibold rounded-lg text-sm transition flex items-center justify-center gap-2 cursor-pointer">
              <span>{loading ? 'Signing in...' : 'Log In to Account'}</span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
            <div className="text-center">
              <button type="button" onClick={() => { setView('forgot'); clearError(); }}
                className="text-xs text-primary hover:text-primary-dark underline underline-offset-2 transition cursor-pointer">
                Forgot password?
              </button>
            </div>
          </form>
        )}

        {view === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input type="email" required placeholder="name@example.com" value={email}
                  onChange={(e) => { setEmail(e.target.value); clearError(); }} className={inputCls} />
              </div>
            </div>
            {formError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-primary hover:bg-primary-dark disabled:opacity-60 text-white font-semibold rounded-lg text-sm transition flex items-center justify-center gap-2 cursor-pointer">
              <span>{loading ? 'Sending...' : 'Send Reset Link'}</span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
            <div className="text-center">
              <button type="button" onClick={() => { setView('login'); clearError(); }}
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 transition cursor-pointer">
                <ArrowLeft className="w-3 h-3" /> Back to Log In
              </button>
            </div>
          </form>
        )}

        {view === 'forgot_sent' && (
          <div className="space-y-4 text-center">
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-emerald-500" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-900">Check your inbox</p>
              <p className="text-xs text-slate-500">
                We sent a password reset link to <span className="text-slate-700 font-medium">{email}</span>.
                <br />Click the link in the email to set a new password.
              </p>
            </div>
            <button type="button" onClick={() => { setView('login'); clearError(); setPassword(''); }}
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary-dark transition cursor-pointer">
              <ArrowLeft className="w-3 h-3" /> Back to Log In
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
