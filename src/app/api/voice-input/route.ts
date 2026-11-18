import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { transcribeAudio, parseTransaction } from "@/services/groq";
import { getAuthenticatedUserId, corsPreflightResponse } from "@/lib/auth-server";
import fs from "fs";
import path from "path";
import os from "os";

export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  let tempFilePath = "";
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
    }

    // 1. Escribir el audio en un archivo temporal
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    const rawExt = file.name ? path.extname(file.name) : "";
    const ext = rawExt || ".webm";
    tempFilePath = path.join(os.tmpdir(), `voice-${Date.now()}${ext}`);
    fs.writeFileSync(tempFilePath, buffer);

    // 2. Transcribir el audio usando Groq Whisper
    const transcribedText = await transcribeAudio(tempFilePath);

    if (!transcribedText || transcribedText.trim().length === 0) {
       return NextResponse.json({ error: "No se detectó audio legible" }, { status: 400 });
    }

    // 3. Obtener las cuentas y categorías del usuario desde Firestore
    const [accountsSnap, userDoc] = await Promise.all([
      adminDb.collection("accounts").where("userId", "==", userId).get(),
      adminDb.collection("users").doc(userId).get(),
    ]);
    const accountNames = accountsSnap.docs.map(doc => doc.data().nombre);
    const userData = userDoc.exists ? userDoc.data()! : {};
    
    // 4. Analizar la intención de la transacción con Groq LLM
    const parsedResult = await parseTransaction(
      transcribedText,
      accountNames,
      userData.expenseCategories || userData.categories,
      userData.incomeCategories
    );

    // 5. Borrar el archivo temporal
    try {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    } catch (e) {
      console.error("Error al eliminar archivo temporal:", e);
    }

    return NextResponse.json({
      text: transcribedText,
      result: parsedResult.items && parsedResult.items.length > 0 ? parsedResult.items[0] : null,
      items: parsedResult.items || [],
    });

  } catch (error) {
    console.error("Error en voice-input:", error);
    
    // Limpiar archivo temporal en caso de error
    try {
      if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    } catch { /* ignore cleanup error */ }

    return NextResponse.json({ error: "Error al procesar el audio" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Use POST method" }, { status: 400 });
}

export async function OPTIONS() {
  return corsPreflightResponse();
}
