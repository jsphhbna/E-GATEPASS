import { Handler } from '@netlify/functions';
import { v2 as cloudinary } from 'cloudinary';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { adminAuth } from './firebase-admin'; // Ensures app is initialized

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export const handler: Handler = async (event) => {
  const { httpMethod } = event;

  if (httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  // Verify CRON_SECRET or Admin Token
  const cronSecret = process.env.CRON_SECRET;
  const providedSecret = event.headers['x-cron-secret'] || event.headers['X-Cron-Secret'];
  
  let isAuthenticated = false;

  if (cronSecret && providedSecret === cronSecret) {
    isAuthenticated = true;
  } else {
    // Fallback: Check if request is from an Admin via Authorization header
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split('Bearer ')[1]!;
        const decodedToken = await adminAuth.verifyIdToken(token);
        
        const db = getFirestore();
        const userDoc = await db.collection('users').doc(decodedToken.uid).get();
        
        if (userDoc.exists && userDoc.data()?.role === 'admin') {
          isAuthenticated = true;
        }
      } catch (err) {
        console.error('Admin verification failed:', err);
      }
    }
  }

  if (!isAuthenticated) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  try {
    const db = getFirestore();

    // 1. Fetch settings to get retentionDays
    const settingsDoc = await db.collection('settings').doc('app').get();
    const settings = settingsDoc.data();
    if (!settings || typeof settings.retentionDays !== 'number') {
      return { statusCode: 500, body: 'Missing retentionDays in settings' };
    }

    const retentionDays = settings.retentionDays;

    // 2. Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // 3. Find visitors older than cutoffDate with imagesPurgedAt == null
    const snapshot = await db.collection('visitors')
      .where('imagesPurgedAt', '==', null)
      .where('createdAt', '<=', cutoffDate)
      .limit(50) // Process in small batches to avoid timeouts
      .get();

    if (snapshot.empty) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No images to purge at this time', count: 0 }),
      };
    }

    let successCount = 0;
    const errors: any[] = [];

    // 4. Process each visitor
    for (const doc of snapshot.docs) {
      const visitor = doc.data();
      const publicIdsToDestroy: string[] = [];

      if (visitor.photoPublicId) publicIdsToDestroy.push(visitor.photoPublicId);
      if (visitor.idImagePublicId) publicIdsToDestroy.push(visitor.idImagePublicId);

      try {
        // Delete from Cloudinary
        if (publicIdsToDestroy.length > 0) {
          for (const pid of publicIdsToDestroy) {
            await cloudinary.uploader.destroy(pid, { type: 'authenticated' });
          }
        }

        // Only mark as purged after successful Cloudinary deletion
        await doc.ref.update({
          imagesPurgedAt: FieldValue.serverTimestamp(),
        });

        successCount++;
      } catch (err) {
        console.error(`Failed to purge visitor ${doc.id}:`, err);
        errors.push({ id: doc.id, error: String(err) });
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Successfully purged images for ${successCount} visitors.`,
        successCount,
        errors,
      }),
    };
  } catch (error) {
    console.error('Purge error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};
