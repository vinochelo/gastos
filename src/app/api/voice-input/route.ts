import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { transcribeAudio, parseTransaction } from "@/services/groq";
import fs from "fs";
import path from "path";
import os from "os";

export const dynamic = "force-static";

export async function POST(request: NextRequest) {
  let tempFilePath = "";
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const userId = formData.get("userId") as string | null;

    if (!file || !userId) {
      return NextResponse.json({ error: "Archivo y User ID requeridos" }, { status: 400 });
    }

    // 1. Escribir el audio en un archivo temporal
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    const ext = file.name ? path.extname(file.name) : ".webm";
    tempFilePath = path.join(os.tmpdir(), `voice-${Date.now()}${ext}`);
    fs.writeFileSync(tempFilePath, buffer);

    // 2. Transcribir el audio usando Groq Whisper
    const transcribedText = await transcribeAudio(tempFilePath);

    if (!transcribedText || transcribedText.trim().length === 0) {
       return NextResponse.json({ error: "No se detectó audio legible" }, { status: 400 });
    }

    // 3. Obtener las cuentas y categorías del usuario desde Firestore
    const accountsSnap = await adminDb.collection("accounts").where("userId", "==", userId).get();
    const accountNames = accountsSnap.docs.map(doc => doc.data().nombre);

    const userDoc = await adminDb.collection("users").doc(userId).get();
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
      result: parsedResult.items && parsedResult.items.length > 0 ? parsedResult.items[0] : null
    });

  } catch (error) {
    console.error("Error en voice-input:", error);
    
    // Limpiar archivo temporal en caso de error
    try {
      if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    } catch (e) {}

    return NextResponse.json({ error: "Error al procesar el audio" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Use POST method" }, { status: 400 });
}
