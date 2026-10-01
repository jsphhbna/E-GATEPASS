import { Handler } from '@netlify/functions';
import { getFirestore } from 'firebase-admin/firestore';
import { adminAuth } from './firebase-admin';
import { requireGuardOrAdmin, handleAuthError } from './utils/auth';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const authContext = await requireGuardOrAdmin(event.headers.authorization);
    const uid = authContext.uid;

    const userRecord = await adminAuth.getUser(uid);
    const creationTime = new Date(userRecord.metadata.creationTime).getTime();
    const tokensValidAfter = userRecord.tokensValidAfterTime 
      ? new Date(userRecord.tokensValidAfterTime).getTime() 
      : 0;

    // Verify the password was actually changed (tokens revoked after creation)
    if (tokensValidAfter <= creationTime + 10000) {
      return { 
        statusCode: 403, 
        body: JSON.stringify({ error: 'Backend validation failed: Password change not detected on Firebase Auth' }) 
      };
    }

    const db = getFirestore();
    const userRef = db.collection('users').doc(uid);
    
    await userRef.update({
      mustChangePassword: false
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Password flag cleared successfully' }),
    };
  } catch (error) {
    console.error('Error clearing password flag:', error);
    return handleAuthError(error);
  }
};
