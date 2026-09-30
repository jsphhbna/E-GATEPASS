import { useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export function PrivacyModal() {
  const { uid, userData } = useAuth();
  const [loading, setLoading] = useState(false);

  // Only show if user is admin/guard and hasn't accepted yet
  if (!uid || !userData || !('privacyAcceptedAt' in userData)) return null;
  if (userData.role !== 'admin' && userData.role !== 'guard') return null;
  if (userData.privacyAcceptedAt !== null) return null;

  async function handleAccept() {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', uid!), {
        privacyAcceptedAt: serverTimestamp(),
      });
      toast.success('Privacy policy acknowledged');
    } catch (err) {
      console.error(err);
      toast.error('Failed to acknowledge privacy policy');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
        <div className="bg-blue-600 px-6 py-8 text-center text-white">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/20">
            <ShieldCheck className="h-8 w-8 text-white" />
          </div>
          <h2 className="mt-4 text-2xl font-bold">Privacy & Compliance</h2>
          <p className="mt-2 text-blue-100 text-sm">Action Required for Access</p>
        </div>
        
        <div className="p-6">
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
            As a staff member of EARIST, you have access to sensitive visitor data including government IDs and webcam photos. By continuing, you agree to:
          </p>
          <ul className="mb-6 space-y-2 text-sm text-gray-700 dark:text-gray-400">
            <li className="flex gap-2">
              <span className="text-blue-500">•</span>
              Never download or export visitor IDs for personal use.
            </li>
            <li className="flex gap-2">
              <span className="text-blue-500">•</span>
              Only access records necessary for your immediate duties.
            </li>
            <li className="flex gap-2">
              <span className="text-blue-500">•</span>
              Understand that all actions and scans are permanently logged and audited.
            </li>
          </ul>

          <button
            onClick={handleAccept}
            disabled={loading}
            className="w-full rounded-md bg-blue-600 py-3 font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'I Accept & Agree'}
          </button>
        </div>
      </div>
    </div>
  );
}
