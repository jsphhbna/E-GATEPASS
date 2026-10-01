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
    return testEnv.authenticatedContext('admin_uid');
  };

  const getGuardContext = () => {
    return testEnv.authenticatedContext('guard_uid');
  };

  const getDeviceContext = () => {
    return testEnv.authenticatedContext('device_uid');
  };

  const getAnonContext = () => {
    return testEnv.authenticatedContext('anon_uid', { isAnonymous: true });
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

      await db.collection('devices').doc('device_uid').set({
        status: 'active',
      });
    });
  });

  describe('Visitors Collection', () => {
    it('allows anonymous users to create a visitor doc', async () => {
      const anonDb = getAnonContext().firestore();
      await assertSucceeds(anonDb.collection('visitors').add({
        firstName: 'Test',
        lastName: 'Visitor',
      }));
    });

    it('prevents unauthenticated users from reading visitor docs', async () => {
      const unauthedDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(unauthedDb.collection('visitors').get());
    });

    it('allows guards and admins to read visitor docs', async () => {
      const adminDb = getAdminContext().firestore();
      const guardDb = getGuardContext().firestore();
      await assertSucceeds(adminDb.collection('visitors').get());
      await assertSucceeds(guardDb.collection('visitors').get());
    });
  });

  describe('GatePasses Collection', () => {
    it('allows anonymous users to create a gate pass', async () => {
      const anonDb = getAnonContext().firestore();
      await assertSucceeds(anonDb.collection('gatePasses').add({
        status: 'issued',
        visitorId: 'visitor123',
        idImagePublicId: 'image123',
      }));
    });

    it('allows devices to update a gate pass (e.g., status pending/inside)', async () => {
      const deviceDb = getDeviceContext().firestore();
      // First seed a pass
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection('gatePasses').doc('pass1').set({ status: 'issued' });
      });
      await assertSucceeds(deviceDb.collection('gatePasses').doc('pass1').update({
        status: 'pending'
      }));
    });

    it('allows guards to update a gate pass', async () => {
      const guardDb = getGuardContext().firestore();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection('gatePasses').doc('pass2').set({ status: 'pending' });
      });
      await assertSucceeds(guardDb.collection('gatePasses').doc('pass2').update({
        status: 'inside'
      }));
    });
  });

  describe('Users & Devices Collections', () => {
    it('allows admins to write users', async () => {
      const adminDb = getAdminContext().firestore();
      await assertSucceeds(adminDb.collection('users').doc('new_user').set({
        role: 'guard',
        active: true,
      }));
    });

    it('prevents guards from writing users', async () => {
      const guardDb = getGuardContext().firestore();
      await assertFails(guardDb.collection('users').doc('new_user').set({
        role: 'admin',
        active: true,
      }));
    });
  });
});
