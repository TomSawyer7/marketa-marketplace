import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ShieldCheck, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

export const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setSessionReady(true);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError('');
    if (!password) { setFormError('Please enter a new password.'); return; }
    if (password.length < 6) { setFormError('Password must be at least 6 characters.'); return; }
    if (password !== confirmPassword) { setFormError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) { setFormError(error.message); return; }
      setDone(true);
      toast.success('Password updated! Please log in with your new password.');
      setTimeout(() => navigate('/'), 2000);
    } catch (err: any) { setFormError(err.message || 'Something went wrong.'); }
    finally { setLoading(false); }
  };

  const inputCls = 'w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition';

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-lg p-6 sm:p-8 shadow-lg space-y-6">
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" /> Marketa
          </div>
          <h1 className="text-xl font-bold text-slate-900">Set New Password</h1>
          <p className="text-xs text-slate-500">Choose a strong password for your account.</p>
        </div>

        {done ? (
          <div className="space-y-4 text-center">
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-emerald-500" />
              </div>
            </div>
            <p className="text-sm font-semibold text-slate-900">Password updated!</p>
            <p className="text-xs text-slate-500">Redirecting you to the app...</p>
          </div>
        ) : !sessionReady ? (
          <div className="space-y-4 text-center py-4">
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-amber-500" />
              </div>
            </div>
            <p className="text-sm text-slate-700">Verifying reset link...</p>
            <p className="text-xs text-slate-400">If this takes too long, go back to your email and click the link again.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">New Password *</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input type="password" required placeholder="Min. 6 characters" value={password}
                  onChange={(e) => { setPassword(e.target.value); setFormError(''); }} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm Password *</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input type="password" required placeholder="Repeat your new password" value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setFormError(''); }} className={inputCls} />
              </div>
            </div>
            {formError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-primary hover:bg-primary-dark disabled:opacity-60 text-white font-semibold rounded-lg text-sm transition flex items-center justify-center gap-2 cursor-pointer">
              <span>{loading ? 'Updating password...' : 'Set New Password'}</span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
