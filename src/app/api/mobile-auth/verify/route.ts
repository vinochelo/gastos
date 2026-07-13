import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth, admin } from "@/lib/firebase-admin";

export const dynamic = "force-static";

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json({ error: "Código requerido" }, { status: 400 });
    }

    const codeStr = String(code).trim();
    const docRef = adminDb.collection("mobileAuthCodes").doc(codeStr);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
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

    // Marcar el código como usado
    await docRef.update({
      used: true,
      usedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Generar el custom token de Firebase Auth para el userId
    const userId = data.userId;
    const customToken = await adminAuth.createCustomToken(userId);

    return NextResponse.json({
      valid: true,
      customToken,
      userId
    });
  } catch (error) {
    console.error("Error verifying mobile auth code:", error);
    return NextResponse.json({ error: "Error interno al verificar código" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Use el método POST" }, { status: 400 });
}
