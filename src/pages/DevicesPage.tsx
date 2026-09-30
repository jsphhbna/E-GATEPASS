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
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import type { Device, DeviceType, DeviceStatus } from '@/types';
import { Tablet, Plus, X, Shield, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

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
    const newStatus: DeviceStatus =
      device.status === 'active' ? 'revoked' : 'active';
    try {
      await updateDoc(doc(db, 'devices', device.id), {
        status: newStatus,
      });

      await addDoc(collection(db, 'auditLogs'), {
        actorUid: uid,
        action: newStatus === 'revoked' ? 'device_revoked' : 'device_reactivated',
        target: `devices/${device.id}`,
        details: `${newStatus === 'revoked' ? 'Revoked' : 'Reactivated'} device "${device.name}"`,
        timestamp: serverTimestamp(),
      });

      toast.success(
        `Device "${device.name}" ${newStatus === 'revoked' ? 'revoked' : 'reactivated'}`
      );
    } catch (err) {
      console.error('Toggle device error:', err);
      toast.error('Failed to update device status.');
    }
  }

  // ============================================================
  // STATUS BADGE STYLES
  // ============================================================
  function statusStyles(status: DeviceStatus) {
    return status === 'active'
      ? {
          backgroundColor: 'var(--color-success-light)',
          color: 'var(--color-success)',
        }
      : {
          backgroundColor: 'var(--color-danger-light)',
          color: 'var(--color-danger)',
        };
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
          <h1
            className="text-2xl font-bold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Devices
          </h1>
          <p
            className="mt-1 text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Manage enrolled scanner tablets and kiosk devices
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white"
          style={{
            backgroundColor: showForm ? 'var(--color-text-muted)' : 'var(--color-brand)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Cancel' : 'Register Device'}
        </button>
      </div>

      {/* Registration Form */}
      {showForm && (
        <div
          className="mb-6 rounded-lg border p-5"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <h2
            className="mb-4 text-base font-semibold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Register New Device
          </h2>
          <form
            onSubmit={handleSubmit(onCreateDevice)}
            className="grid gap-4 sm:grid-cols-2"
          >
            <div>
              <label htmlFor="device-name" className="mb-1 block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Device Name
              </label>
              <input
                id="device-name"
                {...register('name')}
                placeholder="Main Gate Entry Tablet"
                className="w-full rounded-md border px-3 py-2 text-sm outline-none"
                style={{
                  borderColor: errors.name ? 'var(--color-danger)' : 'var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--color-overlay)',
                }}
              />
              {errors.name && <p className="mt-1 text-xs" style={{ color: 'var(--color-danger)' }}>{errors.name.message}</p>}
            </div>

            <div>
              <label htmlFor="device-type" className="mb-1 block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Type
              </label>
              <select
                id="device-type"
                {...register('type')}
                className="w-full rounded-md border px-3 py-2 text-sm outline-none"
                style={{
                  borderColor: errors.type ? 'var(--color-danger)' : 'var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--color-overlay)',
                }}
              >
                <option value="">Select type…</option>
                <option value="entry">Entry Scanner</option>
                <option value="exit">Exit Scanner</option>
                <option value="kiosk">Kiosk</option>
              </select>
              {errors.type && <p className="mt-1 text-xs" style={{ color: 'var(--color-danger)' }}>{errors.type.message}</p>}
            </div>

            <div>
              <label htmlFor="device-gate" className="mb-1 block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Gate / Location
              </label>
              <input
                id="device-gate"
                {...register('gate')}
                placeholder="Main Gate"
                className="w-full rounded-md border px-3 py-2 text-sm outline-none"
                style={{
                  borderColor: errors.gate ? 'var(--color-danger)' : 'var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--color-overlay)',
                }}
              />
              {errors.gate && <p className="mt-1 text-xs" style={{ color: 'var(--color-danger)' }}>{errors.gate.message}</p>}
            </div>

            <div>
              <label htmlFor="device-email" className="mb-1 block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Login Email (for the device)
              </label>
              <input
                id="device-email"
                type="email"
                {...register('email')}
                placeholder="maingate-entry@earist-devices.local"
                className="w-full rounded-md border px-3 py-2 text-sm outline-none"
                style={{
                  borderColor: errors.email ? 'var(--color-danger)' : 'var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--color-overlay)',
                }}
              />
              {errors.email && <p className="mt-1 text-xs" style={{ color: 'var(--color-danger)' }}>{errors.email.message}</p>}
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="device-password" className="mb-1 block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Login Password (for the device)
              </label>
              <input
                id="device-password"
                type="password"
                {...register('password')}
                placeholder="••••••••"
                className="w-full rounded-md border px-3 py-2 text-sm outline-none"
                style={{
                  borderColor: errors.password ? 'var(--color-danger)' : 'var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--color-overlay)',
                }}
              />
              {errors.password && <p className="mt-1 text-xs" style={{ color: 'var(--color-danger)' }}>{errors.password.message}</p>}
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={creating}
                className="flex items-center gap-2 rounded-md px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--color-brand)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                {creating ? 'Registering…' : 'Register Device'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Device List */}
      {devices.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-16"
          style={{
            borderColor: 'var(--color-border)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <Tablet className="mb-3 h-10 w-10" style={{ color: 'var(--color-text-muted)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            No devices registered yet
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Register a scanner tablet or kiosk to get started
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {devices.map((device) => (
            <div
              key={device.id}
              className="rounded-lg border p-4"
              style={{
                backgroundColor: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h3
                    className="text-sm font-semibold"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {device.name}
                  </h3>
                  <p
                    className="text-xs"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {device.gate}
                  </p>
                </div>
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-semibold"
                  style={{
                    ...statusStyles(device.status),
                    borderRadius: 'var(--radius-full)',
                  }}
                >
                  {device.status}
                </span>
              </div>

              <p
                className="mb-3 text-xs"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {typeBadge(device.type)}
              </p>

              <button
                type="button"
                onClick={() => toggleDeviceStatus(device)}
                className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium"
                style={{
                  borderColor: 'var(--color-border)',
                  color:
                    device.status === 'active'
                      ? 'var(--color-danger)'
                      : 'var(--color-success)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                {device.status === 'active' ? (
                  <>
                    <ShieldOff className="h-3 w-3" /> Revoke
                  </>
                ) : (
                  <>
                    <Shield className="h-3 w-3" /> Reactivate
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
