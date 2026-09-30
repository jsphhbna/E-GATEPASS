import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  // Use a generic test project ID
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-e-gatepass-test',
    firestore: {
      rules: readFileSync(resolve(import.meta.dirname, 'firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

beforeEach(async () => {
  // Clear the database between tests
  await testEnv.clearFirestore();
});

afterAll(async () => {
  // Cleanup test environment
  await testEnv.cleanup();
});

describe('EARIST E-GatePass Firestore Rules', () => {
  
  it('Unauthenticated users cannot read anything (settings/app is exception)', async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    
    // settings/app should succeed
    await assertSucceeds(unauthedDb.collection('settings').doc('app').get());
    
    // visitors should fail
    await assertFails(unauthedDb.collection('visitors').get());
  });

  it('Anonymous visitor cannot read other visitors data', async () => {
    const visitorAuth = testEnv.authenticatedContext('visitor123', { isAnonymous: true });
    
    // First, admin seeds another visitor
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('visitors').doc('other456').set({
        createdByUid: 'other456',
        fullName: 'Jane Doe'
      });
    });

    const visitorDb = visitorAuth.firestore();
    
    // Trying to read the other visitor's doc should fail
    await assertFails(visitorDb.collection('visitors').doc('other456').get());
  });

  it('Guard cannot delete a gate pass', async () => {
    const guardAuth = testEnv.authenticatedContext('guard123', { email: 'guard@test.com' });
    
    // Admin seeds guard role and a gate pass
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.collection('users').doc('guard123').set({
        role: 'guard',
        active: true
      });
      await db.collection('gatePasses').doc('pass123').set({
        status: 'pending'
      });
    });

    const guardDb = guardAuth.firestore();
    
    // Trying to delete a gate pass should fail
    await assertFails(guardDb.collection('gatePasses').doc('pass123').delete());
  });

  it('Revoked device cannot update a gate pass', async () => {
    const deviceAuth = testEnv.authenticatedContext('device123');
    
    // Admin seeds revoked device role and a gate pass
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.collection('devices').doc('device123').set({
        type: 'entry',
        status: 'revoked' // <--- REVOKED
      });
      await db.collection('gatePasses').doc('pass123').set({
        status: 'issued'
      });
    });

    const deviceDb = deviceAuth.firestore();
    
    // Trying to update the gate pass should fail because status != 'active'
    await assertFails(
      deviceDb.collection('gatePasses').doc('pass123').update({
        status: 'pending'
      })
    );
  });
});
