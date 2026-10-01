import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Timestamp } from 'firebase/firestore';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'e-gatepass-test',
    firestore: {
      rules: readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8'),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
});

// ============================================================
// HELPERS
// ============================================================

/** Timestamp in the past (1 hour ago) */
function pastTimestamp() {
  return Timestamp.fromMillis(Date.now() - 3600 * 1000);
}

/** Timestamp in the future (1 hour from now) */
function futureTimestamp() {
  return Timestamp.fromMillis(Date.now() + 3600 * 1000);
}

/** Timestamp far in the future (24 hours from now) */
function farFutureTimestamp() {
  return Timestamp.fromMillis(Date.now() + 24 * 3600 * 1000);
}

const REQUIRED_VISITOR_FIELDS = {
  firstName: 'Test',
  middleName: '',
  lastName: 'Visitor',
  fullName: 'Test Visitor',
  contactNumber: '1234567890',
  purpose: 'Meeting',
  visitDate: '2026-10-01',
  idImagePublicId: null,
  photoPublicId: 'photo_id',
  consentAcceptedAt: Timestamp.now(),
  createdAt: Timestamp.now(),
  createdByUid: 'anon_uid',
  imagesPurgedAt: null,
};

function makeValidPortalPass(uid: string) {
  return {
    visitorId: 'my_visitor',
    visitorName: 'Test Visitor',
    purpose: 'Meeting',
    photoPublicId: 'photo_id',
    idImagePublicId: null,
    source: 'portal',
    status: 'issued',
    validFrom: futureTimestamp(),
    validUntil: farFutureTimestamp(),
    issuedAt: Timestamp.now(),
    scannedAt: null,
    timeIn: null,
    timeOut: null,
    entryDeviceId: null,
    exitDeviceId: null,
    decidedByUid: null,
    rejectionReason: null,
    gate: null,
    createdByUid: uid,
  };
}

function makeValidKioskPass(uid: string) {
  return {
    ...makeValidPortalPass(uid),
    source: 'kiosk',
  };
}

describe('E-GatePass Firestore Rules', () => {

  const getAdminContext = () =>
    testEnv.authenticatedContext('admin_uid', { email_verified: true });

  const getGuardContext = (uid = 'guard_uid', isVerified = true) =>
    testEnv.authenticatedContext(uid, { email_verified: isVerified });

  const getDeviceContext = (uid = 'device_uid') =>
    testEnv.authenticatedContext(uid, { email_verified: true });

  const getAnonContext = (uid = 'anon_uid') =>
    testEnv.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous', identities: {} } });

  // Seed base data
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();

      await db.collection('users').doc('admin_uid').set({ role: 'admin', active: true });
      await db.collection('users').doc('guard_uid').set({ role: 'guard', active: true });
      await db.collection('users').doc('inactive_guard').set({ role: 'guard', active: false });

      await db.collection('devices').doc('entry_device').set({ type: 'entry', status: 'active', gate: 'Main Gate' });
      await db.collection('devices').doc('exit_device').set({ type: 'exit', status: 'active', gate: 'Main Gate' });
      await db.collection('devices').doc('kiosk_device').set({ type: 'kiosk', status: 'active' });
      await db.collection('devices').doc('revoked_device').set({ type: 'entry', status: 'revoked' });

      await db.collection('visitors').doc('other_visitor').set({ createdByUid: 'other_uid' });
    });
  });

  // ============================================================
  // 1. Authorization Tests (existing)
  // ============================================================
  describe('Authorization Tests', () => {
    it('Unverified Guard reads protected data -> DENY', async () => {
      const db = getGuardContext('guard_uid', false).firestore();
      await assertFails(db.collection('visitors').get());
    });

    it('Inactive Guard reads protected data -> DENY', async () => {
      const db = getGuardContext('inactive_guard', true).firestore();
      await assertFails(db.collection('visitors').get());
    });

    it('Verified active Guard reads permitted data -> ALLOW', async () => {
      const db = getGuardContext('guard_uid', true).firestore();
      await assertSucceeds(db.collection('visitors').get());
    });

    it('Revoked Entry device reads/updates -> DENY', async () => {
      const db = getDeviceContext('revoked_device').firestore();
      await assertFails(db.collection('gatePasses').get());
    });
  });

  // ============================================================
  // 2. Visitors Collection
  // ============================================================
  describe('Visitors Collection', () => {
    it('valid anonymous visitor creates own visitor record -> ALLOW', async () => {
      const db = getAnonContext('anon_uid').firestore();
      await assertSucceeds(db.collection('visitors').doc('my_visitor').set(REQUIRED_VISITOR_FIELDS));
    });

    it('anonymous visitor creates visitor with extra unauthorized field -> DENY', async () => {
      const db = getAnonContext('anon_uid').firestore();
      await assertFails(db.collection('visitors').doc('v2').set({
        ...REQUIRED_VISITOR_FIELDS,
        hackedField: true,
      }));
    });

    it('anonymous visitor creates visitor for different UID -> DENY', async () => {
      const db = getAnonContext('anon_uid').firestore();
      await assertFails(db.collection('visitors').add({
        ...REQUIRED_VISITOR_FIELDS,
        createdByUid: 'other_uid',
      }));
    });

    it('visitor missing required field (fullName) -> DENY', async () => {
      const db = getAnonContext('anon_uid').firestore();
      const { fullName: _, ...incomplete } = REQUIRED_VISITOR_FIELDS;
      await assertFails(db.collection('visitors').doc('v3').set(incomplete));
    });

    it('visitor with empty firstName -> DENY', async () => {
      const db = getAnonContext('anon_uid').firestore();
      await assertFails(db.collection('visitors').doc('v4').set({
        ...REQUIRED_VISITOR_FIELDS,
        firstName: '',
      }));
    });
  });

  // ============================================================
  // 3. GatePass Creation - Source/Actor enforcement
  // ============================================================
  describe('GatePasses Creation - Source/Actor Enforcement', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        // Seed visitor owned by anon_uid
        await context.firestore().collection('visitors').doc('my_visitor').set({
          createdByUid: 'anon_uid',
        });
        // Seed visitor owned by kiosk_device
        await context.firestore().collection('visitors').doc('kiosk_visitor').set({
          createdByUid: 'kiosk_device',
        });
      });
    });

    it('anonymous visitor creates portal pass -> ALLOW', async () => {
      const db = getAnonContext('anon_uid').firestore();
      await assertSucceeds(db.collection('gatePasses').add(makeValidPortalPass('anon_uid')));
    });

    it.each(['password', 'google.com', 'phone', 'custom'])('unroled %s account with own visitor cannot create portal pass -> DENY', async (provider) => {
      const db = testEnv.authenticatedContext('anon_uid', {
        email_verified: true,
        isAnonymous: true, // A custom flag must not substitute for the Firebase provider.
        firebase: { sign_in_provider: provider as any, identities: {} },
      }).firestore();
      await assertFails(db.collection('gatePasses').add(makeValidPortalPass('anon_uid')));
    });

    it('account without an anonymous provider claim cannot create portal pass -> DENY', async () => {
      const db = testEnv.authenticatedContext('anon_uid', { isAnonymous: true }).firestore();
      await assertFails(db.collection('gatePasses').add(makeValidPortalPass('anon_uid')));
    });

    it('anonymous visitor creates kiosk pass -> DENY', async () => {
      const db = getAnonContext('anon_uid').firestore();
      await assertFails(db.collection('gatePasses').add(makeValidKioskPass('anon_uid')));
    });

    it('kiosk device creates kiosk pass -> ALLOW', async () => {
      const db = getDeviceContext('kiosk_device').firestore();
      const pass = makeValidKioskPass('kiosk_device');
      pass.visitorId = 'kiosk_visitor'; // owned by kiosk_device
      await assertSucceeds(db.collection('gatePasses').add(pass));
    });

    it('kiosk device creates portal pass -> DENY', async () => {
      const db = getDeviceContext('kiosk_device').firestore();
      await assertFails(db.collection('gatePasses').add(makeValidPortalPass('kiosk_device')));
    });

    it('entry device creates any visitor pass -> DENY', async () => {
      const db = getDeviceContext('entry_device').firestore();
      await assertFails(db.collection('gatePasses').add(makeValidPortalPass('entry_device')));
      await assertFails(db.collection('gatePasses').add(makeValidKioskPass('entry_device')));
    });

    it('exit device creates any visitor pass -> DENY', async () => {
      const db = getDeviceContext('exit_device').firestore();
      await assertFails(db.collection('gatePasses').add(makeValidPortalPass('exit_device')));
    });

    it('guard creates any visitor pass -> DENY', async () => {
      const db = getGuardContext('guard_uid').firestore();
      await assertFails(db.collection('gatePasses').add(makeValidPortalPass('guard_uid')));
    });

    it('admin creates visitor pass through client rules -> DENY', async () => {
      const db = getAdminContext().firestore();
      await assertFails(db.collection('gatePasses').add(makeValidPortalPass('admin_uid')));
    });
  });

  // ============================================================
  // 4. GatePass Creation - Schema validation
  // ============================================================
  describe('GatePasses Creation - Schema Validation', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection('visitors').doc('my_visitor').set({
          createdByUid: 'anon_uid',
        });
      });
    });

    it('missing required field (purpose) -> DENY', async () => {
      const db = getAnonContext('anon_uid').firestore();
      const { purpose: _, ...incomplete } = makeValidPortalPass('anon_uid');
      await assertFails(db.collection('gatePasses').add(incomplete));
    });

    it('wrong field type (visitorName is number) -> DENY', async () => {
      const db = getAnonContext('anon_uid').firestore();
      await assertFails(db.collection('gatePasses').add({
        ...makeValidPortalPass('anon_uid'),
        visitorName: 12345,
      }));
    });

    it('empty visitorName -> DENY', async () => {
      const db = getAnonContext('anon_uid').firestore();
      await assertFails(db.collection('gatePasses').add({
        ...makeValidPortalPass('anon_uid'),
        visitorName: '',
      }));
    });

    it('validUntil <= validFrom -> DENY', async () => {
      const db = getAnonContext('anon_uid').firestore();
      const now = futureTimestamp();
      await assertFails(db.collection('gatePasses').add({
        ...makeValidPortalPass('anon_uid'),
        validFrom: now,
        validUntil: now, // equal, not greater
      }));
    });

    it('validUntil < validFrom -> DENY', async () => {
      const db = getAnonContext('anon_uid').firestore();
      await assertFails(db.collection('gatePasses').add({
        ...makeValidPortalPass('anon_uid'),
        validFrom: farFutureTimestamp(),
        validUntil: futureTimestamp(), // before validFrom
      }));
    });

    it('arbitrary extra field -> DENY', async () => {
      const db = getAnonContext('anon_uid').firestore();
      await assertFails(db.collection('gatePasses').add({
        ...makeValidPortalPass('anon_uid'),
        hackedField: true,
      }));
    });

    it('status not "issued" -> DENY', async () => {
      const db = getAnonContext('anon_uid').firestore();
      await assertFails(db.collection('gatePasses').add({
        ...makeValidPortalPass('anon_uid'),
        status: 'inside',
      }));
    });

    it('referencing another uid\'s visitor -> DENY', async () => {
      const db = getAnonContext('anon_uid').firestore();
      await assertFails(db.collection('gatePasses').add({
        ...makeValidPortalPass('anon_uid'),
        visitorId: 'other_visitor',
      }));
    });
  });

  describe('VisitLogs Creation', () => {
    const events = ['scan_entry', 'scan_exit', 'invalid_scan', 'approved', 'rejected'];
    function logFor(uid: string, event: string) {
      const guardEvent = ['approved', 'rejected'].includes(event);
      return {
        passToken: event === 'invalid_scan' ? 'unknown/QR content' : 'valid_pass',
        visitorId: event === 'invalid_scan' ? null : 'my_visitor',
        event,
        reason: ['invalid_scan', 'rejected'].includes(event) ? 'Scan or approval rejected' : null,
        deviceId: guardEvent ? null : uid,
        gate: 'Main Gate',
        guardUid: guardEvent ? uid : null,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      };
    }

    const actors = [
      { uid: 'entry_device', allowed: ['scan_entry', 'invalid_scan'] },
      { uid: 'exit_device', allowed: ['scan_exit', 'invalid_scan'] },
      { uid: 'guard_uid', allowed: ['approved', 'rejected'] },
      { uid: 'kiosk_device', allowed: [] },
      { uid: 'revoked_device', allowed: [] },
      { uid: 'inactive_guard', allowed: [] },
      { uid: 'admin_uid', allowed: [] },
      { uid: 'unroled_account', allowed: [] },
    ];
    for (const { uid, allowed } of actors) {
      it.each(events)(`${uid} event %s obeys role/device permissions`, async (event) => {
        const db = testEnv.authenticatedContext(uid, { email_verified: true }).firestore();
        const write = db.collection('visitLogs').add(logFor(uid, event));
        await (allowed.includes(event) ? assertSucceeds(write) : assertFails(write));
      });
    }

    it.each(['approved', 'rejected'])('Guard %s with nullable legacy pass gate -> ALLOW', async (event) => {
      await assertSucceeds(getGuardContext().firestore().collection('visitLogs').add({
        ...logFor('guard_uid', event), gate: null,
      }));
    });

    it.each(['entry_device', 'exit_device'])('%s invalid scan with empty QR content and no pass -> ALLOW', async (uid) => {
      await assertSucceeds(getDeviceContext(uid).firestore().collection('visitLogs').add({
        ...logFor(uid, 'invalid_scan'), passToken: '',
      }));
    });

    it.each(Object.keys(logFor('entry_device', 'scan_entry')))('missing required field %s -> DENY', async (field) => {
      const data: Record<string, unknown> = logFor('entry_device', 'scan_entry');
      delete data[field];
      await assertFails(getDeviceContext('entry_device').firestore().collection('visitLogs').add(data));
    });

    it.each([
      { extra: true }, { passToken: 123 }, { passToken: '' }, { visitorId: 123 },
      { visitorId: null }, { visitorId: '' }, { event: 'invented' }, { event: 123 },
      { reason: 'unexpected reason' }, { deviceId: 123 }, { deviceId: null },
      { deviceId: 'exit_device' }, { guardUid: 'guard_uid' }, { guardUid: 123 },
      { gate: 123 }, { gate: null }, { timestamp: 'today' }, { timestamp: null },
    ])('malformed or forged Entry log %j -> DENY', async (patch) => {
      await assertFails(getDeviceContext('entry_device').firestore().collection('visitLogs').add({
        ...logFor('entry_device', 'scan_entry'), ...patch,
      }));
    });

    it.each([
      { guardUid: 'other_guard' }, { guardUid: null }, { guardUid: 123 },
      { deviceId: 'entry_device' }, { deviceId: 123 }, { gate: 123 },
    ])('malformed or forged Guard log %j -> DENY', async (patch) => {
      await assertFails(getGuardContext().firestore().collection('visitLogs').add({
        ...logFor('guard_uid', 'approved'), ...patch,
      }));
    });

    for (const event of ['invalid_scan', 'rejected']) {
      it.each([null, '', 123])(`${event} invalid reason %s -> DENY`, async (reason) => {
        const uid = event === 'rejected' ? 'guard_uid' : 'entry_device';
        await assertFails(testEnv.authenticatedContext(uid, { email_verified: true }).firestore().collection('visitLogs').add({
          ...logFor(uid, event), reason,
        }));
      });
    }

    it('invalid scan with non-null visitor -> DENY', async () => {
      await assertFails(getDeviceContext('entry_device').firestore().collection('visitLogs').add({
        ...logFor('entry_device', 'invalid_scan'), visitorId: 'my_visitor',
      }));
    });

    it('unverified Guard, anonymous visitor, and unauthenticated caller -> DENY', async () => {
      for (const context of [getGuardContext('guard_uid', false), getAnonContext(), testEnv.unauthenticatedContext()]) {
        await assertFails(context.firestore().collection('visitLogs').add(logFor('guard_uid', 'approved')));
      }
    });

    it('logs remain immutable after creation -> DENY update/delete', async () => {
      const ref = getGuardContext().firestore().collection('visitLogs').doc('log');
      await assertSucceeds(ref.set(logFor('guard_uid', 'approved')));
      await assertFails(ref.update({ reason: 'changed' }));
      await assertFails(ref.delete());
    });
  });

  // ============================================================
  // 5. Scanner & Guard Updates
  // ============================================================
  describe('GatePasses - Scanner & Guard Updates', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        // issued pass with expired validity (validUntil in the past)
        await db.collection('gatePasses').doc('expired_pass').set({
          status: 'issued',
          source: 'kiosk',
          validUntil: pastTimestamp(),
        });
        // issued pass still valid
        await db.collection('gatePasses').doc('valid_pass').set({
          status: 'issued',
          source: 'kiosk',
          validUntil: farFutureTimestamp(),
        });
        await db.collection('gatePasses').doc('pending_pass').set({ status: 'pending', source: 'kiosk' });
        await db.collection('gatePasses').doc('inside_pass').set({ status: 'inside', source: 'kiosk' });
        await db.collection('gatePasses').doc('exited_pass').set({ status: 'exited', source: 'kiosk' });
      });
    });

    // -- Entry device --
    it('Entry device issued -> pending with own UID and matching gate -> ALLOW', async () => {
      const db = getDeviceContext('entry_device').firestore();
      await assertSucceeds(db.collection('gatePasses').doc('valid_pass').update({
        status: 'pending',
        scannedAt: Timestamp.now(),
        entryDeviceId: 'entry_device',
        gate: 'Main Gate',
      }));
    });

    it('Entry device writes another UID into entryDeviceId -> DENY', async () => {
      const db = getDeviceContext('entry_device').firestore();
      await assertFails(db.collection('gatePasses').doc('valid_pass').update({
        status: 'pending',
        scannedAt: Timestamp.now(),
        entryDeviceId: 'some_other_device',
        gate: 'Main Gate',
      }));
    });

    it.each(['Other Gate', 'main gate', 'Main Gate ', '', null, 123])('Entry device issued -> pending with forged/invalid gate %s -> DENY', async (gate) => {
      const db = getDeviceContext('entry_device').firestore();
      await assertFails(db.collection('gatePasses').doc('valid_pass').update({
        status: 'pending', scannedAt: Timestamp.now(), entryDeviceId: 'entry_device', gate,
      }));
    });

    it('Entry device marks truly expired issued pass as expired -> ALLOW', async () => {
      const db = getDeviceContext('entry_device').firestore();
      await assertSucceeds(db.collection('gatePasses').doc('expired_pass').update({
        status: 'expired',
      }));
    });

    it('Entry device marks unexpired issued pass as expired -> DENY', async () => {
      const db = getDeviceContext('entry_device').firestore();
      await assertFails(db.collection('gatePasses').doc('valid_pass').update({
        status: 'expired',
      }));
    });

    it('Entry device tries issued -> exited -> DENY', async () => {
      const db = getDeviceContext('entry_device').firestore();
      await assertFails(db.collection('gatePasses').doc('valid_pass').update({
        status: 'exited',
        scannedAt: Timestamp.now(),
        entryDeviceId: 'entry_device',
        gate: 'Main Gate',
      }));
    });

    it('Entry device modifies unrelated field -> DENY', async () => {
      const db = getDeviceContext('entry_device').firestore();
      await assertFails(db.collection('gatePasses').doc('valid_pass').update({
        status: 'pending',
        scannedAt: Timestamp.now(),
        entryDeviceId: 'entry_device',
        gate: 'Main Gate',
        visitorName: 'Hacked',
      }));
    });

    // -- Exit device --
    it('Exit device inside -> exited with own UID -> ALLOW', async () => {
      const db = getDeviceContext('exit_device').firestore();
      await assertSucceeds(db.collection('gatePasses').doc('inside_pass').update({
        status: 'exited',
        timeOut: Timestamp.now(),
        exitDeviceId: 'exit_device',
      }));
    });

    it('Exit device writes another UID into exitDeviceId -> DENY', async () => {
      const db = getDeviceContext('exit_device').firestore();
      await assertFails(db.collection('gatePasses').doc('inside_pass').update({
        status: 'exited',
        timeOut: Timestamp.now(),
        exitDeviceId: 'some_other_device',
      }));
    });

    it('Exit device modifies unrelated field -> DENY', async () => {
      const db = getDeviceContext('exit_device').firestore();
      await assertFails(db.collection('gatePasses').doc('inside_pass').update({
        status: 'exited',
        timeOut: Timestamp.now(),
        exitDeviceId: 'exit_device',
        visitorName: 'Hacked',
      }));
    });

    // -- Guard --
    it('Guard pending -> inside -> ALLOW', async () => {
      const db = getGuardContext('guard_uid').firestore();
      await assertSucceeds(db.collection('gatePasses').doc('pending_pass').update({
        status: 'inside',
        timeIn: Timestamp.now(),
        decidedByUid: 'guard_uid',
      }));
    });

    it('Guard pending -> rejected with reason -> ALLOW', async () => {
      const db = getGuardContext('guard_uid').firestore();
      await assertSucceeds(db.collection('gatePasses').doc('pending_pass').update({
        status: 'rejected',
        rejectionReason: 'Fake ID',
        decidedByUid: 'guard_uid',
      }));
    });

    it('Guard rejects with empty rejectionReason -> DENY', async () => {
      const db = getGuardContext('guard_uid').firestore();
      await assertFails(db.collection('gatePasses').doc('pending_pass').update({
        status: 'rejected',
        rejectionReason: '',
        decidedByUid: 'guard_uid',
      }));
    });

    it('Guard sets decidedByUid to another user -> DENY', async () => {
      const db = getGuardContext('guard_uid').firestore();
      await assertFails(db.collection('gatePasses').doc('pending_pass').update({
        status: 'inside',
        timeIn: Timestamp.now(),
        decidedByUid: 'other_uid',
      }));
    });

    it('Kiosk device cannot arbitrarily update existing gate passes -> DENY', async () => {
      const db = getDeviceContext('kiosk_device').firestore();
      await assertFails(db.collection('gatePasses').doc('valid_pass').update({
        status: 'inside',
      }));
    });
  });
});
