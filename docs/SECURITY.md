# Security

Frontend checks improve UX only. Firestore Rules and Netlify Functions are authoritative. Firebase Admin and Cloudinary secrets live in Netlify variables only: never use `VITE_*`, source control, audit data, or browser code for secrets.

There is no public Super Admin bootstrap endpoint. Use the authorized manual procedure in [Super Admin Bootstrap](SUPER_ADMIN_BOOTSTRAP.md); protected updates preserve at least one active Super Admin. Devices are authenticated accounts constrained by status, type, and gate.

Cloudinary destructive credentials stay server-side. A public asset ID is not authority: image access needs an authorized application reference. Trusted mutations record audit information; unresolved external partial operations create server-only reconciliation tasks. Review dependency advisories before releases; do not force upgrades or downgrades without compatibility testing.
