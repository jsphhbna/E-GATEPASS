# Operations Guide

## Accounts and devices

Super Admins use protected user/device controls to create and manage staff and device accounts. Admins handle daily operations but cannot change Super Admin-only settings. Do not demote or deactivate the last active Super Admin; backend protection rejects it. Prefer disabling an account to deleting it when historical attribution must remain.

Kiosk, Entry, and Exit are authenticated device accounts. Verify each is active; Entry/Exit must have the correct type and gate assignment. Do not share device credentials or use a staff account as a scanner.

## Working hours

`settings/app.workingHours` uses Asia/Manila time. The documented fallback is 08:00–17:00 if settings are missing/invalid. Only Super Admin can change working hours; see [Working Hours and Exports](WORKING_HOURS_AND_EXPORTS.md).

## Retention

Super Admins configure visitor/history (default 30 days, range 7–365), images (7, 1–90), audit logs (365, 90–1095), and resolved reconciliation records (90, 30–365). Automatic cleanup runs daily through Netlify using `CRON_SECRET` and bounded batches. Active `issued`, `pending`, and `inside` passes, unresolved reconciliation tasks, and security-sensitive audit actions are protected. Export required archives before retention expiry. See [Environment and Scheduled Cleanup Handoff](ENVIRONMENT_AND_CRON.md) for the machine-to-machine cleanup authorization and rotation procedure.

Unclaimed-upload `imageUploads.expiresAt`, visitor-image lifetime, and manual image purge are separate. A changed image policy applies to new visitor records and does not rewrite existing deadlines. A manual purge requires Super Admin confirmation and handles one bounded batch (up to 25 visitors) per confirmation.

Cleanup order is deliberate: remove referenced Cloudinary assets, then mark `imagesPurgedAt`; only a closed pass with a purged image state, no other pass for its visitor, and no pending reconciliation is eligible for one atomic deletion of its visit logs, upload metadata, pass, and visitor. Ordinary audit events may then expire; security-sensitive audit events and unresolved reconciliation records are never automatically deleted.

## Logs, images, and exports

`visitLogs` are operational events visible to Guards and administrators. `auditLogs` are administrative/system events visible to administrators. `reconciliationTasks` are server-only; Super Admin sees a bounded sanitized list through the reconciliation endpoint. Cloudinary stores images, but access is application-authorized by references. Never expose Cloudinary secrets or manually delete assets with browser credentials; use the protected purge flow.

Filtered CSV exports page through results and stop at 10,000 source records. Print is only the currently loaded view.

## Routine health checks

Check Netlify deployment/function logs, Firebase permission errors, Firestore index readiness, Cloudinary failures, and inactive or incorrectly configured devices.
