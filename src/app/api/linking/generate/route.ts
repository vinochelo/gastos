import { NextResponse } from "next/server";
import { adminDb, admin } from "@/lib/firebase-admin";
import { getAuthenticatedUserId, corsPreflightResponse } from "@/lib/auth-server";

export const dynamic = "force-dynamic";
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const code = generateCode();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

    await adminDb.collection("linkingCodes").doc(code).set({
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
    console.error("Error generating code:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Use POST method" }, { status: 400 });
}

export async function OPTIONS() {
  return corsPreflightResponse();
}
