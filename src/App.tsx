import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';
import { LandingPage } from './pages/LandingPage';
import { VerifyID } from './pages/VerifyID';
import { Inbox } from './pages/Inbox';
import { Admin } from './pages/Admin';
import { ResetPassword } from './pages/ResetPassword';
import { ListingDetail } from './pages/ListingDetail';
import { Transactions } from './pages/Transactions';
import { ProfilePage } from './pages/ProfilePage';
import { AccountSettings } from './pages/AccountSettings';
import { RestrictionBanner } from './components/RestrictionBanner';
import { store, supabase, initAuthListener } from './lib/supabase';
import type { Category, Profile, FaceMatchStatus } from './types/marketplace';

export function App() {
  const [currentUser, setCurrentUser] = useState<Profile | null>(store.getCurrentUserOrNull());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');

  useEffect(() => {
    const update = () => {
      setCurrentUser(store.getCurrentUserOrNull());
    };
    update();
    const unsubscribe = store.subscribe(update);
    initAuthListener();

    // Realtime: when admin approves user in another session, immediately
    // update the local profile so tier routing re-evaluates (no reload needed).
    const channel = supabase
      .channel('current-user-profile-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        async (payload) => {
          const uid = store.getCurrentUserOrNull()?.id;
          if (!uid || payload.new.id !== uid) return;
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', uid)
            .maybeSingle();
          if (data) {
            store.upsertUser({
              id: data.id,
              email: data.email ?? '',
              full_name: data.full_name ?? '',
              avatar_url: data.avatar_url ?? '',
              verification_status: (data.verification_status ?? 'unverified') as Profile['verification_status'],
              role: (data.role ?? 'user') as 'user' | 'admin',
              created_at: data.created_at ?? '',
              id_front_url: data.id_front_url ?? undefined,
              id_back_url: data.id_back_url ?? undefined,
              selfie_url: data.selfie_url ?? undefined,
              face_match_score: data.face_match_score ?? undefined,
              face_match_status: (data.face_match_status ?? 'not_run') as FaceMatchStatus,
              location: data.location ?? undefined,
              bio: data.bio ?? undefined
            });
          }
        }
      )
      .subscribe();

    return () => {
      unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  const isVerified = currentUser && (currentUser.verification_status === 'verified' || currentUser.role === 'admin');
  const isLoggedIn = !!currentUser;

  return (
    <Router>
      <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans">
        <Toaster position="top-right" theme="light" richColors />

        <Routes>
          <Route
            path="/"
            element={
              isVerified ? (
                <>
                  <Navbar
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    selectedCategory={selectedCategory}
                    setSelectedCategory={setSelectedCategory}
                  />
                  <RestrictionBanner />
                  <div className="flex-1">
                    <Home
                      searchQuery={searchQuery}
                      selectedCategory={selectedCategory}
                      setSelectedCategory={setSelectedCategory}
                    />
                  </div>
                </>
              ) : (
                <LandingPage currentUser={currentUser} />
              )
            }
          />

          <Route
            path="/listing/:id"
            element={
              <>
                <Navbar
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  selectedCategory={selectedCategory}
                  setSelectedCategory={setSelectedCategory}
                />
                <RestrictionBanner />
                <div className="flex-1">
                  <ListingDetail />
                </div>
              </>
            }
          />

          <Route
            path="/verify-id"
            element={
              isLoggedIn ? (
                <>
                  <Navbar
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    selectedCategory={selectedCategory}
                    setSelectedCategory={setSelectedCategory}
                  />
                  <RestrictionBanner />
                  <div className="flex-1">
                    <VerifyID />
                  </div>
                </>
              ) : (
                <Navigate to="/" replace />
              )
            }
          />

          <Route
            path="/inbox"
            element={
              isVerified ? (
                <>
                  <Navbar
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    selectedCategory={selectedCategory}
                    setSelectedCategory={setSelectedCategory}
                  />
                  <RestrictionBanner />
                  <div className="flex-1">
                    <Inbox />
                  </div>
                </>
              ) : (
                <Navigate to="/" replace />
              )
            }
          />

          <Route
            path="/transactions"
            element={
              isVerified ? (
                <>
                  <Navbar
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    selectedCategory={selectedCategory}
                    setSelectedCategory={setSelectedCategory}
                  />
                  <RestrictionBanner />
                  <div className="flex-1">
                    <Transactions />
                  </div>
                </>
              ) : (
                <Navigate to="/" replace />
              )
            }
          />

          <Route
            path="/profile/:userId"
            element={
              <>
                <Navbar
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  selectedCategory={selectedCategory}
                  setSelectedCategory={setSelectedCategory}
                />
                <RestrictionBanner />
                <div className="flex-1">
                  <ProfilePage />
                </div>
              </>
            }
          />

          <Route path="/reset-password" element={<ResetPassword />} />

          <Route
            path="/account-settings"
            element={
              isVerified ? (
                <>
                  <Navbar
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    selectedCategory={selectedCategory}
                    setSelectedCategory={setSelectedCategory}
                  />
                  <div className="flex-1">
                    <AccountSettings />
                  </div>
                </>
              ) : (
                <Navigate to="/" replace />
              )
            }
          />

          <Route
            path="/admin"
            element={
              currentUser?.role === 'admin' ? (
                <>
                  <Navbar
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    selectedCategory={selectedCategory}
                    setSelectedCategory={setSelectedCategory}
                  />
                  <div className="flex-1">
                    <Admin />
                  </div>
                </>
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
