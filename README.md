# EARIST E-GatePass

A comprehensive web-based visitor management system for EARIST, utilizing Firebase (Firestore, Auth) and Cloudinary for real-time QR-based gate passes, kiosk walk-ins, and strict data privacy compliance.

## Features

- **Get Pass Portal**: Public-facing portal for visitors to request a gate pass (Webcam + ID upload).
- **Kiosk Walk-In**: On-site tablet walk-in registration with thermal printing support.
- **Scanner Devices**: Dedicated accounts for Entry and Exit tablets to scan QR codes and update visitor status in real-time.
- **Guard Dashboard**: Real-time queue of incoming visitors. Guards can approve/reject with premade reasons and sound alerts.
- **Admin Dashboard**: Comprehensive dashboard for viewing metrics, exporting CSVs, managing users, revoking devices, and purging old data.
- **Privacy First**: `imagesPurgedAt` ensures visitor photos are permanently deleted from Cloudinary and logged in Firestore after the retention period.
- **Offline Resilience**: Offline banners and Firestore persistence for spotty connections.

## Local Development

### Requirements
- Node.js 22 or newer (required by the installed Firebase Admin SDK)
- Java 11 or newer (required for the Firebase emulator test suite)
- Firebase CLI (`npm install -g firebase-tools`)
- Netlify CLI (`npm install -g netlify-cli`)

### Setup

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   *Fill in your Firebase config, Cloudinary credentials, and Firebase Admin service account details.*

3. Start the development server using Netlify Dev (required for `/api/image` edge functions):
   ```bash
   netlify dev
   ```

## Deploying to Netlify (HTTPS Device Testing)

To test scanner devices (camera access) and kiosk webcams on mobile devices, you **must** serve the app over HTTPS. The easiest way to do this is to deploy to Netlify.

### Step 1: Initialize Netlify
Run the following command in your terminal and log in to Netlify:
```bash
netlify login
netlify init
```
*Follow the prompts to create & configure a new site.*

### Step 2: Set Environment Variables on Netlify
Your local `.env.local` is ignored by Git (for security). You must copy these variables to Netlify so your backend functions work in production.
Run this command for each variable, or enter them via the Netlify Web UI:
```bash
netlify env:set VITE_FIREBASE_API_KEY "your_key"
netlify env:set CLOUDINARY_API_KEY "your_key"
netlify env:set FIREBASE_PRIVATE_KEY "your_escaped_private_key"
# (Repeat for all variables in .env.local)
```

### Step 3: Deploy to Production
Build and deploy the application to your live Netlify URL:
```bash
netlify deploy --prod
```

### Step 4: Test on Mobile
Netlify will output a live URL (e.g., `https://earist-egatepass-xyz.netlify.app`). 
1. Open that URL on your phone or tablet.
2. The browser will securely prompt for Camera permissions.
3. You can now test the QR Scanner (`/scan/entry`) and the Webcam capture (`/get-pass` or `/kiosk`).

## Architecture & Security Rules

- **Firebase Auth and Firestore roles**: Staff roles are `guard`, `admin`, and `superadmin`; device roles are `entry`, `exit`, and `kiosk`. Sensitive role and account-status changes are authorized and audited by backend functions.
- **Firestore Rules**: Direct privilege escalation is denied. Guards retain visitor-operation access, Admins retain daily operational administration, and Super Admins control security-sensitive administration.
- **Netlify Functions**: Secure proxy (`/api/image`) ensures Cloudinary images are only accessible to authenticated staff, preventing public exposure of visitor IDs.

### First Super Admin

There is no public bootstrap endpoint. Select exactly one existing active Admin and follow the one-time Firebase Console procedure in [First Super Admin Bootstrap](docs/SUPER_ADMIN_BOOTSTRAP.md). Do not automatically promote all existing Admins.

## License
Proprietary / Closed Source - EARIST.
