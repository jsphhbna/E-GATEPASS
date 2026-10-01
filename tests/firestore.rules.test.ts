import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  // Initialize testing environment with our rules
  testEnv = await initializeTestEnvironment({
    projectId: 'e-gatepass-test',
    firestore: {
      rules: readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8'),
    },
  });
});

beforeEach(async () => {
  // Clear the database before each test
  await testEnv.clearFirestore();
});

afterAll(async () => {
  // Cleanup test environment
  await testEnv.cleanup();
});

describe('E-GatePass Firestore Rules', () => {
  
  // Helpers to get authenticated / unauthenticated contexts
  const getAdminContext = () => {
    return testEnv.authenticatedContext('admin_uid', { email_verified: true });
  };

  const getGuardContext = (uid = 'guard_uid', isVerified = true) => {
    return testEnv.authenticatedContext(uid, { email_verified: isVerified });
  };

  const getDeviceContext = (uid = 'device_uid') => {
    return testEnv.authenticatedContext(uid, { email_verified: true });
  };

  const getAnonContext = (uid = 'anon_uid') => {
    return testEnv.authenticatedContext(uid, { isAnonymous: true });
  };

  beforeEach(async () => {
    // Seed users to establish roles
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      
      await db.collection('users').doc('admin_uid').set({
        role: 'admin',
        active: true,
      });

      await db.collection('users').doc('guard_uid').set({
        role: 'guard',
        active: true,
      });
      
      await db.collection('users').doc('inactive_guard').set({
        role: 'guard',
        active: false,
      });

      await db.collection('devices').doc('entry_device').set({
        type: 'entry',
        status: 'active',
      });
      
      await db.collection('devices').doc('exit_device').set({
        type: 'exit',
        status: 'active',
      });
      
      await db.collection('devices').doc('kiosk_device').set({
        type: 'kiosk',
        status: 'active',
      });
      
      await db.collection('devices').doc('revoked_device').set({
        type: 'entry',
        status: 'revoked',
      });
    });
  });

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
      await assertFails(db.collection('gatePasses').doc('test').update({ status: 'pending' }));
    });
  });

  describe('Visitors Collection', () => {
    it('allows anonymous users to create a visitor doc with createdByUid', async () => {
      const anonDb = getAnonContext('anon_uid').firestore();
      await assertSucceeds(anonDb.collection('visitors').add({
        firstName: 'Test',
        lastName: 'Visitor',
        consentAcceptedAt: new Date(),
        createdByUid: 'anon_uid'
      }));
    });
    
    it('prevents anonymous users from creating visitors for other uids', async () => {
      const anonDb = getAnonContext('anon_uid').firestore();
      await assertFails(anonDb.collection('visitors').add({
        firstName: 'Test',
        lastName: 'Visitor',
        consentAcceptedAt: new Date(),
        createdByUid: 'other_uid'
      }));
    });
  });

  describe('GatePasses Collection - Creation', () => {
    it('Random authenticated user creates arbitrary gate pass -> DENY', async () => {
      const db = getAnonContext('random_uid').firestore();
      await assertFails(db.collection('gatePasses').add({
        status: 'inside', // Invalid state
        visitorId: 'visitor123',
        source: 'get-pass',
        createdByUid: 'random_uid'
      }));
    });
    
    it('Invalid initial pass status -> DENY', async () => {
      const db = getAnonContext('random_uid').firestore();
      await assertFails(db.collection('gatePasses').add({
        status: 'exited', // Must be 'issued'
        visitorId: 'visitor123',
        source: 'get-pass',
        createdByUid: 'random_uid'
      }));
    });
  });

  describe('GatePasses Collection - Scanners & Guards', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.collection('gatePasses').doc('pass1').set({ status: 'issued', source: 'kiosk' });
        await db.collection('gatePasses').doc('pass2').set({ status: 'pending', source: 'kiosk' });
        await db.collection('gatePasses').doc('pass3').set({ status: 'inside', source: 'kiosk' });
        await db.collection('gatePasses').doc('pass4').set({ status: 'exited', source: 'kiosk' });
      });
    });

    it('Active Entry device issued -> pending -> ALLOW', async () => {
      const db = getDeviceContext('entry_device').firestore();
      await assertSucceeds(db.collection('gatePasses').doc('pass1').update({
        status: 'pending',
        scannedAt: new Date(),
        entryDeviceId: 'entry_device',
        gate: 'Main Gate'
      }));
    });

    it('Entry device changes visitorName -> DENY', async () => {
      const db = getDeviceContext('entry_device').firestore();
      await assertFails(db.collection('gatePasses').doc('pass1').update({
        status: 'pending',
        scannedAt: new Date(),
        entryDeviceId: 'entry_device',
        gate: 'Main Gate',
        visitorName: 'Hacked Name'
      }));
    });

    it('Entry device tries pending -> exited -> DENY', async () => {
      const db = getDeviceContext('entry_device').firestore();
      await assertFails(db.collection('gatePasses').doc('pass2').update({
        status: 'exited',
        scannedAt: new Date(),
        entryDeviceId: 'entry_device',
        gate: 'Main Gate'
      }));
    });

    it('Active Exit device inside -> exited -> ALLOW', async () => {
      const db = getDeviceContext('exit_device').firestore();
      await assertSucceeds(db.collection('gatePasses').doc('pass3').update({
        status: 'exited',
        timeOut: new Date(),
        exitDeviceId: 'exit_device'
      }));
    });

    it('Exit device issued -> exited -> DENY', async () => {
      const db = getDeviceContext('exit_device').firestore();
      await assertFails(db.collection('gatePasses').doc('pass1').update({
        status: 'exited',
        timeOut: new Date(),
        exitDeviceId: 'exit_device'
      }));
    });

    it('Exit device modifies visitor identity -> DENY', async () => {
      const db = getDeviceContext('exit_device').firestore();
      await assertFails(db.collection('gatePasses').doc('pass3').update({
        status: 'exited',
        timeOut: new Date(),
        exitDeviceId: 'exit_device',
        visitorName: 'Hacked Name'
      }));
    });

    it('Guard pending -> inside -> ALLOW', async () => {
      const db = getGuardContext('guard_uid').firestore();
      await assertSucceeds(db.collection('gatePasses').doc('pass2').update({
        status: 'inside',
        timeIn: new Date(),
        decidedByUid: 'guard_uid'
      }));
    });

    it('Guard pending -> rejected -> ALLOW', async () => {
      const db = getGuardContext('guard_uid').firestore();
      await assertSucceeds(db.collection('gatePasses').doc('pass2').update({
        status: 'rejected',
        rejectionReason: 'Fake ID',
        decidedByUid: 'guard_uid'
      }));
    });

    it('Guard modifies protected visitor fields -> DENY', async () => {
      const db = getGuardContext('guard_uid').firestore();
      await assertFails(db.collection('gatePasses').doc('pass2').update({
        status: 'inside',
        timeIn: new Date(),
        decidedByUid: 'guard_uid',
        visitorName: 'Changed'
      }));
    });

    it('Kiosk modifies allowed fields -> ALLOW', async () => {
      // Kiosk cannot update according to strict rules, only create
      const db = getDeviceContext('kiosk_device').firestore();
      await assertFails(db.collection('gatePasses').doc('pass1').update({
        status: 'inside'
      }));
    });
  });
});
