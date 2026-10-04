import { Timestamp, type Firestore } from 'firebase-admin/firestore';

export interface CleanupResult { scanned: number; eligible: number; deleted: number; skipped: number; failed: number }
export const CLOSED_PASS_STATUSES = new Set(['exited', 'rejected', 'expired']);
export const PROTECTED_AUDIT_ACTIONS = new Set([
  'initial_superadmin_bootstrapped', 'superadmin_created', 'admin_created', 'admin_deleted',
  'device_registered', 'device_deleted', 'settings_updated', 'device_credentials_updated',
  'user_role_and_status_changed', 'user_role_changed', 'user_reactivated', 'user_deactivated',
]);

export function isClosedPassStatus(status: unknown): boolean { return typeof status === 'string' && CLOSED_PASS_STATUSES.has(status); }
export function isProtectedAuditAction(action: unknown): boolean { return typeof action === 'string' && PROTECTED_AUDIT_ACTIONS.has(action); }

const result = (): CleanupResult => ({ scanned: 0, eligible: 0, deleted: 0, skipped: 0, failed: 0 });
const cutoff = (days: number) => Timestamp.fromMillis(Date.now() - days * 86_400_000);

export async function cleanupHistoricalVisits(db: Firestore, days: number, limit = 10): Promise<CleanupResult> {
  const summary = result();
  const passes = await db.collection('gatePasses')
    .where('status', 'in', [...CLOSED_PASS_STATUSES])
    .where('issuedAt', '<=', cutoff(days)).limit(limit).get();
  summary.scanned = passes.size;
  for (const pass of passes.docs) {
    const data = pass.data();
    if (!isClosedPassStatus(data.status) || typeof data.visitorId !== 'string') { summary.skipped++; continue; }
    const visitor = await db.collection('visitors').doc(data.visitorId).get();
    const [otherPasses, pendingForPass, pendingForVisitor] = await Promise.all([
      db.collection('gatePasses').where('visitorId', '==', data.visitorId).limit(2).get(),
      db.collection('reconciliationTasks').where('status', '==', 'pending').where('targetUid', '==', pass.id).limit(1).get(),
      db.collection('reconciliationTasks').where('status', '==', 'pending').where('targetUid', '==', data.visitorId).limit(1).get(),
    ]);
    if (!visitor.exists || visitor.data()?.imagesPurgedAt == null || otherPasses.size !== 1 || !pendingForPass.empty || !pendingForVisitor.empty) {
      summary.skipped++; continue;
    }
    summary.eligible++;
    try {
      const [logs, uploads] = await Promise.all([
        db.collection('visitLogs').where('passToken', '==', pass.id).get(),
        db.collection('imageUploads').where('passId', '==', pass.id).get(),
      ]);
      const batch = db.batch();
      logs.docs.forEach((item) => batch.delete(item.ref));
      uploads.docs.forEach((item) => batch.delete(item.ref));
      batch.delete(pass.ref); batch.delete(visitor.ref);
      await batch.commit();
      summary.deleted++;
    } catch { summary.failed++; }
  }
  return summary;
}

export async function cleanupAuditLogs(db: Firestore, days: number, limit = 25): Promise<CleanupResult> {
  const summary = result();
  const docs = await db.collection('auditLogs').where('timestamp', '<=', cutoff(days)).limit(limit).get();
  summary.scanned = docs.size;
  for (const item of docs.docs) {
    if (isProtectedAuditAction(item.data().action)) { summary.skipped++; continue; }
    summary.eligible++;
    try { await item.ref.delete(); summary.deleted++; } catch { summary.failed++; }
  }
  return summary;
}

export async function cleanupResolvedReconciliation(db: Firestore, days: number, limit = 25): Promise<CleanupResult> {
  const summary = result();
  const docs = await db.collection('reconciliationTasks').where('status', '==', 'resolved').where('createdAt', '<=', cutoff(days)).limit(limit).get();
  summary.scanned = docs.size; summary.eligible = docs.size;
  for (const item of docs.docs) {
    try { await item.ref.delete(); summary.deleted++; } catch { summary.failed++; }
  }
  return summary;
}
