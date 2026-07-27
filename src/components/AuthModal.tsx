import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Mail, ShieldCheck, Eye, EyeOff, Loader2, Check, AlertCircle, ArrowLeft } from 'lucide-react';
import { supabase, store } from '../lib/supabase';
import type { Profile } from '../types/marketplace';
import { toast } from 'sonner';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'signin' | 'signup';
}

interface PasswordCriteria {
  label: string;
  test: (pw: string) => boolean;
}

const PASSWORD_CRITERIA: PasswordCriteria[] = [
  { label: 'At least 8 characters long', test: (pw) => pw.length >= 8 },
  { label: 'At least 1 uppercase letter (A-Z)', test: (pw) => /[A-Z]/.test(pw) },
  { label: 'At least 1 lowercase letter (a-z)', test: (pw) => /[a-z]/.test(pw) },
  { label: 'At least 1 number (0-9)', test: (pw) => /[0-9]/.test(pw) },
  { label: 'At least 1 special character (!@#$%^&*)', test: (pw) => /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\]/.test(pw) },
];

function checkCriteria(pw: string): boolean[] {
  return PASSWORD_CRITERIA.map((c) => c.test(pw));
}

async function initProfile(authUserId: string, email: string): Promise<Profile | null> {
  const { data: existing } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authUserId)
    .maybeSingle();
  if (existing) return existing as Profile;
  const fallbackName = email.split('@')[0] || 'User';
  const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(fallbackName)}`;
  const { data: userData } = await supabase.auth.getUser();
  const roleFromMeta: string | undefined = userData?.user?.user_metadata?.role;
  const newRole = roleFromMeta === 'admin' ? 'admin' : 'user';
  const profile: Profile = {
    id: authUserId, email, full_name: fallbackName, avatar_url: avatarUrl,
    role: newRole,
    verification_status: (newRole === 'admin' ? 'verified' : 'unverified') as Profile['verification_status'],
    created_at: '',
  };
  await supabase.from('profiles').insert({ ...profile, created_at: undefined }).maybeSingle();
  return profile;
}

function gotoAfterAuth(profile: Profile | null, navigate: ReturnType<typeof useNavigate>, onClose: () => void) {
  if (!profile) { onClose(); return; }
  store.upsertUser(profile);
  store.setCurrentUser(profile.id);
  onClose();
  navigate(profile.verification_status === 'verified' || profile.role === 'admin' ? '/' : '/verify-id');
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialTab = 'signin' }) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signin' | 'signup'>(initialTab);
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState<string[]>(Array(8).fill(''));
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const startCooldown = () => setCooldown(60);

  useEffect(() => {
    if (!isOpen) {
      setMode(initialTab);
      setStep('form');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setShowConfirm(false);
      setFormError('');
      setLoading(false);
      setOtp(Array(8).fill(''));
      setResending(false);
      setCooldown(0);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (step === 'otp') {
      inputRefs.current[0]?.focus();
    }
  }, [step]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const criteriaMet = useMemo(() => checkCriteria(password), [password]);
  const allCriteriaMet = criteriaMet.every(Boolean);
  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;

  const reset = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirm(false);
    setFormError('');
    setOtp(Array(8).fill(''));
    setResending(false);
    setCooldown(0);
  };

  const switchMode = (newMode: 'signin' | 'signup') => {
    setMode(newMode);
    setStep('form');
    reset();
  };

  const setOtpChar = (index: number, char: string) => {
    if (!/^\d*$/.test(char)) return;
    const next = [...otp];
    next[index] = char.slice(0, 1);
    setOtp(next);
    if (char && index < 7) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 8);
    const next = [...otp];
    for (let i = 0; i < text.length; i++) {
      next[i] = text[i];
    }
    setOtp(next);
    const focusIdx = Math.min(text.length, 7);
    inputRefs.current[focusIdx]?.focus();
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const trimmed = email.trim();
    if (!trimmed || !password) { setFormError('Please enter your email and password.'); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: trimmed, password });
      if (error) { const msg = error.message || 'An error occurred'; setFormError(msg); return; }
      const authUser = data.user;
      if (!authUser) { setFormError('Sign in succeeded but no user returned.'); return; }
      const profile = await initProfile(authUser.id, authUser.email ?? trimmed);
      if (profile) toast.success(`Welcome back${profile.full_name ? ', ' + profile.full_name.split(' ')[0] : ''}!`);
      gotoAfterAuth(profile, navigate, onClose);
    } catch (err: any) {
      const errMsg = err.message || 'An error occurred'; setFormError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const trimmed = email.trim();
    if (!trimmed) { setFormError('Please enter your email address.'); return; }
    if (!allCriteriaMet) { setFormError('All password requirements must be met.'); return; }
    if (password !== confirmPassword) { setFormError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email: trimmed, password });
      if (error) { const msg = error.message || 'An error occurred'; setFormError(msg); return; }
      const authUser = data.user;
      if (!authUser) { setFormError('Account created but no user returned.'); return; }
      if (data.session) {
        const profile = await initProfile(authUser.id, authUser.email ?? trimmed);
        if (profile) toast.success(`Welcome${profile.full_name ? ', ' + profile.full_name.split(' ')[0] : ''}!`);
        gotoAfterAuth(profile, navigate, onClose);
      } else {
        setStep('otp');
        startCooldown();
        toast.success('Confirm your email', { description: `An 8-digit code was sent to ${trimmed}` });
      }
    } catch (err: any) {
      const errMsg = err.message || 'An error occurred'; setFormError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerify = async () => {
    setFormError('');
    const code = otp.join('');
    if (code.length !== 8) { setFormError('Please enter the complete 8-digit code.'); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code,
        type: 'signup',
      });
      if (error) { const msg = error.message || 'An error occurred'; setFormError(msg); return; }
      const authUser = data.user;
      if (!authUser) { setFormError('Verification succeeded but no user returned.'); return; }
      const profile = await initProfile(authUser.id, authUser.email ?? email.trim());
      if (profile) toast.success(`Welcome${profile.full_name ? ', ' + profile.full_name.split(' ')[0] : ''}!`);
      gotoAfterAuth(profile, navigate, onClose);
    } catch (err: any) {
      const errMsg = err.message || 'An error occurred'; setFormError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setResending(true);
    setFormError('');
    try {
      const { error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) { const msg = error.message || 'An error occurred'; setFormError(msg); return; }
      await supabase.auth.signInWithOtp({ email: email.trim() });
      startCooldown();
      toast.success('Code resent!');
    } catch (err: any) {
      const errMsg = err.message || 'An error occurred'; setFormError(errMsg);
    } finally { setResending(false); }
  };

  const handleBackToForm = () => {
    setStep('form');
    setOtp(Array(8).fill(''));
    setFormError('');
  };

  if (!isOpen) return null;

  const inputCls = 'w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-10 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition';
  const tabCls = (active: boolean) =>
    `flex-1 py-2 text-sm font-semibold rounded-lg transition cursor-pointer ${active ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`;
  const otpInputCls = 'w-9 h-12 text-center text-lg font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="relative w-full max-w-md bg-white shadow-xl rounded-2xl p-6 sm:p-8 space-y-5">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer">
          <X className="w-5 h-5" />
        </button>

        {step === 'form' && (
          <>
            <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
              <button type="button" onClick={() => switchMode('signin')} className={tabCls(mode === 'signin')}>Sign In</button>
              <button type="button" onClick={() => switchMode('signup')} className={tabCls(mode === 'signup')}>Create Account</button>
            </div>

            <div className="text-center space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" /> ID-Verified C2C Marketplace
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                {mode === 'signin' ? 'Welcome back' : 'Join Marketa'}
              </h2>
              <p className="text-xs text-slate-500">
                {mode === 'signin' ? 'Sign in to your account' : 'Create an account to start buying & selling'}
              </p>
            </div>

            <form onSubmit={mode === 'signin' ? handleSignIn : handleSignUp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input type="email" required placeholder="name@example.com" value={email}
                    onChange={(e) => { setEmail(e.target.value); setFormError(''); }} className={inputCls} autoFocus />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} required placeholder={mode === 'signin' ? 'Your password' : 'Create a password'}
                    value={password} onChange={(e) => { setPassword(e.target.value); setFormError(''); }}
                    className={inputCls} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition cursor-pointer">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Re-enter Password</label>
                  <div className="relative">
                    <input type={showConfirm ? 'text' : 'password'} required placeholder="Re-enter your password"
                      value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setFormError(''); }}
                      className={inputCls} />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition cursor-pointer">
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {mode === 'signup' && (
                <div className="space-y-1.5 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                  <p className="text-xs font-semibold text-slate-600 mb-1.5">Password requirements</p>
                  {PASSWORD_CRITERIA.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <Check className={`w-3.5 h-3.5 ${criteriaMet[i] ? 'text-green-600' : 'text-slate-400'}`} />
                      <span className={criteriaMet[i] ? 'text-green-700' : 'text-slate-500'}>{c.label}</span>
                    </div>
                  ))}
                  {confirmPassword.length > 0 && (
                    <div className="flex items-center gap-2 text-xs pt-1 border-t border-slate-200 mt-1.5">
                      {passwordsMatch ? (
                        <Check className="w-3.5 h-3.5 text-green-600" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                      )}
                      <span className={passwordsMatch ? 'text-green-700' : 'text-slate-500'}>
                        {passwordsMatch ? 'Passwords match' : 'Passwords must match'}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {formError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{String(formError)}</p>}

              <button type="submit" disabled={loading || (mode === 'signup' && (!allCriteriaMet || !passwordsMatch))}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold rounded-lg text-sm transition flex items-center justify-center gap-2 cursor-pointer">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>{loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
              </button>
            </form>

            {mode === 'signin' && (
              <p className="text-center text-xs text-slate-500">
                Don&apos;t have an account?{' '}
                <button type="button" onClick={() => switchMode('signup')} className="text-indigo-600 hover:text-indigo-700 font-semibold underline underline-offset-2 transition cursor-pointer">
                  Create one
                </button>
              </p>
            )}
            {mode === 'signup' && (
              <p className="text-center text-xs text-slate-500">
                Already have an account?{' '}
                <button type="button" onClick={() => switchMode('signin')} className="text-indigo-600 hover:text-indigo-700 font-semibold underline underline-offset-2 transition cursor-pointer">
                  Sign in
                </button>
              </p>
            )}
          </>
        )}

        {step === 'otp' && (
          <div className="space-y-5">
            <div className="text-center space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" /> ID-Verified C2C Marketplace
              </div>
              <h2 className="text-xl font-bold text-slate-900">Check your email</h2>
              <p className="text-xs text-slate-500">
                We sent a 8-digit code to <strong className="text-slate-700">{email}</strong>
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-3 text-center">Enter 8-digit code</label>
              <div className="flex items-center justify-center gap-2" onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text" inputMode="numeric" maxLength={1} value={digit}
                    onChange={(e) => setOtpChar(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className={otpInputCls}
                    autoComplete="one-time-code"
                  />
                ))}
              </div>
            </div>

            {formError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{String(formError)}</p>}

            <button onClick={handleOtpVerify} disabled={loading || otp.join('').length !== 8}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold rounded-lg text-sm transition flex items-center justify-center gap-2 cursor-pointer">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              <span>{loading ? 'Verifying...' : 'Verify & Continue'}</span>
            </button>

            <div className="flex items-center justify-center gap-4 text-xs">
              <button type="button" onClick={handleResendOtp} disabled={resending || cooldown > 0}
                className="text-indigo-600 hover:text-indigo-700 underline underline-offset-2 transition cursor-pointer disabled:opacity-50">
                {resending ? 'Resending...' : cooldown > 0 ? `Resend Code (${cooldown}s)` : 'Resend Code'}
              </button>
              <span className="text-slate-300">|</span>
              <button type="button" onClick={handleBackToForm}
                className="text-slate-500 hover:text-slate-900 underline underline-offset-2 transition cursor-pointer flex items-center gap-1">
                <ArrowLeft className="w-3 h-3" /> Back to Sign Up
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
