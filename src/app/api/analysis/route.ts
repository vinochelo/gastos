import { NextRequest, NextResponse } from "next/server";
import { adminDb, admin } from "@/lib/firebase-admin";
import { generateFinancialAnalysis } from "@/services/groq";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "User ID requerido" }, { status: 400 });
    }

    // 1. Fetch user accounts
    const accountsSnap = await adminDb.collection("accounts")
      .where("userId", "==", userId)
      .get();

    const balancesList = accountsSnap.docs.map(doc => ({
      nombre: doc.data().nombre,
      saldo: doc.data().saldo || 0
    }));

    // 2. Fetch current month's transactions
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const transSnap = await adminDb.collection("transactions")
      .where("userId", "==", userId)
      .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(startOfMonth))
      .get();

    let incomeTotal = 0;
    let expenseTotal = 0;
    const categoryExpenses: Record<string, number> = {};

    for (const doc of transSnap.docs) {
      const data = doc.data();
      const monto = data.monto || 0;
      if (data.tipo === "ingreso") {
        incomeTotal += monto;
      } else if (data.tipo === "gasto") {
        expenseTotal += monto;
        const cat = data.categoria || "Otro";
        categoryExpenses[cat] = (categoryExpenses[cat] || 0) + monto;
      }
    }

    // 3. Fetch user name for personalization
    const userDoc = await adminDb.collection("users").doc(userId).get();
    const userName = userDoc.data()?.name || "Usuario";

    // 4. Generate AI financial analysis
    const analysis = await generateFinancialAnalysis(
      incomeTotal,
      expenseTotal,
      balancesList,
      categoryExpenses,
      userName
    );

    return NextResponse.json({
      analysis,
      incomeTotal,
      expenseTotal,
      savingRate: incomeTotal > 0 ? ((incomeTotal - expenseTotal) / incomeTotal) * 100 : 0
    });
  } catch (error) {
    console.error("Error generating API financial analysis:", error);
    return NextResponse.json({ error: "Error interno al generar análisis" }, { status: 500 });
  }
}
