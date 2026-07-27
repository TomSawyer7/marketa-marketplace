import React, { useState, useEffect } from 'react';
import { AlertTriangle, Send } from 'lucide-react';
import { store } from '../lib/supabase';
import { toast } from 'sonner';

export const RestrictionBanner: React.FC = () => {
  const currentUser = store.getCurrentUser();
  const [showAppealForm, setShowAppealForm] = useState(false);
  const [appealReason, setAppealReason] = useState('');
  const [pendingAppeal, setPendingAppeal] = useState(store.getPendingAppealForUser(currentUser.id));
  const [approvedAppeal, setApprovedAppeal] = useState(store.getApprovedAppealForUser(currentUser.id));

  useEffect(() => {
    const unsub = store.subscribe(() => {
      const u = store.getCurrentUser();
      if (u.id === currentUser.id) {
        setPendingAppeal(store.getPendingAppealForUser(u.id));
        setApprovedAppeal(store.getApprovedAppealForUser(u.id));
      }
    });
    return unsub;
  }, [currentUser.id]);

  if (!currentUser.is_restricted) return null;
  if (approvedAppeal) return null;

  const handleSubmitAppeal = () => {
    if (!appealReason.trim()) {
      toast.error('Please explain why your restriction should be lifted.');
      return;
    }
    store.addAppeal(currentUser.id, appealReason.trim());
    toast.success('Appeal submitted. Admin will review it.');
    setShowAppealForm(false);
    setAppealReason('');
    setPendingAppeal(store.getPendingAppealForUser(currentUser.id));
  };

  return (
    <div className="bg-red-50 border-b border-red-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-red-700">Account Restricted</p>
          <p className="text-xs text-red-600 mt-0.5">{currentUser.restriction_reason || 'Your account has been restricted due to policy violations.'}</p>
          {pendingAppeal ? (
            <p className="text-xs text-amber-600 mt-1 font-semibold">Appeal pending review by admin.</p>
          ) : (
            <button onClick={() => setShowAppealForm(!showAppealForm)} className="text-xs text-red-700 underline mt-1 font-semibold cursor-pointer">
              {showAppealForm ? 'Cancel' : 'Submit an Appeal'}
            </button>
          )}
          {showAppealForm && (
            <div className="mt-3 space-y-2">
              <textarea value={appealReason} onChange={e => setAppealReason(e.target.value)} rows={3}
                className="w-full max-w-md border border-red-200 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-300 resize-none bg-white"
                placeholder="Explain why your restriction should be lifted..." />
              <button onClick={handleSubmitAppeal} className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer">
                <Send className="w-3.5 h-3.5" /> Submit Appeal
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
