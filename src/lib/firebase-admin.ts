import admin from "firebase-admin";

const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
const extractedProjectId = clientEmail?.match(/@([^.]+)\.iam\.gserviceaccount\.com/)?.[1];
const projectId = extractedProjectId || process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!admin.apps.length) {
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Falta configuración de Firebase Admin. Verifica las variables de entorno.");
  }
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

const adminDb = admin.firestore();
const adminAuth = admin.auth();
const adminStorage = admin.storage();

export { adminDb, adminAuth, adminStorage, admin };
