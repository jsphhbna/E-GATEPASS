import { Handler } from '@netlify/functions';
import { getFirestore } from 'firebase-admin/firestore';
import { adminAuth } from './firebase-admin';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { statusCode: 401, body: 'Missing or invalid authorization header' };
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;

    const db = getFirestore();
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return { statusCode: 404, body: 'User not found' };
    }

    const userData = userDoc.data();
    if (userData?.role !== 'admin') {
      return { statusCode: 403, body: 'Only admins can manage device accounts' };
    }

    const body = JSON.parse(event.body || '{}');
    const { targetUid, email, password } = body;

    if (!targetUid) {
      return { statusCode: 400, body: 'Missing targetUid' };
    }

    const updateParams: any = {};
    if (email) updateParams.email = email;
    if (password) updateParams.password = password;

    if (Object.keys(updateParams).length > 0) {
      await adminAuth.updateUser(targetUid, updateParams);
      
      // Update the device document to reflect new email (if changed)
      if (email) {
        await db.collection('devices').doc(targetUid).update({ email });
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Device credentials updated successfully' }),
      headers: {
        'Content-Type': 'application/json',
      },
    };
  } catch (error) {
    console.error('Error updating device auth:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
