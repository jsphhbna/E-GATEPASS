# Operations Guide

## Accounts and devices

Super Admins use protected user/device controls to create and manage staff and device accounts. Admins handle daily operations but cannot change Super Admin-only settings. Do not demote or deactivate the last active Super Admin; backend protection rejects it. Prefer disabling an account to deleting it when historical attribution must remain.

Kiosk, Entry, and Exit are authenticated device accounts. Verify each is active; Entry/Exit must have the correct type and gate assignment. Do not share device credentials or use a staff account as a scanner.

## Working hours

`settings/app.workingHours` uses Asia/Manila time. The documented fallback is 08:00–17:00 if settings are missing/invalid. Only Super Admin can change working hours; see [Working Hours and Exports](WORKING_HOURS_AND_EXPORTS.md).

## Logs, images, and exports

`visitLogs` are operational events visible to Guards and administrators. `auditLogs` are administrative/system events visible to administrators. `reconciliationTasks` are server-only; Super Admin sees a bounded sanitized list through the reconciliation endpoint. Cloudinary stores images, but access is application-authorized by references. Never expose Cloudinary secrets or manually delete assets with browser credentials; use the protected purge flow.

Filtered CSV exports page through results and stop at 10,000 source records. Print is only the currently loaded view.

## Routine health checks

Check Netlify deployment/function logs, Firebase permission errors, Firestore index readiness, Cloudinary failures, and inactive or incorrectly configured devices.
