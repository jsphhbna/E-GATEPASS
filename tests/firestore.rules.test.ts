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
      
      // Seed a visitor created by 'other_uid'
      await db.collection('visitors').doc('other_visitor').set({
        createdByUid: 'other_uid',
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
    it('valid anonymous visitor creates own visitor record -> ALLOW', async () => {
      const anonDb = getAnonContext('anon_uid').firestore();
      await assertSucceeds(anonDb.collection('visitors').doc('my_visitor').set({
        firstName: 'Test',
        middleName: '',
        lastName: 'Visitor',
        fullName: 'Test Visitor',
        contactNumber: '1234567890',
        purpose: 'Meeting',
        visitDate: '2026-10-01',
        idImagePublicId: null,
        photoPublicId: 'photo_id',
        consentAcceptedAt: new Date(),
        createdAt: new Date(),
        createdByUid: 'anon_uid',
        imagesPurgedAt: null
      }));
    });
    
    it('anonymous visitor creates visitor with extra unauthorized field -> DENY', async () => {
      const anonDb = getAnonContext('anon_uid').firestore();
      await assertFails(anonDb.collection('visitors').doc('my_visitor_2').set({
        firstName: 'Test',
        middleName: '',
        lastName: 'Visitor',
        fullName: 'Test Visitor',
        contactNumber: '1234567890',
        purpose: 'Meeting',
        visitDate: '2026-10-01',
        idImagePublicId: null,
        photoPublicId: 'photo_id',
        consentAcceptedAt: new Date(),
        createdAt: new Date(),
        createdByUid: 'anon_uid',
        imagesPurgedAt: null,
        hackedField: true // Extra field
      }));
    });

    it('anonymous visitor creates visitor for different UID -> DENY', async () => {
      const anonDb = getAnonContext('anon_uid').firestore();
      await assertFails(anonDb.collection('visitors').add({
        firstName: 'Test',
        middleName: '',
        lastName: 'Visitor',
        fullName: 'Test Visitor',
        contactNumber: '1234567890',
        purpose: 'Meeting',
        visitDate: '2026-10-01',
        idImagePublicId: null,
        photoPublicId: 'photo_id',
        consentAcceptedAt: new Date(),
        createdAt: new Date(),
        createdByUid: 'other_uid',
        imagesPurgedAt: null
      }));
    });
  });

  describe('GatePasses Collection - Creation', () => {
    const validGatePass = {
      visitorId: 'my_visitor',
      visitorName: 'Test Visitor',
      purpose: 'Meeting',
      photoPublicId: 'photo_id',
      idImagePublicId: null,
      source: 'portal',
      status: 'issued',
      validFrom: new Date(),
      validUntil: new Date(),
      issuedAt: new Date(),
      scannedAt: null,
      timeIn: null,
      timeOut: null,
      entryDeviceId: null,
      exitDeviceId: null,
      decidedByUid: null,
      rejectionReason: null,
      gate: null,
      createdByUid: 'anon_uid',
    };

    beforeEach(async () => {
      // Seed a valid visitor for 'anon_uid'
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection('visitors').doc('my_visitor').set({
          createdByUid: 'anon_uid',
        });
      });
    });

    it('visitor creates legitimate issued gate pass for own visitor record -> ALLOW', async () => {
      const db = getAnonContext('anon_uid').firestore();
      await assertSucceeds(db.collection('gatePasses').add(validGatePass));
    });
    
    it('visitor creates issued gate pass referencing someone else\'s visitor -> DENY', async () => {
      const db = getAnonContext('anon_uid').firestore();
      await assertFails(db.collection('gatePasses').add({
        ...validGatePass,
        visitorId: 'other_visitor', // belongs to other_uid
      }));
    });
    
    it('visitor creates gate pass with invalid source -> DENY', async () => {
      const db = getAnonContext('anon_uid').firestore();
      await assertFails(db.collection('gatePasses').add({
        ...validGatePass,
        source: 'hacker_app',
      }));
    });
    
    it('visitor creates gate pass with arbitrary extra field -> DENY', async () => {
      const db = getAnonContext('anon_uid').firestore();
      await assertFails(db.collection('gatePasses').add({
        ...validGatePass,
        hackedField: true,
      }));
    });
    
    it('visitor creates gate pass directly as inside/exited -> DENY', async () => {
      const db = getAnonContext('anon_uid').firestore();
      await assertFails(db.collection('gatePasses').add({
        ...validGatePass,
        status: 'inside',
      }));
    });
    
    it('Invalid initial pass status -> DENY', async () => {
      const db = getAnonContext('anon_uid').firestore();
      await assertFails(db.collection('gatePasses').add({
        ...validGatePass,
        status: 'exited', // Must be 'issued'
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

    it('Entry device issued -> expired -> ALLOW', async () => {
      const db = getDeviceContext('entry_device').firestore();
      await assertSucceeds(db.collection('gatePasses').doc('pass1').update({
        status: 'expired',
      }));
    });

    it('Entry device modifies unrelated field -> DENY', async () => {
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

    it('Exit device modifies unrelated field -> DENY', async () => {
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

    it('Guard sets decidedByUid to another user -> DENY', async () => {
      const db = getGuardContext('guard_uid').firestore();
      await assertFails(db.collection('gatePasses').doc('pass2').update({
        status: 'inside',
        timeIn: new Date(),
        decidedByUid: 'other_uid'
      }));
    });

    it('Kiosk device cannot arbitrarily update existing gate passes -> DENY', async () => {
      const db = getDeviceContext('kiosk_device').firestore();
      await assertFails(db.collection('gatePasses').doc('pass1').update({
        status: 'inside'
      }));
    });
  });
});
