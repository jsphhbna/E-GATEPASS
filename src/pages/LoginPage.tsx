import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { Shield } from 'lucide-react';

export function LoginPage() {
  const navigate = useNavigate();
  const { status, role } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Redirect if already authenticated
  if (status === 'authenticated' && role) {
    const redirectMap: Record<string, string> = {
      admin: '/admin',
      guard: '/guard',
      entry: '/scan/entry',
      exit: '/scan/exit',
      kiosk: '/kiosk',
    };
    const target = redirectMap[role] ?? '/login';
    navigate(target, { replace: true });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged in AuthProvider handles role resolution and redirect
    } catch {
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div
        className="w-full max-w-sm rounded-xl p-8"
        style={{
          backgroundColor: 'var(--color-surface)',
          boxShadow: 'var(--shadow-md)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <div className="mb-6 text-center">
          <div
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ backgroundColor: 'var(--color-brand-light)' }}
          >
            <Shield
              className="h-6 w-6"
              style={{ color: 'var(--color-brand)' }}
              aria-hidden="true"
            />
          </div>
          <h1
            className="text-xl font-bold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Sign In
          </h1>
          <p
            className="mt-1 text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            EARIST E-GatePass Staff Portal
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="login-email"
              className="mb-1 block text-sm font-medium"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Email
            </label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none"
              style={{
                borderColor: 'var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-overlay)',
              }}
              placeholder="guard@earist.edu.ph"
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="mb-1 block text-sm font-medium"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Password
            </label>
            <input
              id="login-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none"
              style={{
                borderColor: 'var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-overlay)',
              }}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-md px-3 py-2 text-sm font-medium"
              style={{
                backgroundColor: 'var(--color-danger-light)',
                color: 'var(--color-danger)',
                borderRadius: 'var(--radius-xs)',
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{
              backgroundColor: 'var(--color-brand)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </main>
  );
}
