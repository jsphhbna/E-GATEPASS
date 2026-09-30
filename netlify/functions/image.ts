import { Handler } from '@netlify/functions';
import { v2 as cloudinary } from 'cloudinary';
import { adminAuth } from './firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export const handler: Handler = async (event) => {
  const { httpMethod } = event;

  if (httpMethod !== 'GET' && httpMethod !== 'DELETE') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    // 1. Verify Auth
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Missing or invalid token' }) };
    }

    const token = authHeader.split('Bearer ')[1]!;
    const decodedToken = await adminAuth.verifyIdToken(token);

    // 2. Resolve Role from Firestore
    const db = getFirestore();
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    
    if (!userDoc.exists) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Staff access required' }) };
    }
    
    const role = userDoc.data()?.role;
    
    // 3. Get Public ID
    const publicId = event.queryStringParameters?.publicId;
    if (!publicId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing publicId' }) };
    }

    // ============================================================================
    // DELETE: Admin only
    // ============================================================================
    if (httpMethod === 'DELETE') {
      if (role !== 'admin') {
        return { statusCode: 403, body: JSON.stringify({ error: 'Admin access required' }) };
      }

      await cloudinary.uploader.destroy(publicId);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' } as Record<string, string>,
        body: JSON.stringify({ success: true }),
      };
    }

    // ============================================================================
    // GET: Staff only (Admin/Guard)
    // ============================================================================
    if (role !== 'admin' && role !== 'guard') {
      return { statusCode: 403, body: JSON.stringify({ error: 'Staff access required' }) };
    }

    const imageUrl = cloudinary.url(publicId, {
      secure: true,
      sign_url: true,
    });

    const imageResponse = await fetch(imageUrl);
    
    if (!imageResponse.ok) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Image not found' }) };
    }

    const imageBuffer = await imageResponse.arrayBuffer();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': imageResponse.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'private, max-age=3600',
      } as Record<string, string>,
      body: Buffer.from(imageBuffer).toString('base64'),
      isBase64Encoded: true,
    };

  } catch (error) {
    console.error('Image Proxy Error:', error);
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' } as Record<string, string>,
      body: JSON.stringify({ error: 'Authentication failed or internal error' }),
    };
  }
};
