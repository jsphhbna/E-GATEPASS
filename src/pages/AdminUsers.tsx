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
import { Plus } from 'lucide-react';
import { Button, FormField, Input, StatusBadge, DataTable, DataTableHead, DataTableRow, DataTableCell, Modal, ConfirmModal } from '@/components/ui';
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
  const [deactivatingUser, setDeactivatingUser] = useState<AppUserWithId | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

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

      let emailSent = false;
      try {
        const { sendEmailVerification } = await import('firebase/auth');
        await sendEmailVerification(userCredential.user);
        emailSent = true;
      } catch (emailErr: any) {
        console.error('Email verification error:', emailErr);
      }

      // Create user doc in Firestore
      await setDoc(doc(db, 'users', uid), {
        name: data.name,
        email: data.email,
        role: data.role,
        active: true,
        privacyAcceptedAt: null,
        mustChangePassword: data.role === 'guard',
        createdAt: serverTimestamp(),
      });

      if (emailSent) {
        toast.success(`${data.role} account created. Verification email sent!`);
      } else {
        toast.warning(`${data.role} account created, but failed to send verification email.`);
      }
      setIsCreating(false);
      reset();
      loadUsers();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to create user');
    }
  }

  async function handleDeactivate(user: AppUserWithId) {
    setIsDeactivating(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { active: false });
      toast.success('User deactivated successfully');
      setDeactivatingUser(null);
      loadUsers();
    } catch (err) {
      console.error(err);
      toast.error('Failed to deactivate user');
    } finally {
      setIsDeactivating(false);
    }
  }

  async function toggleStatus(user: AppUserWithId) {
    if (user.active) {
      setDeactivatingUser(user);
    } else {
      // Reactivate instantly
      try {
        await updateDoc(doc(db, 'users', user.uid), { active: true });
        toast.success('User activated successfully');
        loadUsers();
      } catch (err) {
        console.error(err);
        toast.error('Failed to update user status');
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            User Management
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Manage guard and admin accounts
          </p>
        </div>
        <Button onClick={() => setIsCreating(true)} icon={<Plus className="h-4 w-4" />}>
          Add User
        </Button>
      </div>

      <Modal 
        isOpen={isCreating} 
        onClose={() => {
          setIsCreating(false);
          reset();
        }}
        title="Create New Account"
        preventClose={isSubmitting}
        size="sm"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <FormField label="Name" error={errors.name?.message}>
            <Input type="text" {...register('name')} error={!!errors.name} />
          </FormField>

          <FormField label="Email" error={errors.email?.message}>
            <Input type="email" {...register('email')} error={!!errors.email} />
          </FormField>

          <FormField label="Password" error={errors.password?.message}>
            <Input type="password" {...register('password')} error={!!errors.password} />
          </FormField>

          <FormField label="Role" error={errors.role?.message}>
            <select 
              {...register('role')} 
              className="w-full rounded-md border px-3 py-2 text-sm outline-none bg-transparent"
              style={{
                borderColor: errors.role ? 'var(--color-danger)' : 'var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            >
              <option value="guard">Guard</option>
              <option value="admin">Admin</option>
            </select>
          </FormField>

          <Button type="submit" disabled={isSubmitting} className="w-full" loading={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Account'}
          </Button>
        </form>
      </Modal>

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[var(--color-brand)]" />
        </div>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableCell isHeader>Name</DataTableCell>
              <DataTableCell isHeader>Email</DataTableCell>
              <DataTableCell isHeader>Role</DataTableCell>
              <DataTableCell isHeader>Status</DataTableCell>
              <DataTableCell isHeader className="text-right">Actions</DataTableCell>
            </DataTableRow>
          </DataTableHead>
          <tbody>
            {users.map((user) => (
              <DataTableRow key={user.uid}>
                <DataTableCell className="font-semibold">{user.name}</DataTableCell>
                <DataTableCell className="text-[var(--color-text-secondary)]">{user.email}</DataTableCell>
                <DataTableCell>
                  <StatusBadge 
                    status={user.role === 'admin' ? 'issued' : 'pending'} 
                    label={user.role} 
                  />
                </DataTableCell>
                <DataTableCell>
                  <StatusBadge 
                    status={user.active ? 'inside' : 'rejected'} 
                    label={user.active ? 'Active' : 'Deactivated'} 
                  />
                </DataTableCell>
                <DataTableCell className="text-right">
                  <Button
                    variant="ghost"
                    onClick={() => toggleStatus(user)}
                    className="text-[var(--color-brand)] hover:bg-[var(--color-brand-light)]"
                  >
                    {user.active ? 'Deactivate' : 'Activate'}
                  </Button>
                </DataTableCell>
              </DataTableRow>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[var(--color-text-muted)]">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </DataTable>
      )}

      <ConfirmModal
        isOpen={!!deactivatingUser}
        onClose={() => setDeactivatingUser(null)}
        title="Deactivate User?"
        description={
          <>
            Are you sure you want to deactivate <strong className="text-[var(--color-text-primary)]">{deactivatingUser?.name}</strong>?
            They will lose access immediately. You can reactivate them later.
          </>
        }
        onConfirm={() => {
          if (deactivatingUser) handleDeactivate(deactivatingUser);
        }}
        confirmText="Deactivate"
        isDestructive
        loading={isDeactivating}
      />
    </div>
  );
}
