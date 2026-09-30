import { Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

export function LandingPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ backgroundColor: 'var(--color-brand-light)' }}
        >
          <Shield
            className="h-8 w-8"
            style={{ color: 'var(--color-brand)' }}
            aria-hidden="true"
          />
        </div>

        <h1
          className="mb-2 text-3xl font-bold tracking-tight"
          style={{ color: 'var(--color-text-primary)' }}
        >
          EARIST E-GatePass
        </h1>
        <p
          className="mb-8 text-base"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Smart QR Code-Based Visitor Management System
        </p>

        <Link
          to="/get-pass"
          className="inline-flex items-center justify-center rounded-lg px-8 py-3 text-base font-semibold text-white no-underline"
          style={{
            backgroundColor: 'var(--color-brand)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          Get Gate Pass
        </Link>
      </div>
    </main>
  );
}
