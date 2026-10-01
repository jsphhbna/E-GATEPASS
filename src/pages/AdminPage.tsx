import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  Users,
  Tablet,
  Settings,
  FileText,
  AlertTriangle,
  ClipboardList,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import { ConfirmModal } from '@/components/ui';
import { useState } from 'react';
import type { AppUser } from '@/types';

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/visitors', icon: FileText, label: 'Visitors', end: false },
  { to: '/admin/devices', icon: Tablet, label: 'Devices', end: false },
  { to: '/admin/users', icon: Users, label: 'Users', end: false },
  { to: '/admin/emergency', icon: AlertTriangle, label: 'Emergency', end: false },
  { to: '/admin/audit', icon: ClipboardList, label: 'Audit Logs', end: false },
  { to: '/admin/settings', icon: Settings, label: 'Settings', end: false },
];

export function AdminPage() {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const adminName = (userData as AppUser | null)?.name ?? 'Admin';

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await signOut(auth);
      navigate('/login', { replace: true });
    } finally {
      setIsSigningOut(false);
      setShowSignOutModal(false);
    }
  }

  return (
    <div className="flex min-h-dvh">
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        className="fixed left-3 top-3 z-40 rounded-md p-2 md:hidden"
        style={{
          backgroundColor: 'var(--color-surface)',
          boxShadow: 'var(--shadow-sm)',
          borderRadius: 'var(--radius-sm)',
        }}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" style={{ color: 'var(--color-text-primary)' }} />
      </button>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r transition-transform duration-200 md:relative md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b p-4"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div className="flex items-center gap-2">
            <BrandMark size="sm" />
            <span
              className="text-sm font-bold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              E-GatePass
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="md:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" style={{ color: 'var(--color-text-muted)' }} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className="mb-0.5 flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium no-underline"
              style={({ isActive }) => ({
                backgroundColor: isActive ? 'var(--color-brand-light)' : 'transparent',
                color: isActive ? 'var(--color-brand)' : 'var(--color-text-secondary)',
                borderRadius: 'var(--radius-sm)',
              })}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div
          className="border-t p-3"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <p
            className="mb-2 truncate text-xs font-medium"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Signed in as {adminName}
          </p>
          <button
            type="button"
            onClick={() => setShowSignOutModal(true)}
            className="flex w-full items-center justify-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium"
            style={{
              borderColor: 'var(--color-border)',
              color: 'var(--color-danger)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <LogOut className="h-3 w-3" />
            Sign Out
          </button>
        </div>
      </aside>

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

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
}

