import { NextResponse } from "next/server";
import { adminDb, admin } from "@/lib/firebase-admin";
import { auth } from "@/lib/firebase";
import { getAuth } from "firebase/auth";

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function generateLinkingCode(): Promise<{ code: string; expiresAt: string } | { error: string }> {
  const user = getAuth().currentUser;
  
  if (!user) {
    return { error: "No autenticado" };
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

    return {
      code,
      expiresAt: expiresAt.toISOString()
    };
  } catch (error) {
    console.error(error);
    return { error: "Error interno" };
  }
}

export async function POST() {
  const result = await generateLinkingCode();
  
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }
  
  return NextResponse.json(result);
}

export async function GET() {
  const result = await generateLinkingCode();
  
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }
  
  return NextResponse.json(result);
}
