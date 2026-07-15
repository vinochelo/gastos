import { NextResponse } from "next/server";
import { adminDb, admin } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";
function generateCode(): string {
  // Genera un código de 6 dígitos aleatorio
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ error: "User ID requerido" }, { status: 400 });
    }

    const code = generateCode();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutos de validez

    // Guardar en la colección 'mobileAuthCodes'
    await adminDb.collection("mobileAuthCodes").doc(code).set({
      userId: userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      used: false
    });

    return NextResponse.json({
      code,
      expiresAt: expiresAt.toISOString()
    });
  } catch (error) {
    console.error("Error generating mobile auth code:", error);
    return NextResponse.json({ error: "Error interno al generar código" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Use el método POST" }, { status: 400 });
}
