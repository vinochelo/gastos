import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { parseTransaction } from "@/services/groq";
import { getAuthenticatedUserId, corsPreflightResponse } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { text } = await request.json();
    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Texto requerido" }, { status: 400 });
    }

    const [accountsSnap, userDoc] = await Promise.all([
      adminDb.collection("accounts").where("userId", "==", userId).get(),
      adminDb.collection("users").doc(userId).get(),
    ]);

    const accountNames = accountsSnap.docs.map((doc) => doc.data().nombre);
    const userData = userDoc.exists ? userDoc.data()! : {};

    const parsedResult = await parseTransaction(
      text.trim(),
      accountNames,
      userData.expenseCategories || userData.categories,
      userData.incomeCategories
    );

    return NextResponse.json({
      text: text.trim(),
      result: parsedResult.items && parsedResult.items.length > 0 ? parsedResult.items[0] : null,
      items: parsedResult.items || [],
    });
  } catch (error) {
    console.error("Error en text-input:", error);
    return NextResponse.json({ error: "Error al procesar el texto" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return corsPreflightResponse();
}
