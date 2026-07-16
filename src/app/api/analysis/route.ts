import { NextRequest, NextResponse } from "next/server";
import { adminDb, admin } from "@/lib/firebase-admin";
import { generateFinancialAnalysis } from "@/services/groq";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { userId, month, year } = await request.json();

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

    // 2. Calculate the date range for the requested month
    let startOfMonth: Date;
    let endOfMonth: Date;

    if (month !== undefined && year !== undefined) {
      startOfMonth = new Date(year, month, 1, 0, 0, 0, 0);
      endOfMonth = new Date(year, month + 1, 1, 0, 0, 0, 0);
    } else {
      startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 1, 0, 0, 0, 0);
    }

    // 3. Fetch transactions within the month's range
    const transSnap = await adminDb.collection("transactions")
      .where("userId", "==", userId)
      .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(startOfMonth))
      .where("timestamp", "<", admin.firestore.Timestamp.fromDate(endOfMonth))
      .orderBy("timestamp", "desc")
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

    // 4. Extract monthly transactions detail list for AI context
    const recentTransactionsList = transSnap.docs.map(doc => {
      const data = doc.data();
      return {
        tipo: data.tipo,
        monto: data.monto || 0,
        categoria: data.categoria || "Otro",
        descripcion: data.descripcion || ""
      };
    });

    // 5. Fetch user name for personalization
    const userDoc = await adminDb.collection("users").doc(userId).get();
    const userName = userDoc.data()?.name || "Usuario";

    // 6. Generate AI financial analysis
    const analysis = await generateFinancialAnalysis(
      incomeTotal,
      expenseTotal,
      balancesList,
      categoryExpenses,
      userName,
      recentTransactionsList,
      month,
      year
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
