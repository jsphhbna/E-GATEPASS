import { useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { BrandMark } from '@/components/BrandMark';
import { toast } from 'sonner';
import { Button, Modal } from '@/components/ui';

export function PrivacyModal() {
  const { uid, userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);

  // Only show if user is admin/guard and hasn't accepted yet
  if (!uid || !userData || !('privacyAcceptedAt' in userData)) return null;
  if (userData.role !== 'admin' && userData.role !== 'guard') return null;
  if (userData.privacyAcceptedAt !== null || accepted) return null;

  async function handleAccept() {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', uid!), {
        privacyAcceptedAt: serverTimestamp(),
      });
      setAccepted(true);
      toast.success('Privacy policy acknowledged');
    } catch (err) {
      console.error(err);
      toast.error('Failed to acknowledge privacy policy');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={true}
      onClose={() => {}} // Cannot be closed
      preventClose={true} // Removes close button, prevents clicking outside/esc to close
      title="Privacy & Compliance"
      description="Action Required for Access"
      size="sm"
    >
      <div className="space-y-6">
        <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-4 text-center">
          <BrandMark size="sm" />
          <p className="mt-4 text-sm text-[var(--color-text-secondary)] text-left">
            As a staff member of EARIST, you have access to sensitive visitor data including government IDs and webcam photos. By continuing, you agree to:
          </p>
        </div>

        <ul className="space-y-3 text-sm text-[var(--color-text-primary)] font-medium">
          <li className="flex gap-2">
            <span style={{ color: 'var(--color-brand)' }}>•</span>
            Never download or export visitor IDs for personal use.
          </li>
          <li className="flex gap-2">
            <span style={{ color: 'var(--color-brand)' }}>•</span>
            Only access records necessary for your immediate duties.
          </li>
          <li className="flex gap-2">
            <span style={{ color: 'var(--color-brand)' }}>•</span>
            Understand that all actions and scans are permanently logged and audited.
          </li>
        </ul>

        <Button
          onClick={handleAccept}
          disabled={loading}
          loading={loading}
          className="w-full"
          size="lg"
        >
          {loading ? 'Accepting...' : 'I Accept & Agree'}
        </Button>
      </div>
    </Modal>
  );
}
