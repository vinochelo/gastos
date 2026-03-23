import { NextResponse } from "next/server";
import { adminDb, admin } from "@/lib/firebase-admin";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        resolve(NextResponse.json({ error: "No autenticado" }, { status: 401 }));
        return;
      }

      try {
        const code = generateCode();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

        await adminDb.collection("linkingCodes").doc(code).set({
          userId: user.uid,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
          used: false
        });

        resolve(NextResponse.json({
          code,
          expiresAt: expiresAt.toISOString()
        }));
      } catch (error) {
        console.error(error);
        resolve(NextResponse.json({ error: "Error interno" }, { status: 500 }));
      }
    });
  });
}

export async function GET() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        resolve(NextResponse.json({ error: "No autenticado" }, { status: 401 }));
        return;
      }

      try {
        const code = generateCode();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

        await adminDb.collection("linkingCodes").doc(code).set({
          userId: user.uid,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
          used: false
        });

        resolve(NextResponse.json({
          code,
          expiresAt: expiresAt.toISOString()
        }));
      } catch (error) {
        console.error(error);
        resolve(NextResponse.json({ error: "Error interno" }, { status: 500 }));
      }
    });
  });
}
