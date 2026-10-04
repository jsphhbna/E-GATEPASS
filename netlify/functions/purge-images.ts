import { Handler } from '@netlify/functions';
import { v2 as cloudinary } from 'cloudinary';
import { getFirestore, FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import crypto from 'crypto';
import { handleAuthError, requireSuperAdmin } from './utils/auth';
import { writeAdministrativeAudit, type AuditActorRole } from './utils/audit';
import { recordReconciliationTask } from './utils/reconciliation';
import { classifyImageIdentifier, uploadSessionIdFromPublicId } from './utils/image-security';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const purgeRequestSchema = z.object({
  dryRun: z.boolean().optional(),
}).strict();

const jsonHeaders = { 'Content-Type': 'application/json' };

function jsonResponse(statusCode: number, body: object) {
  return {
    statusCode,
    headers: jsonHeaders,
    body: JSON.stringify(body),
  };
}

async function cleanupExpiredUploads(db: Firestore, actorUid: string) {
  const snapshot = await db.collection('imageUploads')
    .where('status', '==', 'pending')
    .where('expiresAt', '<=', Timestamp.now())
    .limit(25)
    .get();
  let deletedCount = 0;
  let failedCount = 0;
  let reconciliationCount = 0;

  for (const upload of snapshot.docs) {
    const data = upload.data();
    const publicId = data.publicId;
    try {
      if (
        classifyImageIdentifier(publicId) !== 'current' ||
        uploadSessionIdFromPublicId(publicId) !== upload.id ||
        typeof data.ownerUid !== 'string'
      ) throw new Error('Upload session image identifier is invalid');
      const reserved = await db.runTransaction(async (transaction) => {
        const latest = await transaction.get(upload.ref);
        if (!latest.exists || latest.data()?.status !== 'pending') return false;
        transaction.update(upload.ref, { status: 'cleanup_pending', cleanupRequestedAt: FieldValue.serverTimestamp() });
        return true;
      });
      if (!reserved) continue;
      const result = await cloudinary.uploader.destroy(publicId, {
        type: 'upload', resource_type: 'image', invalidate: true,
      });
      if (result.result !== 'ok' && result.result !== 'not found') {
        throw new Error(`Unexpected Cloudinary deletion result: ${result.result || 'unknown'}`);
      }
      await upload.ref.update({ status: 'deleted', deletedAt: FieldValue.serverTimestamp() });
      deletedCount++;
    } catch (error) {
      failedCount++;
      await upload.ref.update({ status: 'cleanup_failed', cleanupFailedAt: FieldValue.serverTimestamp() }).catch(() => undefined);
      const reference = db.collection('reconciliationTasks').doc().id;
      if (await recordReconciliationTask(db, {
        reference,
        operation: 'expired_upload_cleanup_failed',
        targetUid: upload.id,
        actorUid,
        reason: 'An expired unclaimed E-GatePass upload could not be safely deleted',
        requiredActions: ['Verify the upload session is unclaimed', 'Delete the matching Cloudinary asset and mark the session deleted'],
      })) reconciliationCount++;
      console.error('Expired upload cleanup failed', {
        uploadId: upload.id,
        reference,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
  const remaining = await db.collection('imageUploads')
    .where('status', '==', 'pending')
    .where('expiresAt', '<=', Timestamp.now())
    .limit(1)
    .get();
  return { attempted: snapshot.size, deletedCount, failedCount, reconciliationCount, hasMore: !remaining.empty };
}

export const handler: Handler = async (event) => {
  const { httpMethod } = event;

  if (httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  if ((event.body?.length || 0) > 1024) {
    return jsonResponse(413, { error: 'Request body is too large' });
  }

  let requestBody: unknown = {};
  try {
    if (event.body) {
      requestBody = JSON.parse(event.body);
    }
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  const parsedRequest = purgeRequestSchema.safeParse(requestBody);
  if (!parsedRequest.success) {
    return jsonResponse(400, { error: 'Invalid request body' });
  }
  const isDryRun = parsedRequest.data.dryRun === true;

  const cronSecret = process.env.CRON_SECRET;
  const providedSecret = event.headers['x-cron-secret'] || event.headers['X-Cron-Secret'];
  
  let isCronAuthenticated = false;
  let auditActor: { uid: string; role: AuditActorRole } = { uid: 'system', role: 'system' };

  if (cronSecret && providedSecret) {
    const a = Buffer.from(cronSecret);
    const b = Buffer.from(providedSecret);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      isCronAuthenticated = true;
    }
  }

  if (!isCronAuthenticated) {
    try {
      const actor = await requireSuperAdmin(event.headers.authorization || event.headers.Authorization);
      auditActor = { uid: actor.uid, role: actor.role };
    } catch (error) {
      return handleAuthError(error);
    }
  }

  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error('Image purge is missing required Cloudinary configuration');
    return jsonResponse(500, { error: 'Image deletion is not configured' });
  }

  const db = getFirestore();
  try {

    // 1. Fetch settings to get retentionDays
    const settingsDoc = await db.collection('settings').doc('app').get();
    const settings = settingsDoc.data();
    if (!settings || typeof settings.retentionDays !== 'number' || settings.retentionDays < 1) {
      return jsonResponse(500, { error: 'Image retention settings are invalid' });
    }

    const retentionDays = settings.retentionDays;

    // 2. Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const eligibleVisitors = db.collection('visitors')
      .where('imagesPurgedAt', '==', null)
      .where('createdAt', '<=', cutoffDate);

    if (isDryRun) {
      const [countSnapshot, orphanCountSnapshot] = await Promise.all([
        eligibleVisitors.count().get(),
        db.collection('imageUploads').where('status', '==', 'pending').where('expiresAt', '<=', Timestamp.now()).count().get(),
      ]);
      const visitorsAffected = countSnapshot.data().count;

      return jsonResponse(200, {
        message: `Would delete images for ${visitorsAffected} visitors.`,
        visitorsAffected,
        orphanUploadsAffected: orphanCountSnapshot.data().count,
        retentionDays,
      });
    }

    // Process a bounded batch so each invocation stays within Netlify's runtime limit.
    const snapshot = await eligibleVisitors.limit(25).get();

    let successCount = 0;
    let failedCount = 0;
    let reconciliationCount = 0;

    // 4. Process each visitor
    for (const doc of snapshot.docs) {
      const visitor = doc.data();
      const publicIdsToDestroy: string[] = [];

      if (typeof visitor.photoPublicId === 'string') publicIdsToDestroy.push(visitor.photoPublicId);
      if (typeof visitor.idImagePublicId === 'string') publicIdsToDestroy.push(visitor.idImagePublicId);

      let deletedImageCount = 0;
      try {
        // Current uploads use Cloudinary's default "upload" delivery type.
        if (publicIdsToDestroy.length > 0) {
          for (const pid of publicIdsToDestroy) {
            if (classifyImageIdentifier(pid) === 'malformed') {
              throw new Error('Stored image identifier is malformed');
            }
            const result = await cloudinary.uploader.destroy(pid, {
              type: 'upload',
              resource_type: 'image',
              invalidate: true,
            });

            if (result.result !== 'ok' && result.result !== 'not found') {
              throw new Error(`Cloudinary returned an unexpected deletion result: ${result.result || 'unknown'}`);
            }
            deletedImageCount++;
          }
        }

        // Only mark as purged after successful Cloudinary deletion
        await doc.ref.update({
          imagesPurgedAt: FieldValue.serverTimestamp(),
        });

        successCount++;
      } catch (error) {
        failedCount++;
        if (deletedImageCount > 0) {
          const reference = db.collection('reconciliationTasks').doc().id;
          if (await recordReconciliationTask(db, {
            reference,
            operation: 'visitor_image_purge_partial',
            targetUid: doc.id,
            actorUid: auditActor.uid,
            reason: 'At least one visitor image was deleted before the retention purge could be finalized',
            requiredActions: ['Verify both referenced Cloudinary images', 'Complete deletion and set imagesPurgedAt only after all images are absent'],
          })) reconciliationCount++;
        }
        console.error('Failed to delete visitor images', {
          visitorId: doc.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Check how many remain
    const remainingSnapshot = await db.collection('visitors')
      .where('imagesPurgedAt', '==', null)
      .where('createdAt', '<=', cutoffDate)
      .limit(1)
      .get();

    const orphanCleanup = await cleanupExpiredUploads(db, auditActor.uid);

    try {
      if (!snapshot.empty) {
        await writeAdministrativeAudit(db, {
          action: 'visitor_images_purged',
          actorUid: auditActor.uid,
          actorRole: auditActor.role,
          targetType: 'visitor_images',
          targetId: 'retention_batch',
          result: failedCount > 0 ? 'partial' : 'success',
          metadata: { successCount, failedCount, reconciliationCount, retentionDays, hasMore: !remainingSnapshot.empty },
        });
      }
      if (orphanCleanup.attempted > 0) {
        await writeAdministrativeAudit(db, {
          action: 'orphan_uploads_cleaned',
          actorUid: auditActor.uid,
          actorRole: auditActor.role,
          targetType: 'image_uploads',
          targetId: 'expired_batch',
          result: orphanCleanup.failedCount > 0 ? 'partial' : 'success',
          metadata: {
            deletedCount: orphanCleanup.deletedCount,
            failedCount: orphanCleanup.failedCount,
            reconciliationCount: orphanCleanup.reconciliationCount,
            hasMore: orphanCleanup.hasMore,
          },
        });
      }
    } catch (auditError) {
      const reference = db.collection('reconciliationTasks').doc().id;
      await recordReconciliationTask(db, {
        reference,
        operation: 'purge_images_audit_failure',
        targetUid: 'retention_batch',
        actorUid: auditActor.uid,
        reason: 'Visitor images were purged but the administrative audit event could not be finalized',
        requiredActions: ['Review image purge results and confirm the administrative audit trail'],
      });
      console.error('Image purge audit requires reconciliation', {
        reference,
        error: auditError instanceof Error ? auditError.message : 'Unknown error',
      });
      return jsonResponse(202, {
        message: `Deleted images for ${successCount} visitors, but audit reconciliation is required.`,
        successCount,
        failedCount,
        orphanDeletedCount: orphanCleanup.deletedCount,
        orphanFailedCount: orphanCleanup.failedCount,
        hasMore: !remainingSnapshot.empty || orphanCleanup.hasMore,
        reconciliationRequired: true,
        reference,
      });
    }

    return jsonResponse(200, {
      message: `Deleted images for ${successCount} visitors.`,
      successCount,
      failedCount,
      orphanDeletedCount: orphanCleanup.deletedCount,
      orphanFailedCount: orphanCleanup.failedCount,
      hasMore: !remainingSnapshot.empty || orphanCleanup.hasMore,
    });
  } catch (error) {
    console.error('Image purge failed', error);
    await writeAdministrativeAudit(db, {
      action: 'visitor_images_purge_failed',
      actorUid: auditActor.uid,
      actorRole: auditActor.role,
      targetType: 'visitor_images',
      targetId: 'retention_batch',
      result: 'failure',
      metadata: { safeSummary: 'Image purge did not complete' },
    }).catch((auditError) => {
      console.error('Failed to record image purge failure audit', auditError);
    });
    return jsonResponse(500, { error: 'Image deletion failed' });
  }
};
