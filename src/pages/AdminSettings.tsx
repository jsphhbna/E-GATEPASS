import { useState, useEffect } from 'react';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Save, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [purging, setPurging] = useState(false);
  
  const [settings, setSettings] = useState({
    retentionDays: 30,
    peakMode: false,
    rejectionReasons: [] as string[],
  });

  const [newReason, setNewReason] = useState('');

  useEffect(() => {
    async function loadSettings() {
      try {
        const snap = await getDoc(doc(db, 'settings', 'app'));
        if (snap.exists()) {
          setSettings(snap.data() as any);
        } else {
          // Initialize if missing
          const defaultSettings = {
            retentionDays: 30,
            peakMode: false,
            rejectionReasons: ['Invalid ID', 'No prior appointment', 'Underage', 'Refused inspection'],
          };
          await setDoc(doc(db, 'settings', 'app'), defaultSettings);
          setSettings(defaultSettings);
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to load settings');
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'settings', 'app'), settings);
      toast.success('Settings saved successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  function addReason() {
    if (!newReason.trim()) return;
    if (settings.rejectionReasons.includes(newReason.trim())) {
      toast.error('Reason already exists');
      return;
    }
    setSettings((prev) => ({
      ...prev,
      rejectionReasons: [...prev.rejectionReasons, newReason.trim()],
    }));
    setNewReason('');
  }

  function removeReason(reason: string) {
    setSettings((prev) => ({
      ...prev,
      rejectionReasons: prev.rejectionReasons.filter((r) => r !== reason),
    }));
  }

  // ============================================================
  // PURGE IMAGES
  // ============================================================
  async function handlePurge() {
    const confirm = window.confirm(`This will permanently delete Cloudinary images for visitors older than ${settings.retentionDays} days. Continue?`);
    if (!confirm) return;

    setPurging(true);
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - settings.retentionDays);

      const q = query(
        collection(db, 'visitors'),
        where('imagesPurgedAt', '==', null)
        // Note: filtering by date client-side to avoid complex composite index if not strictly needed
      );

      const snap = await getDocs(q);
      let purgedCount = 0;
      let failedCount = 0;

      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Not authenticated');

      for (const visitorDoc of snap.docs) {
        const visitor = visitorDoc.data();
        
        // Check if older than cutoff
        const createdAt = visitor.createdAt?.toDate() || new Date(visitor.visitDate);
        if (createdAt > cutoffDate) continue;

        // Delete from Cloudinary
        try {
          const deleteImage = async (publicId: string) => {
             const res = await fetch(`/api/image?publicId=${encodeURIComponent(publicId)}`, {
               method: 'DELETE',
               headers: { Authorization: `Bearer ${token}` }
             });
             if (!res.ok) throw new Error('Failed to delete image');
          };

          if (visitor.photoPublicId) await deleteImage(visitor.photoPublicId);
          if (visitor.idImagePublicId) await deleteImage(visitor.idImagePublicId);

          // Update Firestore ONLY after successful deletion
          await updateDoc(doc(db, 'visitors', visitorDoc.id), {
            imagesPurgedAt: serverTimestamp(),
            // Optional: nullify publicIds to save space, but keeping them might be useful for auditing
            // photoPublicId: null, 
            // idImagePublicId: null,
          });

          purgedCount++;
        } catch (e) {
          console.error(`Failed to purge images for visitor ${visitorDoc.id}`, e);
          failedCount++;
        }
      }

      toast.success(`Purge complete: ${purgedCount} visitors purged. ${failedCount > 0 ? `(${failedCount} failed)` : ''}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Purge failed');
    } finally {
      setPurging(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            System Settings
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Configure policies, reasons, and data retention
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      <div className="grid gap-6">
        
        {/* Retention Policy */}
        <div className="rounded-xl border p-5" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <h2 className="mb-4 text-lg font-bold">Data Retention</h2>
          
          <div className="mb-6">
             <label className="mb-1 block text-sm font-medium">Visitor Data Retention (Days)</label>
             <p className="mb-3 text-xs text-gray-500">
               How long visitor ID and photos are kept before they are eligible for deletion.
             </p>
             <input
               type="number"
               min={1}
               value={settings.retentionDays}
               onChange={(e) => setSettings({ ...settings, retentionDays: parseInt(e.target.value) || 30 })}
               className="w-full max-w-[200px] rounded-md border px-3 py-2 text-sm"
             />
          </div>

          <div className="rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/10">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600 dark:text-red-500 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-red-800 dark:text-red-400">Purge Eligible Images</h3>
                <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                  Permanently deletes Cloudinary images for visitors older than {settings.retentionDays} days. 
                  This action cannot be undone. Firestore sets <code className="bg-red-100 dark:bg-red-800/50 px-1 rounded">imagesPurgedAt</code> only upon successful deletion.
                </p>
                <button
                  onClick={handlePurge}
                  disabled={purging}
                  className="mt-3 flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" /> {purging ? 'Purging...' : 'Run Purge Now'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Peak Mode */}
        <div className="rounded-xl border p-5" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Peak Mode</h2>
              <p className="mt-1 text-sm text-gray-500">
                When enabled, visitors are NOT required to upload a government ID to speed up the queue.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSettings({ ...settings, peakMode: !settings.peakMode })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.peakMode ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.peakMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Rejection Reasons */}
        <div className="rounded-xl border p-5" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <h2 className="mb-4 text-lg font-bold">Premade Rejection Reasons</h2>
          
          <div className="mb-4 flex gap-2">
            <input
              type="text"
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              placeholder="Add new reason..."
              className="flex-1 rounded-md border px-3 py-2 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addReason();
                }
              }}
            />
            <button
              type="button"
              onClick={addReason}
              className="rounded-md bg-gray-800 px-4 py-2 text-sm font-semibold text-white dark:bg-gray-100 dark:text-gray-900"
            >
              Add
            </button>
          </div>

          <ul className="divide-y rounded-md border" style={{ borderColor: 'var(--color-border)' }}>
            {settings.rejectionReasons.map((reason) => (
              <li key={reason} className="flex items-center justify-between p-3">
                <span className="text-sm font-medium">{reason}</span>
                <button
                  type="button"
                  onClick={() => removeReason(reason)}
                  className="rounded-full p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
            {settings.rejectionReasons.length === 0 && (
              <li className="p-4 text-center text-sm text-gray-500">No reasons configured</li>
            )}
          </ul>
        </div>

      </div>
    </div>
  );
}
