import { useState, useEffect } from 'react';
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
  addDoc,
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  getAuth,
} from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { auth, db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import type { Device, DeviceType, DeviceStatus } from '@/types';
import { Tablet, Plus, X, Lock, Unlock, Key, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Card, FormField, Input, StatusBadge, Modal, ConfirmModal } from '@/components/ui';

// ============================================================
// TYPES AND SCHEMA
// ============================================================
interface DeviceWithId extends Device {
  id: string;
}

const deviceSchema = z.object({
  name: z.string().min(2, 'Name is required').max(50),
  type: z.enum({ entry: 'entry', exit: 'exit', kiosk: 'kiosk' }, {
    message: 'Select a device type',
  }),
  gate: z.string().min(1, 'Gate/location is required').max(50),
  email: z.string().email('Valid email required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type DeviceFormData = z.infer<typeof deviceSchema>;

// ============================================================
// SECONDARY FIREBASE APP for creating device accounts
// without signing out the current admin
// ============================================================
const secondaryApp = initializeApp(
  {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  },
  'secondary'
);
const secondaryAuth = getAuth(secondaryApp);

// ============================================================
// COMPONENT
// ============================================================
export function DevicesPage() {
  const { uid } = useAuth();
  const [devices, setDevices] = useState<DeviceWithId[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [revokingDevice, setRevokingDevice] = useState<DeviceWithId | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const [editingDevice, setEditingDevice] = useState<DeviceWithId | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [isUpdatingAuth, setIsUpdatingAuth] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DeviceFormData>({
    resolver: zodResolver(deviceSchema),
  });

  // Live listener on devices collection
  useEffect(() => {
    const q = query(collection(db, 'devices'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list: DeviceWithId[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as DeviceWithId);
      });
      setDevices(list);
    });
    return unsub;
  }, []);

  // ============================================================
  // CREATE DEVICE
  // ============================================================
  async function onCreateDevice(data: DeviceFormData) {
    setCreating(true);
    try {
      // 1. Create Firebase Auth user via secondary app (doesn't sign out admin)
      const cred = await createUserWithEmailAndPassword(
        secondaryAuth,
        data.email,
        data.password
      );
      const deviceUid = cred.user.uid;

      // Sign out from secondary app immediately
      await secondaryAuth.signOut();

      // 2. Create Firestore device doc keyed by the new UID
      await setDoc(doc(db, 'devices', deviceUid), {
        name: data.name,
        type: data.type as DeviceType,
        gate: data.gate,
        email: data.email,
        status: 'active' as DeviceStatus,
        createdBy: uid,
        createdAt: serverTimestamp(),
        lastSeen: null,
      });

      // 3. Audit log
      await addDoc(collection(db, 'auditLogs'), {
        actorUid: uid,
        action: 'device_registered',
        target: `devices/${deviceUid}`,
        details: `Registered ${data.type} device "${data.name}" at ${data.gate}`,
        timestamp: serverTimestamp(),
      });

      toast.success(`Device "${data.name}" registered successfully`);
      reset();
      setShowForm(false);
    } catch (err) {
      console.error('Device registration error:', err);
      const message =
        err instanceof Error && err.message.includes('email-already-in-use')
          ? 'This email is already in use by another account.'
          : 'Failed to register device. Please try again.';
      toast.error(message);
    } finally {
      setCreating(false);
    }
  }

  // ============================================================
  // TOGGLE DEVICE STATUS
  // ============================================================
  async function toggleDeviceStatus(device: DeviceWithId) {
    if (device.status === 'active') {
      setRevokingDevice(device);
    } else {
      // Reactivate instantly
      try {
        await updateDoc(doc(db, 'devices', device.id), {
          status: 'active',
        });
        await addDoc(collection(db, 'auditLogs'), {
          actorUid: uid,
          action: 'device_reactivated',
          target: `devices/${device.id}`,
          details: `Reactivated device "${device.name}"`,
          timestamp: serverTimestamp(),
        });
        toast.success(`Device "${device.name}" reactivated`);
      } catch (err) {
        console.error('Reactivate device error:', err);
        toast.error('Failed to reactivate device.');
      }
    }
  }

  async function handleRevoke(device: DeviceWithId) {
    setIsRevoking(true);
    try {
      await updateDoc(doc(db, 'devices', device.id), {
        status: 'revoked',
      });
      await addDoc(collection(db, 'auditLogs'), {
        actorUid: uid,
        action: 'device_revoked',
        target: `devices/${device.id}`,
        details: `Revoked device "${device.name}"`,
        timestamp: serverTimestamp(),
      });
      toast.success(`Device "${device.name}" revoked`);
      setRevokingDevice(null);
    } catch (err) {
      console.error('Revoke device error:', err);
      toast.error('Failed to revoke device.');
    } finally {
      setIsRevoking(false);
    }
  }

  async function handleUpdateCredentials(e: React.FormEvent) {
    e.preventDefault();
    if (!editingDevice) return;

    if (!editEmail && !editPassword) {
      toast.error('Please enter a new email or password.');
      return;
    }

    setIsUpdatingAuth(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/.netlify/functions/update-device-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetUid: editingDevice.id,
          email: editEmail || undefined,
          password: editPassword || undefined,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Failed to update credentials');
      }

      await addDoc(collection(db, 'auditLogs'), {
        actorUid: uid,
        action: 'device_credentials_updated',
        target: `devices/${editingDevice.id}`,
        details: `Updated credentials for device "${editingDevice.name}"`,
        timestamp: serverTimestamp(),
      });

      toast.success('Device credentials updated successfully');
      setEditingDevice(null);
    } catch (err: any) {
      console.error('Update credentials error:', err);
      toast.error(err.message || 'Failed to update credentials');
    } finally {
      setIsUpdatingAuth(false);
    }
  }



  function typeBadge(type: DeviceType) {
    const map: Record<DeviceType, string> = {
      entry: '🚪 Entry',
      exit: '🚶 Exit',
      kiosk: '📋 Kiosk',
    };
    return map[type];
  }

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            Devices
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Manage enrolled scanner tablets and kiosk devices
          </p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          variant={showForm ? 'secondary' : 'primary'}
          icon={showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        >
          {showForm ? 'Cancel' : 'Register Device'}
        </Button>
      </div>

      {/* Registration Form */}
      <Modal
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          reset();
        }}
        title="Register New Device"
        size="sm"
        preventClose={creating}
      >
        <form
          onSubmit={handleSubmit(onCreateDevice)}
          className="grid gap-6 sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <FormField label="Device Name" error={errors.name?.message}>
              <Input
                {...register('name')}
                placeholder="Main Gate Entry Tablet"
                error={!!errors.name}
              />
            </FormField>
          </div>

          <FormField label="Type" error={errors.type?.message}>
            <select
              {...register('type')}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none bg-transparent"
              style={{
                borderColor: errors.type ? 'var(--color-danger)' : 'var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            >
              <option value="">Select type…</option>
              <option value="entry">Entry Scanner</option>
              <option value="exit">Exit Scanner</option>
              <option value="kiosk">Kiosk</option>
            </select>
          </FormField>

          <FormField label="Gate / Location" error={errors.gate?.message}>
            <Input
              {...register('gate')}
              placeholder="Main Gate"
              error={!!errors.gate}
            />
          </FormField>

          <div className="sm:col-span-2">
            <FormField label="Login Email (for the device)" error={errors.email?.message}>
              <Input
                type="email"
                {...register('email')}
                placeholder="maingate-entry@earist-devices.local"
                error={!!errors.email}
              />
            </FormField>
          </div>

          <div className="sm:col-span-2">
            <FormField label="Login Password (for the device)" error={errors.password?.message}>
              <Input
                type="password"
                {...register('password')}
                placeholder="••••••••"
                error={!!errors.password}
              />
            </FormField>
          </div>

          <div className="sm:col-span-2">
            <Button
              type="submit"
              disabled={creating}
              loading={creating}
              className="w-full"
            >
              {creating ? 'Registering...' : 'Register Device'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Device List */}
      {devices.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--color-border)] py-16">
          <Tablet className="mb-3 h-10 w-10 text-[var(--color-text-muted)]" />
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">
            No devices registered yet
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Register a scanner tablet or kiosk to get started
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {devices.map((device) => (
            <Card key={device.id} className="p-5 flex flex-col justify-between">
              <div>
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                      {device.name}
                    </h3>
                    <p className="text-xs font-medium text-[var(--color-text-secondary)] mt-0.5">
                      {device.gate}
                    </p>
                  </div>
                  <StatusBadge 
                    status={device.status === 'active' ? 'issued' : 'rejected'} 
                    label={device.status} 
                  />
                </div>

                <div className="mb-6 space-y-3">
                  <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                    {typeBadge(device.type)}
                  </p>
                  
                  {device.email && (
                    <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] bg-gray-50 rounded-md p-2 border border-[var(--color-border)]">
                      <Mail className="h-4 w-4 shrink-0 text-gray-400" />
                      <span className="truncate" title={device.email}>{device.email}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditingDevice(device);
                    setEditEmail(device.email || '');
                    setEditPassword('');
                  }}
                  className="flex-1"
                  icon={<Key className="h-4 w-4" />}
                >
                  Edit
                </Button>
                <Button
                  variant={device.status === 'active' ? 'destructive' : 'primary'}
                  onClick={() => toggleDeviceStatus(device)}
                  className="flex-[2]"
                  icon={device.status === 'active' ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                >
                  {device.status === 'active' ? 'Revoke' : 'Reactivate'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={!!revokingDevice}
        onClose={() => setRevokingDevice(null)}
        title="Revoke Device?"
        description={
          <>
            Are you sure you want to revoke <strong className="text-[var(--color-text-primary)]">{revokingDevice?.name}</strong>?
            It will immediately lose access to the system. You can reactivate it later.
          </>
        }
        onConfirm={() => {
          if (revokingDevice) handleRevoke(revokingDevice);
        }}
        confirmText="Revoke"
        isDestructive
        loading={isRevoking}
      />

      {/* Edit Credentials Modal */}
      <Modal
        isOpen={!!editingDevice}
        onClose={() => {
          setEditingDevice(null);
          setEditEmail('');
          setEditPassword('');
        }}
        title="Edit Credentials"
        size="sm"
        preventClose={isUpdatingAuth}
      >
        <form onSubmit={handleUpdateCredentials} className="space-y-5">
          <p className="text-sm text-[var(--color-text-secondary)] mb-2">
            Update login credentials for <strong>{editingDevice?.name}</strong>. Leave a field blank if you do not wish to change it.
          </p>

          <FormField label="New Login Email">
            <Input
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              placeholder="Leave blank to keep current email"
            />
          </FormField>

          <FormField label="New Login Password">
            <Input
              type="password"
              value={editPassword}
              onChange={(e) => setEditPassword(e.target.value)}
              placeholder="Leave blank to keep current password"
              minLength={6}
            />
          </FormField>

          <Button
            type="submit"
            disabled={isUpdatingAuth || (!editEmail && !editPassword)}
            loading={isUpdatingAuth}
            className="w-full"
          >
            {isUpdatingAuth ? 'Updating...' : 'Save Changes'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
