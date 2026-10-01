import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, sendEmailVerification, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { Card, Button, Input, FormField } from '@/components/ui';
import { BrandMark } from '@/components/BrandMark';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export function LoginPage() {
  const navigate = useNavigate();
  const { status, role } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [unverifiedPassword, setUnverifiedPassword] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

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

  async function handleResendVerification() {
    if (resendCooldown > 0 || !unverifiedEmail || !unverifiedPassword) return;
    setLoading(true);
    try {
      const userCred = await signInWithEmailAndPassword(auth, unverifiedEmail, unverifiedPassword);
      await sendEmailVerification(userCred.user);
      await signOut(auth);
      toast.success('Verification email resent. Please check your inbox.');
      setResendCooldown(60);
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend verification email.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setUnverifiedEmail('');
    setUnverifiedPassword('');
    setLoading(true);

    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      await userCred.user.reload();
      
      const userDoc = await getDoc(doc(db, 'users', userCred.user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if ((userData.role === 'admin' || userData.role === 'guard') && userData.active) {
          if (!auth.currentUser?.emailVerified) {
            await signOut(auth);
            setUnverifiedEmail(email);
            setUnverifiedPassword(password);
            const msg = 'Account not verified. Please verify your email first. Check your inbox, spam, or trash folder for the verification email.';
            setError(msg);
            toast.error(msg, { id: 'unverified-toast' });
            setLoading(false);
            return;
          }
          await auth.currentUser?.getIdToken(true);
        }
      }
      
      // onAuthStateChanged in AuthProvider handles role resolution and redirect
    } catch {
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 bg-[var(--color-canvas)]">
      <Card className="w-full max-w-sm p-8">
        <div className="mb-8 text-center">
          <BrandMark size="lg" className="mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            Sign In
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            EARIST E-GatePass Staff Portal
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <FormField label="Email">
            <Input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="guard@earist.edu.ph"
            />
          </FormField>

          <FormField label="Password">
            <div className="relative">
              <Input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </FormField>

          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-600 border border-red-200 flex flex-col gap-3">
              <p role="alert">{error}</p>
              {unverifiedEmail && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleResendVerification}
                  disabled={resendCooldown > 0 || loading}
                  className="w-full text-red-700 border-red-300 hover:bg-red-100"
                >
                  {resendCooldown > 0 ? `Resend available in ${resendCooldown}s` : 'Resend Verification Email'}
                </Button>
              )}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </Card>
    </main>
  );
}
