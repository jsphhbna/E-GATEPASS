import { Handler } from '@netlify/functions';
import { getFirestore } from 'firebase-admin/firestore';
import { adminAuth } from './firebase-admin';
import { requireAdmin, handleAuthError } from './utils/auth';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const authContext = await requireAdmin(event.headers.authorization);
    const db = getFirestore();

    const body = JSON.parse(event.body || '{}');
    const { targetUid, email, password } = body;

    if (!targetUid || typeof targetUid !== 'string') {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing or invalid targetUid' }) };
    }

    // Verify the target actually represents a registered device
    const deviceDoc = await db.collection('devices').doc(targetUid).get();
    if (!deviceDoc.exists) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Target device not found in database' }) };
    }

    const updateParams: any = {};
    if (email && typeof email === 'string' && email.includes('@')) {
      updateParams.email = email;
    }
    if (password && typeof password === 'string' && password.length >= 6) {
      updateParams.password = password;
    }

    if (Object.keys(updateParams).length > 0) {
      await adminAuth.updateUser(targetUid, updateParams);
      
      if (updateParams.email) {
        await db.collection('devices').doc(targetUid).update({ email: updateParams.email });
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Device credentials updated successfully' }),
    };
  } catch (error) {
    console.error('Error updating device auth:', error);
    return handleAuthError(error);
  }
};
