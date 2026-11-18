import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth, admin } from "@/lib/firebase-admin";
import { corsPreflightResponse } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawCode = typeof body?.code === "string" ? body.code.trim() : "";
    const rawSessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
    const cleanSessionId = rawSessionId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);

    if (!rawCode && cleanSessionId.length < 8) {
      return NextResponse.json({ error: "Código o sesión requerido" }, { status: 400 });
    }

    const docId = cleanSessionId.length >= 8 ? `session_${cleanSessionId}` : rawCode;
    const docRef = adminDb.collection("mobileAuthCodes").doc(docId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      if (cleanSessionId.length >= 8) {
        return NextResponse.json({ valid: false, pending: true }, { status: 200 });
      }
      return NextResponse.json({ valid: false, error: "Código inválido o no existe" }, { status: 200 });
    }

    const data = docSnap.data()!;
    const now = admin.firestore.Timestamp.now();
    const isExpired = data.expiresAt.toMillis() < now.toMillis();

    if (data.used) {
      return NextResponse.json({ valid: false, error: "Este código ya ha sido utilizado" }, { status: 200 });
    }

    if (isExpired) {
      return NextResponse.json({ valid: false, error: "El código ha expirado" }, { status: 200 });
    }

    const batch = adminDb.batch();
    batch.update(docRef, {
      used: true,
      usedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    if (cleanSessionId.length >= 8 && typeof data.code === "string" && data.code) {
      batch.update(adminDb.collection("mobileAuthCodes").doc(data.code), {
        used: true,
        usedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();

    const userId = data.userId;
    const customToken = await adminAuth.createCustomToken(userId);

    return NextResponse.json({
      valid: true,
      customToken,
      userId,
    });
  } catch (error) {
    console.error("Error verifying mobile auth code:", error);
    return NextResponse.json({ error: "Error interno al verificar código" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Use el método POST" }, { status: 400 });
}

export async function OPTIONS() {
  return corsPreflightResponse();
}
