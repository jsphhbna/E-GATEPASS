# E-GatePass Styling Audit

The following pages, modals, and components still use the old styling (blue accents, Shield icons, gray inputs) and will be updated to the EARIST brand look:

## Pages
- `LoginPage.tsx`: Uses `Shield` icon and `--color-brand` for the header/buttons.
- `KioskPage.tsx`: Uses `Shield` icon, `--color-brand`, `bg-blue-600` for buttons, and `bg-blue-50` for cards.
- `GuardPage.tsx`: Uses `Shield` icon, `--color-brand` for icons, and blue tints (`bg-blue-50`, `text-blue-600`) for the "Currently Inside" stats tile.
- `GetPassPage.tsx`: Uses `Shield` icon, `--color-brand` and `--color-brand-light` for the stepper, buttons, and focus rings.
- `EntryScanPage.tsx` / `ExitScanPage.tsx`: Uses `Shield` icon and `--color-brand` for the idle state scanner frame.
- `AdminPage.tsx`: The main admin layout uses `Shield` for the logo and `--color-brand` for active sidebar items.
- `AdminDashboard.tsx`: Recharts charts use `--color-brand` (blue).
- `AdminUsers.tsx`: Uses `bg-blue-600` for buttons, `bg-blue-100` for badges, and `text-blue-600` for links.
- `AdminSettings.tsx`: Uses `bg-blue-600` for save buttons and active toggles.
- `AdminAuditLogs.tsx`: Uses `Shield` for the empty state icon and `text-blue-600` for system actions.
- `DevicesPage.tsx`: Uses `Shield` for icons and `--color-brand` for status indicators.

## Components & Modals
- `PrivacyModal.tsx`: Uses `ShieldCheck` icon, `bg-blue-600` header, and `text-blue-500` bullets.
- `ProtectedRoute.tsx`: Loading spinner uses `border-[var(--color-brand)]`.
- Inputs/Selects (across forms): Currently relying on standard Tailwind gray borders and focus rings, will be replaced by themed shared components.
