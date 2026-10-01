import { Handler } from '@netlify/functions';
import { v2 as cloudinary } from 'cloudinary';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { adminAuth } from './firebase-admin';
import crypto from 'crypto';

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

  // Parse body for dryRun
  let body = {};
  try {
    if (event.body) {
      body = JSON.parse(event.body);
    }
  } catch (e) {
    // ignore
  }
  const isDryRun = !!(body as any).dryRun;

  const cronSecret = process.env.CRON_SECRET;
  const providedSecret = event.headers['x-cron-secret'] || event.headers['X-Cron-Secret'];
  
  let isAuthenticated = false;

  if (cronSecret && providedSecret) {
    const a = Buffer.from(cronSecret);
    const b = Buffer.from(providedSecret);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      isAuthenticated = true;
    }
  }

  if (!isAuthenticated) {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split('Bearer ')[1]!;
        const decodedToken = await adminAuth.verifyIdToken(token);
        
        const db = getFirestore();
        const userDoc = await db.collection('users').doc(decodedToken.uid).get();
        
        if (userDoc.exists) {
          const userData = userDoc.data();
          if (userData?.role === 'admin' && userData?.active === true) {
            isAuthenticated = true;
          }
        }
      } catch (err) {
        // Return 401 immediately on token error, never log the token
        return { statusCode: 401, body: 'Unauthorized: Invalid token' };
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
    if (!settings || typeof settings.retentionDays !== 'number' || settings.retentionDays < 1) {
      return { statusCode: 500, body: 'Invalid or missing retentionDays in settings. Must be >= 1.' };
    }

    const retentionDays = settings.retentionDays;

    // 2. Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // 3. Find visitors older than cutoffDate with imagesPurgedAt == null
    const snapshot = await db.collection('visitors')
      .where('imagesPurgedAt', '==', null)
      .where('createdAt', '<=', cutoffDate)
      .limit(25) // Cap each real run to a small batch
      .get();

    if (snapshot.empty) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No images to purge at this time', count: 0 }),
      };
    }

    if (isDryRun) {
      const visitorIds = snapshot.docs.map(doc => doc.id);
      let imageCount = 0;
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.photoPublicId) imageCount++;
        if (data.idImagePublicId) imageCount++;
      });
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: `DRY RUN: Would purge ${snapshot.docs.length} visitors and ${imageCount} images.`,
          visitorsAffected: snapshot.docs.length,
          imagesAffected: imageCount,
          visitorIds,
        }),
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
        errors.push({ id: doc.id, error: 'Failed to purge' });
      }
    }

    // Check how many remain
    const remainingSnapshot = await db.collection('visitors')
      .where('imagesPurgedAt', '==', null)
      .where('createdAt', '<=', cutoffDate)
      .limit(1)
      .get();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Successfully purged images for ${successCount} visitors.`,
        successCount,
        errors,
        hasMore: !remainingSnapshot.empty
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};
