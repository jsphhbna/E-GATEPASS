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
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Save, Trash2, AlertTriangle, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, Input, ConfirmModal } from '@/components/ui';

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
  
  // Modals state
  const [showPeakModeConfirm, setShowPeakModeConfirm] = useState(false);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
  const [purgeEligibleCount, setPurgeEligibleCount] = useState<number | null>(null);
  const [calculatingPurge, setCalculatingPurge] = useState(false);

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
  async function handlePurgeClick() {
    setCalculatingPurge(true);
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - settings.retentionDays);
      const q = query(
        collection(db, 'visitors'),
        where('createdAt', '<', cutoffDate)
      );
      const snapshot = await getDocs(q);
      
      const unpurged = snapshot.docs.filter(d => !d.data().imagesPurgedAt);
      
      setPurgeEligibleCount(unpurged.length);
      setShowPurgeConfirm(true);
    } catch (err) {
      console.error('Dry run failed', err);
      toast.error('Could not calculate purge impact');
    } finally {
      setCalculatingPurge(false);
    }
  }

  async function executePurge() {
    setPurging(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Not authenticated');

      let totalPurged = 0;
      let hasMore = true;

      while (hasMore) {
        const res = await fetch('/api/purge-images', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Purge failed: ${res.status} - ${text}`);
        }

        const data = await res.json();
        
        if (data.successCount > 0) {
          totalPurged += data.successCount;
        }

        if (data.successCount === 0 || data.count === 0) {
          hasMore = false;
        }
      }

      toast.success(`Purge complete: ${totalPurged} visitors purged.`);
      setShowPurgeConfirm(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Purge failed');
    } finally {
      setPurging(false);
    }
  }

  function togglePeakMode() {
    if (!settings.peakMode) {
      setShowPeakModeConfirm(true);
    } else {
      // Instant off
      setSettings({ ...settings, peakMode: false });
      toast.success('Peak Mode disabled');
    }
  }

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-3 border-[var(--color-brand)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            System Settings
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Configure policies, reasons, and data retention
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          icon={<Save className="h-4 w-4" />}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>

      <div className="grid gap-6">
        
        {/* Retention Policy */}
        <Card className="p-6">
          <h2 className="mb-5 text-xl font-bold text-[var(--color-text-primary)]">Data Retention</h2>
          
          <div className="mb-8">
             <label className="mb-2 block text-sm font-medium text-[var(--color-text-primary)]">Visitor Data Retention (Days)</label>
             <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
               How long visitor ID and photos are kept before they are eligible for deletion.
             </p>
             <div className="w-full max-w-[200px]">
               <Input
                 type="number"
                 min={1}
                 value={settings.retentionDays}
                 onChange={(e) => setSettings({ ...settings, retentionDays: parseInt(e.target.value) || 30 })}
               />
             </div>
          </div>

          <div className="rounded-lg border border-red-200 bg-red-50 p-5 dark:border-red-900/50 dark:bg-red-900/10">
            <div className="flex items-start gap-4">
              <AlertTriangle className="mt-0.5 h-6 w-6 text-red-600 dark:text-red-500 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-lg text-red-800 dark:text-red-400">Purge Eligible Images</h3>
                <p className="mt-2 text-sm text-red-700 dark:text-red-300">
                  Permanently deletes Cloudinary images for visitors older than {settings.retentionDays} days. 
                  This action cannot be undone. Firestore sets <code className="bg-red-100 dark:bg-red-800/50 px-1.5 py-0.5 rounded font-mono text-xs">imagesPurgedAt</code> only upon successful deletion.
                </p>
                <Button
                  variant="destructive"
                  onClick={handlePurgeClick}
                  disabled={purging || calculatingPurge}
                  loading={calculatingPurge}
                  className="mt-4"
                  icon={<Trash2 className="h-4 w-4" />}
                >
                  {calculatingPurge ? 'Calculating...' : purging ? 'Purging...' : 'Run Purge Now'}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Peak Mode */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="pr-8">
              <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Peak Mode</h2>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                When enabled, visitors are NOT required to upload a government ID to speed up the queue.
              </p>
            </div>
            <button
              type="button"
              onClick={togglePeakMode}
              className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors ${
                settings.peakMode ? 'bg-[var(--color-brand)]' : 'bg-gray-300 dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  settings.peakMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </Card>

        {/* Rejection Reasons */}
        <Card className="p-6">
          <h2 className="mb-5 text-xl font-bold text-[var(--color-text-primary)]">Premade Rejection Reasons</h2>
          
          <ul className="divide-y rounded-lg border border-[var(--color-border)] overflow-hidden">
            {settings.rejectionReasons.map((reason) => (
              <li key={reason} className="flex items-center justify-between p-4 hover:bg-[var(--color-canvas)] transition-colors">
                <span className="text-sm font-medium text-[var(--color-text-primary)]">{reason}</span>
                <button
                  type="button"
                  onClick={() => removeReason(reason)}
                  className="rounded-md p-1.5 text-[var(--color-danger)] hover:bg-[var(--color-danger-light)] transition-colors"
                  aria-label="Remove reason"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
            {settings.rejectionReasons.length === 0 && (
              <li className="p-6 text-center text-sm text-[var(--color-text-muted)]">No reasons configured</li>
            )}
            
            <li className="flex gap-3 p-4 bg-gray-50 dark:bg-gray-800/20 border-t border-[var(--color-border)]">
              <div className="flex-1">
                <Input
                  type="text"
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  placeholder="Add new reason..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addReason();
                    }
                  }}
                />
              </div>
              <Button
                onClick={addReason}
                variant="secondary"
                icon={<Plus className="h-4 w-4" />}
              >
                Add
              </Button>
            </li>
          </ul>
        </Card>

      </div>
      
      <ConfirmModal
        isOpen={showPurgeConfirm}
        onClose={() => setShowPurgeConfirm(false)}
        title="Purge Images?"
        description={
          <>
            You are about to permanently delete Cloudinary images for <strong className="text-[var(--color-text-primary)]">{purgeEligibleCount}</strong> visitor{purgeEligibleCount === 1 ? '' : 's'} older than {settings.retentionDays} days.
            This action cannot be undone.
          </>
        }
        onConfirm={executePurge}
        confirmText="Yes, purge images"
        isDestructive
        loading={purging}
      />

      <ConfirmModal
        isOpen={showPeakModeConfirm}
        onClose={() => setShowPeakModeConfirm(false)}
        title="Enable Peak Mode?"
        description={
          <>
            Are you sure you want to enable Peak Mode? Visitors will not be required to provide a government ID photo during registration. This reduces security but speeds up processing.
          </>
        }
        onConfirm={() => {
          setSettings({ ...settings, peakMode: true });
          setShowPeakModeConfirm(false);
          toast.success('Peak Mode enabled');
        }}
        confirmText="Enable Peak Mode"
      />
    </div>
  );
}
