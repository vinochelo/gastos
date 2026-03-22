import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { adminDb } from '../src/lib/firebase-admin';

async function checkUsers() {
  try {
    const snapshot = await adminDb.collection('users').get();
    console.log(`Encontrados ${snapshot.size} usuarios.`);
    snapshot.forEach(doc => {
      console.log(`ID: ${doc.id}, Data:`, doc.data());
    });
  } catch (error) {
    console.error("Error al consultar usuarios:", error);
  }
}

checkUsers();
