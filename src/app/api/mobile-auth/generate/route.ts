import { NextResponse } from "next/server";
import { adminDb, admin } from "@/lib/firebase-admin";
import { getAuthenticatedUserId, corsPreflightResponse } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

function generateCode(): string {
  // Genera un código de 6 dígitos aleatorio
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const rawSessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
    const cleanSessionId = rawSessionId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);

    const code = generateCode();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutos de validez
    const expiresTs = admin.firestore.Timestamp.fromDate(expiresAt);

    // Guardar en la colección 'mobileAuthCodes'
    const batch = adminDb.batch();
    batch.set(adminDb.collection("mobileAuthCodes").doc(code), {
      userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: expiresTs,
      used: false,
    });

    if (cleanSessionId.length >= 8) {
      batch.set(adminDb.collection("mobileAuthCodes").doc(`session_${cleanSessionId}`), {
        userId,
        code,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: expiresTs,
        used: false,
      });
    }

    await batch.commit();

    return NextResponse.json({
      code,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("Error generating mobile auth code:", error);
    return NextResponse.json({ error: "Error interno al generar código" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Use el método POST" }, { status: 400 });
}

export async function OPTIONS() {
  return corsPreflightResponse();
}
