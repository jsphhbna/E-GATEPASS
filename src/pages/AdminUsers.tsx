import { useState, useEffect } from 'react';
import {
  collection,
  query,
  getDocs,
  doc,
  setDoc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { FirebaseApp, initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { AppUser } from '@/types';

// Use same config as primary app
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let secondaryApp: FirebaseApp | null = null;
try {
  secondaryApp = initializeApp(firebaseConfig, 'SecondaryAppUserCreation');
} catch (error) {
  console.error('Secondary app init error:', error);
}

const userSchema = z.object({
  name: z.string().min(2, 'Name is required').max(50),
  email: z.string().email('Valid email required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum({ admin: 'admin', guard: 'guard' }, {
    message: 'Select a valid role',
  }),
});
type UserFormData = z.infer<typeof userSchema>;

interface AppUserWithId extends AppUser {
  uid: string;
}

export function AdminUsers() {
  const [users, setUsers] = useState<AppUserWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: { role: 'guard' },
  });

  async function loadUsers() {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'));
      const snap = await getDocs(q);
      const list: AppUserWithId[] = [];
      snap.forEach((d) => {
        list.push({ uid: d.id, ...d.data() } as AppUserWithId);
      });
      setUsers(list);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function onSubmit(data: UserFormData) {
    if (!secondaryApp) {
      toast.error('Secondary app not initialized');
      return;
    }

    try {
      const secondaryAuth = getAuth(secondaryApp);
      // Create user in Auth (this won't sign out the admin in the primary app)
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        data.email,
        data.password
      );

      const uid = userCredential.user.uid;

      // Create user doc in Firestore
      await setDoc(doc(db, 'users', uid), {
        name: data.name,
        email: data.email,
        role: data.role,
        active: true,
        privacyAcceptedAt: null,
        createdAt: serverTimestamp(),
      });

      toast.success(`${data.role} account created successfully!`);
      setIsCreating(false);
      reset();
      loadUsers();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to create user');
    }
  }

  async function toggleStatus(uid: string, currentStatus: boolean) {
    try {
      await updateDoc(doc(db, 'users', uid), {
        active: !currentStatus,
      });
      toast.success(
        `User ${!currentStatus ? 'activated' : 'deactivated'} successfully`
      );
      loadUsers();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update user status');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            User Management
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Manage guard and admin accounts
          </p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" /> Add User
        </button>
      </div>

      {isCreating && (
        <div className="rounded-xl border p-5" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Create New Account</h2>
            <button onClick={() => setIsCreating(false)} className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-800">
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
            <div>
              <label className="mb-1 block text-sm font-medium">Name</label>
              <input type="text" {...register('name')} className="w-full rounded-md border px-3 py-2 text-sm" />
              {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Email</label>
              <input type="email" {...register('email')} className="w-full rounded-md border px-3 py-2 text-sm" />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Password</label>
              <input type="password" {...register('password')} className="w-full rounded-md border px-3 py-2 text-sm" />
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Role</label>
              <select {...register('role')} className="w-full rounded-md border px-3 py-2 text-sm">
                <option value="guard">Guard</option>
                <option value="admin">Admin</option>
              </select>
              {errors.role && <p className="mt-1 text-xs text-red-500">{errors.role.message}</p>}
            </div>

            <button type="submit" disabled={isSubmitting} className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50">
              {isSubmitting ? 'Creating...' : 'Create Account'}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 uppercase dark:bg-gray-900/50">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
              {users.map((user) => (
                <tr key={user.uid} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-medium">{user.name}</td>
                  <td className="px-4 py-3 text-gray-500">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                      user.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {user.active ? 'Active' : 'Deactivated'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => toggleStatus(user.uid, user.active)}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      {user.active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
