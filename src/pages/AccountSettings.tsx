import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Moon, Sun, Key, ChevronLeft, Camera, LogOut } from 'lucide-react';
import { store, supabase, signOut } from '../lib/supabase';
import type { Profile } from '../types/marketplace';
import { toast } from 'sonner';

const BIO_MAX = 280;

export const AccountSettings: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = store.getCurrentUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<Profile>(currentUser);
  const [avatarPreview, setAvatarPreview] = useState(currentUser.avatar_url);
  const [location, setLocation] = useState(currentUser.location || '');
  const [bio, setBio] = useState(currentUser.bio || '');
  const [saving, setSaving] = useState(false);

  const [notifNewMsg, setNotifNewMsg] = useState(() => localStorage.getItem('notif_new_msg') !== 'false');
  const [notifDispute, setNotifDispute] = useState(() => localStorage.getItem('notif_dispute') !== 'false');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const saveProfile = async (updates: Partial<Profile>) => {
    setSaving(true);
    const merged = { ...profile, ...updates };
    store.upsertUser(merged);
    setProfile(merged);
    const { error } = await supabase
      .from('profiles')
      .update({ location: merged.location ?? null, bio: merged.bio ?? null, avatar_url: merged.avatar_url })
      .eq('id', profile.id);
    setSaving(false);
    if (error) {
      toast.error('Failed to save: ' + error.message);
      return false;
    }
    return true;
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB');
      return;
    }
    setSaving(true);
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `avatars/${profile.id}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadErr) {
      toast.error('Upload failed: ' + uploadErr.message);
      setSaving(false);
      return;
    }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const publicUrl = urlData.publicUrl;
    setAvatarPreview(publicUrl);
    store.upsertUser({ ...profile, avatar_url: publicUrl });
    setProfile(prev => ({ ...prev, avatar_url: publicUrl }));
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', profile.id);
    setSaving(false);
    toast.success('Avatar updated');
  };

  const handleSaveLocation = async () => {
    const ok = await saveProfile({ location: location || undefined });
    if (ok) toast.success('Location saved');
  };

  const handleSaveBio = async () => {
    const ok = await saveProfile({ bio: bio || undefined });
    if (ok) toast.success('Bio saved');
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 text-slate-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition cursor-pointer">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Account settings</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage your profile, notifications, and privacy.</p>
        </div>

        {/* ──── PROFILE CARD ──── */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-900">Profile</h2>
            <p className="text-xs text-slate-400 mt-0.5">This is how other people see you on Marketa.</p>
          </div>

          {/* Avatar + Change Photo */}
          <div className="flex items-center gap-4 mb-6">
            <img
              src={avatarPreview}
              alt=""
              className="w-16 h-16 rounded-full object-cover border-2 border-slate-200"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={saving}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-semibold text-slate-700 transition cursor-pointer flex items-center gap-2"
            >
              <Camera className="w-4 h-4" /> Change photo
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>

          {/* Name + Email (read-only) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Display name</label>
              <input
                type="text"
                value={profile.full_name}
                disabled
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-500 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Email</label>
              <input
                type="email"
                value={profile.email}
                disabled
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-500 cursor-not-allowed"
              />
            </div>
          </div>

          {/* Location (editable) */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Location</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="e.g. Makati, Metro Manila"
                className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
              <button
                onClick={handleSaveLocation}
                disabled={saving || location === (profile.location || '')}
                className="px-4 py-2 bg-primary hover:bg-primary-dark disabled:bg-slate-300 text-white font-semibold rounded-lg text-sm transition cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>

          {/* Bio (editable) */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Bio</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value.slice(0, BIO_MAX))}
              rows={3}
              maxLength={BIO_MAX}
              placeholder="Tell buyers a little about yourself."
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary resize-none"
            />
            <div className="flex justify-between items-center mt-1">
              <span className="text-[10px] text-slate-400">{bio.length}/{BIO_MAX}</span>
              <button
                onClick={handleSaveBio}
                disabled={saving || bio === (profile.bio || '')}
                className="px-4 py-2 bg-primary hover:bg-primary-dark disabled:bg-slate-300 text-white font-semibold rounded-lg text-sm transition cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>

        {/* ──── NOTIFICATIONS ──── */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" /> Notifications
            </h2>
          </div>
          <div className="px-6 py-4 space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-slate-600">Email me about new messages</span>
              <input
                type="checkbox" checked={notifNewMsg}
                onChange={e => { setNotifNewMsg(e.target.checked); localStorage.setItem('notif_new_msg', String(e.target.checked)); }}
                className="toggle toggle-primary"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-slate-600">Email me about dispute updates</span>
              <input
                type="checkbox" checked={notifDispute}
                onChange={e => { setNotifDispute(e.target.checked); localStorage.setItem('notif_dispute', String(e.target.checked)); }}
                className="toggle toggle-primary"
              />
            </label>
          </div>
        </div>

        {/* ──── THEME ──── */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Theme</p>
                <p className="text-xs text-slate-400">{theme === 'dark' ? 'Dark mode' : 'Light mode'}</p>
              </div>
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-semibold transition cursor-pointer flex items-center gap-2"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                {theme === 'dark' ? 'Light' : 'Dark'}
              </button>
            </div>
          </div>
        </div>

        {/* ──── SECURITY ──── */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              <Key className="w-4 h-4 text-primary" /> Security
            </h2>
          </div>
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Change Password</p>
                <p className="text-xs text-slate-400">Update your account password</p>
              </div>
              <button
                onClick={() => setShowPasswordForm(!showPasswordForm)}
                className="text-xs text-primary font-semibold hover:underline cursor-pointer"
              >
                {showPasswordForm ? 'Cancel' : 'Change'}
              </button>
            </div>
            {showPasswordForm && (
              <form
                onSubmit={async e => {
                  e.preventDefault();
                  if (pwNew !== pwConfirm) { toast.error('New passwords do not match'); return; }
                  if (pwNew.length < 6) { toast.error('Password must be at least 6 characters'); return; }
                  setChangingPassword(true);
                  const { error } = await supabase.auth.updateUser({ password: pwNew });
                  setChangingPassword(false);
                  if (error) { toast.error(error.message); return; }
                  toast.success('Password updated successfully');
                  setShowPasswordForm(false);
                  setPwNew('');
                  setPwConfirm('');
                }}
                className="mt-4 space-y-3 bg-slate-50 rounded-xl p-4 border border-slate-200"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">New Password</label>
                  <input type="password" value={pwNew} onChange={e => setPwNew(e.target.value)} required minLength={6}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Confirm New Password</label>
                  <input type="password" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} required minLength={6}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" />
                </div>
                <button type="submit" disabled={changingPassword}
                  className="w-full py-2 bg-primary hover:bg-primary-dark disabled:bg-slate-300 text-white font-semibold rounded-lg text-sm transition cursor-pointer flex items-center justify-center gap-2"
                >
                  {changingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* ──── SIGN OUT ──── */}
        <div className="pt-4 border-t border-slate-200">
          <button
            onClick={() => {
              if (confirm('Are you sure you want to sign out?')) {
                signOut().then(() => navigate('/'));
              }
            }}
            className="w-full py-3 flex items-center justify-center gap-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-sm font-bold transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>

      </div>
    </div>
  );
};
