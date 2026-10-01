import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/hooks/useAuth';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LandingPage } from '@/pages/LandingPage';
import { GetPassPage } from '@/pages/GetPassPage';
import { LoginPage } from '@/pages/LoginPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { KioskPage } from '@/pages/KioskPage';
import { GuardPage } from '@/pages/GuardPage';
import { AdminPage } from '@/pages/AdminPage';
import { AdminDashboard } from '@/pages/AdminDashboard';
import { AdminUsers } from '@/pages/AdminUsers';
import { AdminRecords } from '@/pages/AdminRecords';
import { AdminSettings } from '@/pages/AdminSettings';
import { AdminEmergency } from '@/pages/AdminEmergency';
import { AdminAuditLogs } from '@/pages/AdminAuditLogs';
import { DevicesPage } from '@/pages/DevicesPage';
import { EntryScanPage } from '@/pages/EntryScanPage';
import { ExitScanPage } from '@/pages/ExitScanPage';
import { PrivacyModal } from '@/components/PrivacyModal';
import { OfflineBanner } from '@/components/OfflineBanner';

export function App() {
  return (
    <AuthProvider>
      <OfflineBanner />
      <PrivacyModal />
      <BrowserRouter>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>

        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/get-pass" element={<GetPassPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          {/* Kiosk — requires kiosk device account */}
          <Route element={<ProtectedRoute allowedRoles={['kiosk']} />}>
            <Route path="/kiosk" element={<KioskPage />} />
          </Route>

          {/* Scanner tablets — requires matching device account */}
          <Route element={<ProtectedRoute allowedRoles={['entry']} />}>
            <Route path="/scan/entry" element={<EntryScanPage />} />
          </Route>
          <Route element={<ProtectedRoute allowedRoles={['exit']} />}>
            <Route path="/scan/exit" element={<ExitScanPage />} />
          </Route>

          {/* Guard — requires guard or admin role */}
          <Route element={<ProtectedRoute allowedRoles={['guard', 'admin']} />}>
            <Route path="/guard" element={<GuardPage />} />
          </Route>

          {/* Admin — requires admin role, uses nested layout */}
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/admin" element={<AdminPage />}>
              <Route index element={<AdminDashboard />} />
              <Route path="visitors" element={<AdminRecords />} />
              <Route path="devices" element={<DevicesPage />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="emergency" element={<AdminEmergency />} />
              <Route path="audit" element={<AdminAuditLogs />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>
          </Route>
        </Routes>

        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{
            style: {
              borderRadius: 'var(--radius-md)',
            },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}
