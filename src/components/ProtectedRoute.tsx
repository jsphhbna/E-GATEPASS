import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import type { AuthRole } from '@/types';

interface ProtectedRouteProps {
  /** Roles allowed to access this route */
  allowedRoles: AuthRole[];
  /** Where to redirect if not authenticated */
  loginPath?: string;
  /** Where to redirect if authenticated but wrong role */
  unauthorizedPath?: string;
}

/**
 * Route guard that checks Firebase auth state and Firestore role.
 * Redirects to login if unauthenticated, or to unauthorized page if wrong role.
 */
export function ProtectedRoute({
  allowedRoles,
  loginPath = '/login',
  unauthorizedPath = '/login',
}: ProtectedRouteProps) {
  const { status, role } = useAuth();

  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-brand)] border-t-transparent"
          role="status"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to={loginPath} replace />;
  }

  if (!allowedRoles.includes(role)) {
    return <Navigate to={unauthorizedPath} replace />;
  }

  return <Outlet />;
}
