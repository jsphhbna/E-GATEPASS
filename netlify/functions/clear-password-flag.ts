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
    if (userData?.role !== 'guard') {
      return { statusCode: 403, body: 'Only guards can clear this flag' };
    }

    await userRef.update({
      mustChangePassword: false
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Password flag cleared successfully' }),
      headers: {
        'Content-Type': 'application/json',
      },
    };
  } catch (error) {
    console.error('Error clearing password flag:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
