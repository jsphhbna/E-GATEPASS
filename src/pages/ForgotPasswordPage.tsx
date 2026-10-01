import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Card, Button, Input, FormField } from '@/components/ui';
import { BrandMark } from '@/components/BrandMark';
import { toast } from 'sonner';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    let timer: any;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }
    
    // Basic email format check
    if (!/\S+@\S+\.\S+/.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (countdown > 0) return;

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success('If an account exists for this email, a password reset link has been sent.', {
        duration: 5000
      });
      setCountdown(60);
    } catch (err: any) {
      console.error('Password reset error:', err);
      if (err.code === 'auth/network-request-failed') {
        toast.error('Network error. Please check your connection and try again.');
      } else if (err.code === 'auth/too-many-requests') {
        toast.error('Too many attempts. Please try again later.');
      } else {
        // Fallback for generic errors without exposing too much
        toast.error('Failed to send reset email. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 bg-[var(--color-canvas)]">
      <Card className="w-full max-w-sm p-8 shadow-sm">
        <div className="mb-8 text-center">
          <BrandMark size="lg" className="mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            Forgot Password
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Enter the email address associated with your account and we'll send you a link to reset your password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <FormField label="Email">
            <Input
              id="reset-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="guard@earist.edu.ph"
              disabled={loading || countdown > 0}
            />
          </FormField>

          <Button
            type="submit"
            disabled={loading || countdown > 0}
            className="w-full"
            size="lg"
          >
            {loading ? 'Sending...' : countdown > 0 ? `Resend link in ${countdown}s` : 'Send Reset Link'}
          </Button>

          <div className="text-center pt-2">
            <Link to="/login" className="text-sm font-medium text-[var(--color-brand)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] rounded-sm">
              Back to Sign In
            </Link>
          </div>
        </form>
      </Card>
    </main>
  );
}
