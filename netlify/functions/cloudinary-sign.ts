import { Handler } from '@netlify/functions';
import { v2 as cloudinary } from 'cloudinary';
import { adminAuth } from './firebase-admin';

// Configure Cloudinary using server-only env vars
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Server-controlled allowlist of Cloudinary folders.
// The generic root 'e-gatepass' folder is NOT included because all uploads
// go to either 'e-gatepass/photos' or 'e-gatepass/ids' in the current codebase.
const ALLOWED_FOLDERS = ['e-gatepass/ids', 'e-gatepass/photos'] as const;

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    // Verify Firebase auth token (allows anonymous visitors and device accounts)
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Missing or invalid token' }) };
    }

    const token = authHeader.split('Bearer ')[1]!;
    await adminAuth.verifyIdToken(token);

    // Parse and validate the requested folder
    const body = event.body ? JSON.parse(event.body) : {};
    const requestedFolder: string = body.folder || '';

    if (!ALLOWED_FOLDERS.includes(requestedFolder as typeof ALLOWED_FOLDERS[number])) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid folder requested' }) };
    }

    // Generate Cloudinary signature with a fixed, server-controlled parameter set.
    // Only timestamp and folder are signed — the client cannot inject arbitrary
    // Cloudinary parameters (transformations, tags, etc.) into the signature.
    const timestamp = Math.round(new Date().getTime() / 1000);
    const paramsToSign = {
      timestamp,
      folder: requestedFolder,
    };

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET!
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timestamp,
        signature,
        apiKey: process.env.CLOUDINARY_API_KEY,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      }),
    };
  } catch (error: any) {
    console.error('Cloudinary Sign Error:', error);
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Authentication failed or internal error', details: error.message }),
    };
  }
};
