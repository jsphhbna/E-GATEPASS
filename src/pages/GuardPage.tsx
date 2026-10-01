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
import { auth, db } from '@/lib/firebase';
import { signOut, updatePassword } from 'firebase/auth';
import { useAuth } from '@/hooks/useAuth';
import { AuthenticatedImage } from '@/components/AuthenticatedImage';
import type { GatePass } from '@/types';
import {
  CheckCircle2,
  XCircle,
  Clock,
  WifiOff,
  MapPin,
  User,
  Volume2,
  BarChart2,
  UserCheck,
  X,
  ZoomIn,
  LogOut,
  Key,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button, Card, Input, StatCard, Modal, FormField, ConfirmModal } from '@/components/ui';
import { BrandMark } from '@/components/BrandMark';
import { toast } from 'sonner';

interface PassWithId extends GatePass {
  id: string;
}

export function GuardPage() {
  const { uid, userData } = useAuth();
  const [passes, setPasses] = useState<PassWithId[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectionReasons, setRejectionReasons] = useState<string[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Daily Report stats
  const [dailyStats, setDailyStats] = useState({
    inside: 0,
    exited: 0,
    rejected: 0,
    total: 0,
  });

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

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
      setIsRejecting(false);
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
          (p.visitorName ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (p.purpose ?? '').toLowerCase().includes(searchTerm.toLowerCase())
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
  // ============================================================
  // AUTH ACTIONS
  // ============================================================
  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await signOut(auth);
    } catch (err) {
      toast.error('Failed to sign out');
    } finally {
      setIsSigningOut(false);
      setShowSignOutModal(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword) return toast.error('Please enter your current password');
    if (!newPassword) return toast.error('Please enter a new password');
    if (newPassword !== confirmPassword) return toast.error('Passwords do not match');

    setPasswordLoading(true);
    try {
      if (!auth.currentUser || !auth.currentUser.email) throw new Error('Not authenticated');
      
      // Re-authenticate first
      const { EmailAuthProvider, reauthenticateWithCredential } = await import('firebase/auth');
      const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);

      // Now update the password
      await updatePassword(auth.currentUser, newPassword);
      
      toast.success('Password updated successfully');
      setIsChangingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        toast.error('Incorrect current password.');
      } else if (err.code === 'auth/weak-password') {
        toast.error('Password is too weak. Please use at least 6 characters.');
      } else {
        toast.error(err.message || 'Failed to update password');
      }
    } finally {
      setPasswordLoading(false);
    }
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
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-[var(--color-text-secondary)] mr-2 hidden sm:inline-block">
              {userData && 'name' in userData ? userData.name : 'Guard'}
            </span>
            <Button variant="secondary" size="sm" onClick={() => setIsChangingPassword(true)} icon={<Key className="w-4 h-4" />}>
              Change Password
            </Button>
            <Button variant="destructive-outline" size="sm" onClick={() => setShowSignOutModal(true)} icon={<LogOut className="w-4 h-4" />}>
              Sign Out
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:items-end mt-2">
          <div className="w-full sm:w-64">
            <Input
              type="search"
              placeholder="Search by name or purpose…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Daily Report Summary */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Issued"
          value={dailyStats.total}
          icon={<BarChart2 className="h-5 w-5 text-[var(--color-text-secondary)]" />}
        />
        <StatCard
          title="Currently Inside"
          value={dailyStats.inside}
          icon={<UserCheck className="h-5 w-5 text-[var(--color-success)]" />}
          trend={`${dailyStats.inside} visitors on campus`}
          trendUp={true}
        />
        <StatCard
          title="Exited"
          value={dailyStats.exited}
          icon={<UserCheck className="h-5 w-5 text-[var(--color-text-secondary)]" />}
          trend={`${dailyStats.exited} left campus`}
          trendUp={false}
        />
        <StatCard
          title="Rejected"
          value={dailyStats.rejected}
          icon={<X className="h-5 w-5 text-[var(--color-danger)]" />}
        />
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
          <div className="mb-4 opacity-60">
            <BrandMark size="lg" />
          </div>
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
          {filteredPasses.map((pass, index) => {
            const isActive = index === 0;

            if (isActive) {
              return (
                <Card
                  key={pass.id}
                  className={`col-span-full overflow-hidden transition-all motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200 ${
                    isPendingLong(pass) 
                      ? 'border-[var(--color-warning)] ring-1 ring-[var(--color-warning)] motion-safe:animate-pulse' 
                      : ''
                  }`}
                >
                  {isPendingLong(pass) && (
                    <div className="flex items-center gap-2 px-4 py-3 text-sm font-bold bg-amber-50 text-amber-700 border-b border-amber-200">
                      <Volume2 className="h-4 w-4" />
                      Pending for over 30 seconds
                    </div>
                  )}

                  <div className="p-6">
                    <div className="mb-6 grid gap-6 md:grid-cols-3">
                      {/* Panel 1: Info */}
                      <div className="flex flex-col justify-center border-b pb-6 md:border-b-0 md:border-r md:pb-0 md:pr-6 border-[var(--color-border)]">
                        <h3 className="text-2xl font-bold text-[var(--color-text-primary)]">
                          {pass.visitorName}
                        </h3>
                        <p className="mt-2 text-base text-[var(--color-text-secondary)]">
                          {pass.purpose}
                        </p>
                        <div className="mt-6 space-y-2">
                          <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                            <Clock className="h-4 w-4" />
                            <span>
                              Scanned: {pass.scannedAt ? new Date(pass.scannedAt.toMillis()).toLocaleTimeString() : '—'}
                            </span>
                          </div>
                          {pass.gate && (
                            <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                              <MapPin className="h-4 w-4" />
                              <span>Gate: {pass.gate}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>
                              Valid: {new Date(pass.validFrom.toMillis()).toLocaleTimeString()} - {new Date(pass.validUntil.toMillis()).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Panel 2: Face Photo */}
                      <div className="flex flex-col items-center border-b pb-6 md:border-b-0 md:border-r md:pb-0 md:pr-6 border-[var(--color-border)]">
                        <span className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Live Photo</span>
                        <div 
                          className="relative group cursor-pointer"
                          onClick={() => setZoomImage(pass.photoPublicId)}
                        >
                          <AuthenticatedImage
                            publicId={pass.photoPublicId}
                            alt="Face Photo"
                            className="h-56 w-48 rounded-xl object-cover shadow-sm bg-gray-100 transition-transform group-hover:scale-[1.02]"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-xl flex items-center justify-center">
                            <ZoomIn className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md h-8 w-8" />
                          </div>
                        </div>
                      </div>

                      {/* Panel 3: ID Photo */}
                      <div className="flex flex-col items-center">
                        <span className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Valid ID</span>
                        {pass.idImagePublicId ? (
                          <div 
                            className="relative group cursor-pointer w-full max-w-xs"
                            onClick={() => setZoomImage(pass.idImagePublicId!)}
                          >
                            <AuthenticatedImage
                              publicId={pass.idImagePublicId}
                              alt="ID Photo"
                              className="h-56 w-full rounded-xl object-contain shadow-sm bg-gray-100 transition-transform group-hover:scale-[1.02]"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-xl flex items-center justify-center">
                              <ZoomIn className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md h-8 w-8" />
                            </div>
                          </div>
                        ) : (
                          <div className="flex h-56 w-full max-w-xs items-center justify-center rounded-xl bg-gray-50 border-2 border-dashed border-gray-200 text-sm font-medium text-gray-400">
                            No ID (Walk-in)
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                      <div className="flex gap-3 max-w-md mx-auto md:max-w-none">
                        <Button
                          onClick={() => handleApprove(pass)}
                          className="flex-1"
                          size="lg"
                          icon={<CheckCircle2 className="h-5 w-5" />}
                        >
                          Approve Visitor
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => {
                            setRejectingId(pass.id);
                            setIsRejecting(true);
                          }}
                          className="flex-1"
                          size="lg"
                          icon={<XCircle className="h-5 w-5" />}
                        >
                          Reject
                        </Button>
                      </div>
                  </div>
                </Card>
              );
            }

            // ==========================================
            // COMPACT CARD (Queued Passes)
            // ==========================================
            return (
              <Card
                key={pass.id}
                className="overflow-hidden opacity-75 transition-opacity hover:opacity-100"
              >
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="truncate text-sm font-bold text-[var(--color-text-primary)]">
                        {pass.visitorName}
                      </h3>
                      <p className="truncate text-xs text-[var(--color-text-secondary)] mt-0.5">
                        {pass.purpose}
                      </p>
                      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)] font-medium">
                        <Clock className="h-3 w-3" />
                        {pass.scannedAt ? new Date(pass.scannedAt.toMillis()).toLocaleTimeString() : '—'}
                        {pass.gate && ` • ${pass.gate}`}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button
                      onClick={() => handleApprove(pass)}
                      className="flex-1"
                      size="sm"
                      icon={<CheckCircle2 className="h-4 w-4" />}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setRejectingId(pass.id);
                        setIsRejecting(true);
                      }}
                      className="flex-1"
                      size="sm"
                      icon={<XCircle className="h-4 w-4" />}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {/* Reject Modal */}
      <Modal
        isOpen={isRejecting}
        onClose={() => {
          setIsRejecting(false);
          setRejectReason('');
        }}
        title="Reject Visitor"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Please provide a reason for rejection. This will be recorded in the audit logs.
          </p>
          <select
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] px-4 py-3 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-1 focus:ring-[var(--color-brand)] transition-shadow"
          >
            <option value="">Select reason…</option>
            {rejectionReasons.map((reason) => (
              <option key={reason} value={reason}>
                {reason}
              </option>
            ))}
          </select>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              onClick={() => {
                setIsRejecting(false);
                setRejectReason('');
              }}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                const pass = passes.find(p => p.id === rejectingId);
                if (pass) handleReject(pass);
              }}
              disabled={!rejectReason}
              className="w-full sm:w-auto"
            >
              Confirm Reject
            </Button>
          </div>
        </div>
      </Modal>

      {/* Image Zoom Modal */}
      <Modal
        isOpen={!!zoomImage}
        onClose={() => setZoomImage(null)}
        hideTitleRow
        size="lg"
      >
        {zoomImage && (
          <div className="flex items-center justify-center">
            <AuthenticatedImage
              publicId={zoomImage}
              alt="Zoomed"
              className="w-full h-auto max-h-[85vh] object-contain rounded-xl"
            />
          </div>
        )}
      </Modal>

      {/* Voluntary Password Change Modal */}
      {isChangingPassword && (
        <Modal
          isOpen={true}
          onClose={() => {
            setIsChangingPassword(false);
            setNewPassword('');
            setConfirmPassword('');
          }}
          title="Change Password"
          description="Update your account security"
          size="sm"
        >
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <FormField label="Current Password">
              <div className="relative">
                <Input
                  type={showPasswords ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={passwordLoading}
                  placeholder="••••••••"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showPasswords ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </FormField>
            <FormField label="New Password">
              <div className="relative">
                <Input
                  type={showPasswords ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={passwordLoading}
                  placeholder="••••••••"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showPasswords ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </FormField>
            <FormField label="Confirm Password">
              <div className="relative">
                <Input
                  type={showPasswords ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={passwordLoading}
                  placeholder="••••••••"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showPasswords ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </FormField>
            <div className="pt-2 flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setIsChangingPassword(false)} disabled={passwordLoading}>
                Cancel
              </Button>
              <Button type="submit" loading={passwordLoading}>
                Update
              </Button>
            </div>
          </form>
        </Modal>
      )}

      <ConfirmModal
        isOpen={showSignOutModal}
        onClose={() => setShowSignOutModal(false)}
        title="Confirm Sign Out"
        description="Are you sure you want to log out of your account?"
        onConfirm={handleSignOut}
        confirmText={isSigningOut ? "Signing Out..." : "Sign Out"}
        cancelText="Cancel"
        isDestructive={true}
        loading={isSigningOut}
      />
    </main>
  );
}
