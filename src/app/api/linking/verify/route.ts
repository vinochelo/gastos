import { NextRequest, NextResponse } from "next/server";
import { adminDb, admin } from "@/lib/firebase-admin";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Código requerido" }, { status: 400 });
  }

  try {
    const doc = await adminDb.collection("linkingCodes").doc(code).get();

    if (!doc.exists) {
      return NextResponse.json({ valid: false, error: "Código no existe" }, { status: 200 });
    }

    const data = doc.data()!;
    const now = admin.firestore.Timestamp.now();
    const isExpired = data.expiresAt.toMillis() < now.toMillis();

    if (data.used) {
      return NextResponse.json({ valid: false, error: "Código ya usado" }, { status: 200 });
    }

    if (isExpired) {
      return NextResponse.json({ valid: false, error: "Código expirado" }, { status: 200 });
    }

    return NextResponse.json({
      valid: true,
      userId: data.userId
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
