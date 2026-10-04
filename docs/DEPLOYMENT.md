# Deployment Guide

## Before deployment

Verify `git status`, the intended branch (`main` for production), `git rev-parse HEAD`, Netlify login/site link, and required environment variable names. Record the pre-release rollback commit and exclude `.tmp/` artifacts.

```bash
npm test
npm run build
npx tsc --noEmit
npm run typecheck:functions
git diff --check
npm audit
npm ls firebase-admin jwks-rsa jose
```

Review audit findings; never run `npm audit fix --force`. Incompatible dependency changes require deliberate testing.

## Firestore and Netlify

Project: `e-gatepass-c1870`.

```bash
npx firebase-tools@13.10.0 deploy --only firestore:indexes --project e-gatepass-c1870
npx firebase-tools@13.10.0 deploy --only firestore:rules --project e-gatepass-c1870
```

Deploy indexes first and wait for required indexes to be **READY**, including `imageUploads(status ASC, expiresAt ASC)`. Deploy rules near application cutover. Push the reviewed commit to `main` without force-pushing, then verify Netlify auto-deploy, build/functions, and runtime logs. Node 24 plus `NODE_OPTIONS=--experimental-require-module` and the known `firebase-admin@14.5.0` / `jwks-rsa@4.1.0` / `jose@6.2.12` chain are required.

## Rollback and smoke test

Netlify can redeploy a prior successful deploy; Firestore rules can be redeployed from a reviewed prior commit. Index creation is asynchronous. Auth password changes, account deletion, and Cloudinary deletion are not generally reversible.

Smoke test public flow, Admin, Super Admin, Guard, Kiosk, Entry, Exit, and one authorized controlled lifecycle: issue → entry → Guard decision → inside → exit. Inspect Netlify logs, Firestore permission errors, index status, and Cloudinary failures.
