import { assertFails, assertSucceeds, initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import * as fs from 'fs';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-gatepass-test',
    firestore: {
      rules: fs.readFileSync('firestore.rules', 'utf8'),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('Firestore Security Rules', () => {
  it('allows valid visitor creation (anonymous)', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    const docRef = db.collection('visitors').doc('valid-visitor-1');
    await assertSucceeds(
      docRef.set({
        firstName: 'John',
        lastName: 'Doe',
        purpose: 'Meeting',
        visitDate: '2026-10-01',
        createdAt: new Date(),
        status: 'pending',
        consent: true
      })
    );
  });

  it('denies visitor creation without firstName', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    const docRef = db.collection('visitors').doc('invalid-no-first-name');
    await assertFails(
      docRef.set({
        lastName: 'Doe',
        purpose: 'Meeting',
        visitDate: '2026-10-01',
        createdAt: new Date(),
        status: 'pending',
        consent: true
      })
    );
  });

  it('denies visitor creation without lastName', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    const docRef = db.collection('visitors').doc('invalid-no-last-name');
    await assertFails(
      docRef.set({
        firstName: 'John',
        purpose: 'Meeting',
        visitDate: '2026-10-01',
        createdAt: new Date(),
        status: 'pending',
        consent: true
      })
    );
  });

  it('denies visitor reading anything', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(db.collection('visitors').get());
  });

  it('allows entry device to get a pass by token', async () => {
    const db = testEnv.authenticatedContext('device1', { role: 'device' }).firestore();
    await assertSucceeds(db.collection('gatePasses').doc('pass1').get());
  });

  it('denies entry device listing passes', async () => {
    const db = testEnv.authenticatedContext('device1', { role: 'device' }).firestore();
    await assertFails(db.collection('gatePasses').get());
  });

  it('allows guard to list pending passes', async () => {
    const db = testEnv.authenticatedContext('guard1', { role: 'guard' }).firestore();
    await assertSucceeds(
      db.collection('gatePasses').where('status', '==', 'pending').get()
    );
  });

  it('denies user changing their own role', async () => {
    const db = testEnv.authenticatedContext('user1', { role: 'guard' }).firestore();
    await assertFails(db.collection('users').doc('user1').update({ role: 'admin' }));
  });

  it('denies deactivated staff reading anything', async () => {
    const db = testEnv.authenticatedContext('user2', { role: 'guard', active: false }).firestore();
    await assertFails(db.collection('visitors').get());
  });
});
