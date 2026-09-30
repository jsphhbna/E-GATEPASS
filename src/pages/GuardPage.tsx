import { useEffect, useState, useRef } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  addDoc,
  getDoc,
  limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { AuthenticatedImage } from '@/components/AuthenticatedImage';
import type { GatePass } from '@/types';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  WifiOff,
  Shield,
  Volume2,
  BarChart2,
} from 'lucide-react';
import { toast } from 'sonner';

interface PassWithId extends GatePass {
  id: string;
}

export function GuardPage() {
  const { uid } = useAuth();
  const [passes, setPasses] = useState<PassWithId[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectionReasons, setRejectionReasons] = useState<string[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Daily Report stats
  const [dailyStats, setDailyStats] = useState({
    inside: 0,
    exited: 0,
    rejected: 0,
    total: 0,
  });

  // ============================================================
  // LOAD PREMADE REJECTION REASONS FROM settings/app
  // ============================================================
  useEffect(() => {
    async function loadSettings() {
      const settingsSnap = await getDoc(doc(db, 'settings', 'app'));
      if (settingsSnap.exists()) {
        const data = settingsSnap.data();
        if (Array.isArray(data.rejectionReasons)) {
          setRejectionReasons(data.rejectionReasons);
        }
      }
    }
    loadSettings();
  }, []);

  // ============================================================
  // REAL-TIME LISTENER: pending passes
  // ============================================================
  useEffect(() => {
    const q = query(
      collection(db, 'gatePasses'),
      where('status', '==', 'pending'),
      orderBy('scannedAt', 'asc'),
      limit(50)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: PassWithId[] = [];
        snap.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as PassWithId);
        });

        // Play alert sound for new entries
        if (list.length > passes.length && audioRef.current) {
          audioRef.current.play().catch(() => {});
        }

        setPasses(list);
      },
      (error) => {
        console.error('Guard listener error:', error);
      }
    );

    return unsub;
  }, [passes.length]);

  // ============================================================
  // REAL-TIME LISTENER: daily report stats
  // ============================================================
  useEffect(() => {
    // Get start of today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const q = query(
      collection(db, 'gatePasses'),
      where('issuedAt', '>=', startOfToday)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        let inside = 0;
        let exited = 0;
        let rejected = 0;
        let total = 0;

        snap.forEach((docSnap) => {
          const pass = docSnap.data() as GatePass;
          total++;
          if (pass.status === 'inside') inside++;
          else if (pass.status === 'exited') exited++;
          else if (pass.status === 'rejected') rejected++;
        });

        setDailyStats({ inside, exited, rejected, total });
      },
      (error) => {
        console.error('Daily stats listener error:', error);
      }
    );

    return unsub;
  }, []);

  // ============================================================
  // ONLINE/OFFLINE DETECTION
  // ============================================================
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ============================================================
  // APPROVE
  // ============================================================
  async function handleApprove(pass: PassWithId) {
    try {
      await updateDoc(doc(db, 'gatePasses', pass.id), {
        status: 'inside',
        timeIn: serverTimestamp(),
        decidedByUid: uid,
      });

      await addDoc(collection(db, 'visitLogs'), {
        passToken: pass.id,
        visitorId: pass.visitorId,
        event: 'approved',
        reason: null,
        deviceId: null,
        gate: pass.gate,
        guardUid: uid,
        timestamp: serverTimestamp(),
      });

      toast.success(`${pass.visitorName} approved`);
    } catch (err) {
      console.error('Approve error:', err);
      toast.error('Failed to approve. Try again.');
    }
  }

  // ============================================================
  // REJECT
  // ============================================================
  async function handleReject(pass: PassWithId) {
    if (!rejectReason.trim()) {
      toast.error('Select or type a rejection reason.');
      return;
    }

    try {
      await updateDoc(doc(db, 'gatePasses', pass.id), {
        status: 'rejected',
        rejectionReason: rejectReason,
        decidedByUid: uid,
      });

      await addDoc(collection(db, 'visitLogs'), {
        passToken: pass.id,
        visitorId: pass.visitorId,
        event: 'rejected',
        reason: rejectReason,
        deviceId: null,
        gate: pass.gate,
        guardUid: uid,
        timestamp: serverTimestamp(),
      });

      toast.success(`${pass.visitorName} rejected`);
      setRejectingId(null);
      setRejectReason('');
    } catch (err) {
      console.error('Reject error:', err);
      toast.error('Failed to reject. Try again.');
    }
  }

  // ============================================================
  // FILTER
  // ============================================================
  const filteredPasses = searchTerm
    ? passes.filter(
        (p) =>
          p.visitorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.purpose.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : passes;

  // ============================================================
  // PENDING AGE — highlight if > 30 seconds
  // ============================================================
  function isPendingLong(pass: PassWithId): boolean {
    if (!pass.scannedAt) return false;
    const scannedMs = pass.scannedAt.toMillis();
    return Date.now() - scannedMs > 30000;
  }

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <main
      id="main-content"
      className="min-h-dvh p-4"
      style={{ backgroundColor: 'var(--color-canvas)' }}
    >
      {/* Simple beep audio — we generate it programmatically to avoid external files */}
      <audio ref={audioRef} preload="auto">
        <source
          src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVoGAACAgICAgICAgICAgICAgICAgICAgICAgICAf3+AgYGCgoODhISFhYaGhoaGhoWFhISEg4OCgoGBgICAgIB/f39+fn59fX19fX19fX1+fn5/f3+AgIGBgoKDg4ODhISEhISEhISDg4OCgoGBgIB/f39+fn59fX19fX19fn5+f39/gICBgYKCg4ODg4OEhISEhISDg4OCgoGBgIB/f39+fn59fX19fX19fn5+f3+AgIGBgoKDg4OEhISEhISDg4OCgoGBgH9/f35+fn19fX19fX1+fn5/gICBgYKCg4ODhIWFhYWFhISEg4OCgoGBgICAf39/fn5+fX19fX19fX5+fn9/f4CAgYGCgoODg4SEhISDg4ODgoKBgYCAf39/fn5+fX19fX19fn5+fn9/f4CAgYGCgoODg4SEhISEhISDg4KCgYGAf39/fn5+fX19fX19fn5+fn9/gICBgYKCg4ODhISEhISEhIODgoKBgYB/f39+fn59fX19fn5+fn5/f3+AgIGBgoKCg4OEhISEhISDg4OCgoGBgIB/f39+fn59fX19fn5+fn9/f4CAgICBgoKDg4SEhISEhISDg4OCgoGBgIB/f39+fn5+fX1+fn5+fn9/gICAgYGCgoODg4SEhISEg4ODgoKBgYGAf39/fn5+fn19fn5+fn5/f4CAgIGBgoKDg4OEhISEhIODgoKBgYGAf39+fn5+fn19fn5+fn9/f4CAgIGBgoKDg4OEhISEg4ODgoKBgYGAf39/fn5+fn5+fn5+fn9/gICAgYGCgoODg4OEhISDg4OCgoGBgIB/f39+fn5+fn5+fn5/f3+AgIGBgYKCg4ODhISDg4ODgoKBgYCAf39/fn5+fn5+fn5+f39/gICBgYGCgoODg4OEg4ODg4KCgYGAgH9/f35+fn5+fn5+fn9/gICAgYGBgoKDg4ODg4ODg4KCgYGBgH9/f35+fn5+fn5+f39/gICBgYGCgoKDg4ODg4ODgoKBgYGAf39/fn5+fn5+fn5/f39/gICBgYGCgoKDg4ODg4OCgoKBgYGAf39/fn5+fn5+fn5/f3+AgICBgYGCgoKDg4ODg4OCgoGBgYCAf39/fn5+fn5+fn9/f3+AgICBgYGCgoKDg4ODgoKCgoGBgICAf39/fn5+fn5+fn9/f3+AgICBgYGCgoKDg4OCgoKCgYGBgIB/f39+fn5+fn5+f39/f4CAgICBgYGCgoKDg4OCgoKBgYGBgH9/f35+fn5+fn9/f39/gICAgIGBgYKCgoODg4KCgoGBgYGAf39/fn5+fn5+f39/f3+AgICAgYGBgoKCg4KCgoKBgYGAgH9/f35+fn5+fn9/f39/gICAgIGBgYKCgoKCgoKCgYGBgICAf39/fn5+fn5/f39/f4CAgICBgYGBgoKCgoKCgoGBgYCAgH9/f39+fn5+f39/f3+AgICAgICBgYGCgoKCgoKBgYGBgICAf39/fn5+fn9/f39/f4CAgICBgYGBgoKCgoKCgYGBgYCAgH9/f39+fn5/f39/f3+AgICAgIGBgYKCgoKCgoGBgYGAgIB/f39/fn5+f39/f39/gICAgICBgYGBgoKCgoKBgYGBgICAf39/f39+f39/f39/f4CAgICAgYGBgYKCgoKCgYGBgYCAgH9/f39/fn9/f39/f3+AgICAgICBgYGBgoKCgYGBgYGAgIB/f39/f39/f39/f39/gICAgICAgYGBgYKCgoGBgYGBgICAf39/f39/f39/f39/f4CAgICAgIGBgYGCgoGBgYGBgICAf39/f39/f39/f39/gICAgICAgIGBgYGBgoGBgYGBgICAf39/f39/f39/f39/gICAgICAgICBgYGBgYGBgYGBgICAf39/f39/f39/f39/gICAgICAgICBgYGBgYGBgYGAgICAf39/f39/f39/f39/f4CAgICAgICBgYGBgYGBgYCAgICAgH9/f39/f39/f39/f4CAgICAgICBgYGBgYGBgYCAgICAf39/f39/f39/f39/f4CAgICAgICBgYGBgYGBgICAgIB/f39/f39/f39/f3+AgICAgICAgIGBgYGBgYGAgICAgH9/f39/f39/f39/f4CAgICAgICAgYGBgYGBgICAgICAf39/f39/f39/f3+AgICAgICAgICBgYGBgYCAgICAgH9/f39/f39/f39/gICAgICAgICAgYGBgYCAgICAgIB/f39/f39/f39/f4CAgICAgICA"
          type="audio/wav"
        />
      </audio>

      {/* Offline Banner */}
      {!isOnline && (
        <div
          className="mb-4 flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white"
          style={{
            backgroundColor: 'var(--color-danger)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <WifiOff className="h-4 w-4" />
          Connection lost — data may be stale
        </div>
      )}

      {/* Header & Search */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Guard Queue
          </h1>
          <p
            className="mt-1 text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {passes.length} pending verification
            {passes.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:items-end">
          <div className="relative w-full sm:w-64">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: 'var(--color-text-muted)' }}
            />
            <input
              type="search"
              placeholder="Search by name or purpose…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-md border py-2 pl-9 pr-3 text-sm outline-none"
              style={{
                borderColor: 'var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-surface)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Daily Report Summary */}
      <div 
        className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-lg border p-4"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <div className="flex items-center gap-3 col-span-2 sm:col-span-4 mb-2">
          <BarChart2 className="h-5 w-5" style={{ color: 'var(--color-brand)' }} />
          <h2 className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>Today's Activity</h2>
        </div>
        <div className="rounded-md bg-gray-50/50 dark:bg-gray-800/50 p-3">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Issued</p>
          <p className="text-xl font-bold">{dailyStats.total}</p>
        </div>
        <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-3">
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Currently Inside</p>
          <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{dailyStats.inside}</p>
        </div>
        <div className="rounded-md bg-green-50 dark:bg-green-900/20 p-3">
          <p className="text-xs font-medium text-green-600 dark:text-green-400">Exited</p>
          <p className="text-xl font-bold text-green-700 dark:text-green-300">{dailyStats.exited}</p>
        </div>
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3">
          <p className="text-xs font-medium text-red-600 dark:text-red-400">Rejected</p>
          <p className="text-xl font-bold text-red-700 dark:text-red-300">{dailyStats.rejected}</p>
        </div>
      </div>

      {/* Pass Cards */}
      {filteredPasses.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-20"
          style={{
            borderColor: 'var(--color-border)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <Shield
            className="mb-3 h-10 w-10"
            style={{ color: 'var(--color-text-muted)' }}
          />
          <p
            className="text-sm font-medium"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            No pending passes
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Passes will appear here when visitors scan at the entry
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPasses.map((pass) => (
            <div
              key={pass.id}
              className="overflow-hidden rounded-lg border"
              style={{
                backgroundColor: 'var(--color-surface)',
                borderColor: isPendingLong(pass)
                  ? 'var(--color-warning)'
                  : 'var(--color-border)',
                borderWidth: isPendingLong(pass) ? '2px' : '1px',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {/* Pending-long indicator */}
              {isPendingLong(pass) && (
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
                  style={{
                    backgroundColor: 'var(--color-warning-light)',
                    color: 'var(--color-warning)',
                  }}
                >
                  <Volume2 className="h-3 w-3" />
                  Pending for over 30 seconds
                </div>
              )}

              <div className="p-4">
                {/* Photo + Info */}
                <div className="mb-3 flex gap-3">
                  <AuthenticatedImage
                    publicId={pass.photoPublicId}
                    alt={`Photo of ${pass.visitorName}`}
                    className="h-20 w-16 flex-shrink-0 rounded-md object-cover"
                  />
                  <div className="flex-1">
                    <h3
                      className="text-sm font-bold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {pass.visitorName}
                    </h3>
                    <p
                      className="mt-0.5 text-xs"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {pass.purpose}
                    </p>
                    <div className="mt-2 flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      <Clock className="h-3 w-3" />
                      {pass.scannedAt
                        ? new Date(pass.scannedAt.toMillis()).toLocaleTimeString()
                        : '—'}
                    </div>
                    {pass.gate && (
                      <p className="mt-0.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        Gate: {pass.gate}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {rejectingId === pass.id ? (
                  <div className="space-y-2">
                    <select
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="w-full rounded-md border px-3 py-2 text-sm outline-none"
                      style={{
                        borderColor: 'var(--color-border)',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--color-overlay)',
                      }}
                    >
                      <option value="">Select reason…</option>
                      {rejectionReasons.map((reason) => (
                        <option key={reason} value={reason}>
                          {reason}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRejectingId(null);
                          setRejectReason('');
                        }}
                        className="flex-1 rounded-md border px-3 py-2 text-xs font-medium"
                        style={{
                          borderColor: 'var(--color-border)',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(pass)}
                        disabled={!rejectReason}
                        className="flex-1 rounded-md px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                        style={{
                          backgroundColor: 'var(--color-danger)',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        Confirm Reject
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleApprove(pass)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2.5 text-sm font-semibold text-white"
                      style={{
                        backgroundColor: 'var(--color-success)',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejectingId(pass.id)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2.5 text-sm font-semibold"
                      style={{
                        borderColor: 'var(--color-danger)',
                        color: 'var(--color-danger)',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
