import { adminAuth } from './netlify/functions/firebase-admin';

async function test() {
  const list = await adminAuth.listUsers(1);
  console.log(JSON.stringify(list.users[0], null, 2));
}

test().catch(console.error);
