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

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    // 1. Verify Firebase Auth
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Missing or invalid token' }) };
    }

    const token = authHeader.split('Bearer ')[1]!;
    await adminAuth.verifyIdToken(token); // Throws if invalid or expired

    // 2. Parse request to get folder name (optional)
    const body = event.body ? JSON.parse(event.body) : {};
    const folder = body.folder || 'e-gatepass';

    // 3. Generate Cloudinary signature
    const timestamp = Math.round(new Date().getTime() / 1000);
    const paramsToSign = {
      timestamp,
      folder,
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
  } catch (error) {
    console.error('Cloudinary Sign Error:', error);
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Authentication failed or internal error' }),
    };
  }
};
