import { Handler } from '@netlify/functions';
import { v2 as cloudinary } from 'cloudinary';
import { requireAdmin, requireGuardOrAdmin, handleAuthError } from './utils/auth';

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
    // 1. Get Public ID first to fail fast if missing
    const publicId = event.queryStringParameters?.publicId;
    if (!publicId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing publicId' }) };
    }

    // ============================================================================
    // DELETE: Admin only
    // ============================================================================
    if (httpMethod === 'DELETE') {
      await requireAdmin(event.headers.authorization || event.headers.Authorization);

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
    await requireGuardOrAdmin(event.headers.authorization || event.headers.Authorization);

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
    return handleAuthError(error);
  }
};
