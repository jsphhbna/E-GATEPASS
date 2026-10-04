# Architecture

```text
Browser (React/Vite) → Firebase Auth / Firestore
Browser /api/* → Netlify Functions → Firebase Admin / Cloudinary
GitHub main → Netlify; Firestore rules/indexes deploy separately
```

`users/{uid}` defines active staff roles (`guard`, `admin`, `superadmin`); `devices/{uid}` defines active `entry`, `exit`, and `kiosk` devices. Route guards are UI only. Firestore Rules and functions re-check authorization.

Passes in `gatePasses` follow `valid` → `pending` → `approved` → `inside` → `exited`, with `rejected` and invalid/expired outcomes. Scanner functions transactionally enforce device type/gate and create `visitLogs`; Guard decisions use a protected function.

Browser reads are rule-limited. Public/Kiosk pass creation, scans, decisions, settings, account/device actions, image cleanup, and reconciliation use functions. `auditLogs` and `reconciliationTasks` are server-authored. Cloudinary signatures create server-only `imageUploads`; pass creation claims them, and authorized `/api/image` access never treats an asset ID as permission.
