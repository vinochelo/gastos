import { NextRequest, NextResponse } from "next/server";
import { Telegraf, type Context } from "telegraf";
import admin from "firebase-admin";
import { adminDb } from "@/lib/firebase-admin";
import { transcribeAudio, parseTransaction, getHelpMessage, editPendingWithAI, generateFinancialAnalysis } from "@/services/groq";
import { analyzeReceipt } from "@/services/ai";
import {
  evaluateBudgets,
  getBudgetStatusLabel,
  normalizeCategoryKey,
  BudgetInput,
} from "@/lib/budgets";
import axios from "axios";
import fs from "fs";
import path from "path";
import os from "os";

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || "");

function splitTelegramMessage(text: string, maxLength = 4000): string[] {
  if (text.length <= maxLength) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > maxLength) {
    let splitIdx = remaining.lastIndexOf("\n", maxLength);
    if (splitIdx <= 0) splitIdx = maxLength;
    chunks.push(remaining.slice(0, splitIdx));
    remaining = remaining.slice(splitIdx).trimStart();
  }
  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

type TelegramReplyExtra = Parameters<Context["reply"]>[1];
type TelegramContext = { reply: Context["reply"] };

async function safeReply(
  ctx: TelegramContext,
  text: string,
  extra?: TelegramReplyExtra
) {
  const chunks = splitTelegramMessage(text);
  for (let i = 0; i < chunks.length; i++) {
    const chunkExtra: TelegramReplyExtra | undefined =
      i === chunks.length - 1
        ? extra
        : extra?.parse_mode
        ? { parse_mode: extra.parse_mode }
        : undefined;
    try {
      await ctx.reply(chunks[i], chunkExtra);
    } catch (err) {
      if (chunkExtra?.parse_mode) {
        const fallbackExtra = { ...chunkExtra };
        delete fallbackExtra.parse_mode;
        await ctx.reply(chunks[i], Object.keys(fallbackExtra).length ? fallbackExtra : undefined);
      } else {
        throw err;
      }
    }
  }
}

function levenshteinDistance(s1: string, s2: string): number {
  const len1 = s1.length;
  const len2 = s2.length;
  const matrix = Array.from({ length: len1 + 1 }, () => new Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[len1][len2];
}

function cleanAccountName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z0-9]/g, ""); // Keep only letters and numbers
}

function findAccount(
  accountQuery: string | undefined,
  accountsList: admin.firestore.QueryDocumentSnapshot[]
): admin.firestore.QueryDocumentSnapshot | null {
  if (!accountQuery) return null;
  const cleanQuery = cleanAccountName(accountQuery);
  if (!cleanQuery) return null;

  // 1. Exact match (after cleaning)
  let bestMatch = accountsList.find(d => cleanAccountName(d.data().nombre) === cleanQuery);
  if (bestMatch) return bestMatch;

  // 2. Starts with / Ends with or Substring
  bestMatch = accountsList.find(d => {
    const cleanName = cleanAccountName(d.data().nombre);
    return cleanName.includes(cleanQuery) || cleanQuery.includes(cleanName);
  });
  if (bestMatch) return bestMatch;

  // 3. Levenshtein distance for fuzzy matching
  let minDistance = Infinity;
  let candidate = null;
  for (const doc of accountsList) {
    const cleanName = cleanAccountName(doc.data().nombre);
    if (Math.abs(cleanName.length - cleanQuery.length) <= 3) {
      const dist = levenshteinDistance(cleanName, cleanQuery);
      if (dist < minDistance) {
        minDistance = dist;
        candidate = doc;
      }
    }
  }

  if (candidate) {
    const cleanName = cleanAccountName(candidate.data().nombre);
    const maxAllowedDist = Math.max(1, Math.floor(cleanName.length * 0.3));
    if (minDistance <= maxAllowedDist) {
      return candidate;
    }
  }

  return null;
}

async function getEvaluatedUserBudgets(
  userId: string,
  extraExpenseByNormalizedCat: Record<string, number> = {}
) {
  const budgetsSnap = await adminDb
    .collection("budgets")
    .where("userId", "==", userId)
    .get();

  const budgets: BudgetInput[] = budgetsSnap.docs.map((d) => ({
    id: d.id,
    categoria: String(d.data().categoria || "Otros"),
    monto: Number(d.data().monto || 0),
  }));

  if (budgets.length === 0) return null;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);

  const transSnap = await adminDb
    .collection("transactions")
    .where("userId", "==", userId)
    .where("tipo", "==", "gasto")
    .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(startOfMonth))
    .where("timestamp", "<", admin.firestore.Timestamp.fromDate(startOfNextMonth))
    .get();

  const spentMap: Record<string, number> = { ...extraExpenseByNormalizedCat };
  for (const doc of transSnap.docs) {
    const data = doc.data();
    const key = normalizeCategoryKey(data.categoria);
    spentMap[key] = (spentMap[key] || 0) + Number(data.monto || 0);
  }

  return evaluateBudgets(budgets, spentMap);
}

function getStatusEmoji(status: "ok" | "warning" | "exceeded"): string {
  if (status === "exceeded") return "🚨";
  if (status === "warning") return "⚠️";
  return "✅";
}

function formatBudgetReportMessage(evaluated: NonNullable<Awaited<ReturnType<typeof getEvaluatedUserBudgets>>>): string {
  const { summary, items } = evaluated;
  const emoji = getStatusEmoji(summary.status);
  let msg = `📊 *ESTADO DE PRESUPUESTOS (MES ACTUAL):*\n`;
  msg += `${emoji} *${getBudgetStatusLabel(summary.status)}* (${summary.pctRaw}%)\n`;
  msg += `• Gastado: $${summary.totalSpent.toFixed(2)} de $${summary.totalBudgeted.toFixed(2)}\n`;
  msg +=
    summary.remaining >= 0
      ? `• Disponible: $${summary.remaining.toFixed(2)}\n`
      : `• Excedido por: $${Math.abs(summary.remaining).toFixed(2)}\n`;
  msg += `• Ritmo del mes: Día ${summary.pace.dayOfMonth}/${summary.pace.daysInMonth} (${summary.pace.expectedPct}%)\n\n`;

  for (const item of items) {
    const itemEmoji = getStatusEmoji(item.status);
    const diffText =
      item.remaining >= 0
        ? `quedan $${item.remaining.toFixed(2)}`
        : `excedido +$${Math.abs(item.remaining).toFixed(2)}`;
    msg += `${itemEmoji} *${item.categoria}:* $${item.spent.toFixed(2)} / $${item.limit.toFixed(2)} (${item.pctRaw}% · ${diffText})\n`;
  }

  return msg;
}

async function handlePendingEdit(ctx: TelegramContext, userId: string, pendingId: string, userInput: string) {
  await safeReply(ctx, "✏️ Aplicando cambio...");
  const pendingDoc = await adminDb.collection("pendingTransactions").doc(pendingId).get();
  const userRef = adminDb.collection("users").doc(userId);
  if (!pendingDoc.exists) {
     await userRef.update({ telegramState: admin.firestore.FieldValue.delete() });
     return safeReply(ctx, "❌ La transacción expiró o ya fue guardada.");
  }
  const oldData = pendingDoc.data()!;
  
  const userDoc = await userRef.get();
  const userData = userDoc.data() || {};
  const expCats = userData.expenseCategories || userData.categories || [];
  const incCats = userData.incomeCategories || [];
  
  const newData = await editPendingWithAI(oldData, userInput, expCats, incCats);
  
  await pendingDoc.ref.update({
    monto: newData.monto || oldData.monto,
    categoria: newData.categoria || oldData.categoria,
    descripcion: newData.descripcion || oldData.descripcion,
  });

  await userRef.update({ telegramState: admin.firestore.FieldValue.delete() });

  const message = `📝 *Nuevos datos detectados:*\n\n💰 Monto: $${newData.monto || oldData.monto}\n📂 Categoría: ${newData.categoria || oldData.categoria}\n📄 Descripción: ${newData.descripcion || oldData.descripcion}\n\n¿Qué deseas hacer?`;

  await safeReply(ctx, message, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Confirmar", callback_data: `confirm_receipt_${pendingId}` },
          { text: "✏️ Editar", callback_data: `edit_receipt_${pendingId}` }
        ],
        [
          { text: "❌ Cancelar", callback_data: "cancel_receipt" }
        ]
      ]
    }
  });
}

async function processIncomingTransaction(ctx: TelegramContext, userId: string, userInput: string, isAudio = false) {
  try {
    const userDoc = await adminDb.collection("users").doc(userId).get();
    const userData = userDoc.data() || {};
    const accountsSnap = await adminDb.collection("accounts").where("userId", "==", userId).get();
    const accountNames = accountsSnap.docs.map(d => d.data().nombre);

    if (isAudio) await safeReply(ctx, "🤖 Analizando...");
    else await safeReply(ctx, "🤖 Procesando...");

    const result = await parseTransaction(
      userInput, 
      accountNames, 
      userData.expenseCategories || userData.categories, 
      userData.incomeCategories
    );

    if (!result.items || result.items.length === 0) {
      return await safeReply(ctx, "🤔 No entendí.\n\n" + getHelpMessage(), { parse_mode: "Markdown" });
    }

    const batch = adminDb.batch();
    const results: string[] = [];
    const addedExpensesByCat: Record<string, number> = {};

    for (const item of result.items) {
      if (item.tipo === "ayuda") {
        return await safeReply(ctx, getHelpMessage(), { parse_mode: "Markdown" });
      }
      
      if (item.tipo === "enlace_web") {
        return await safeReply(ctx, "🌐 *Accede a la aplicación web:*\n\nhttps://gastos-delta-pearl.vercel.app/", { parse_mode: "Markdown" });
      }
      
      const requiresMonto = item.tipo === "gasto" || item.tipo === "ingreso" || item.tipo === "transferencia";
      if (requiresMonto && !item.monto) continue;
      const monto = item.monto ? Math.abs(item.monto) : 0;
      
      let timestamp = admin.firestore.FieldValue.serverTimestamp();
      if (item.fecha) {
        const d = new Date(item.fecha);
        d.setUTCHours(12, 0, 0, 0); 
        timestamp = admin.firestore.Timestamp.fromDate(d);
      }

      if (item.tipo === "reclasificar") {
        const recentSnap = await adminDb.collection("transactions")
          .where("userId", "==", userId)
          .orderBy("timestamp", "desc")
          .limit(50)
          .get();

        let match = recentSnap.docs.find(doc => {
          const data = doc.data();
          const matchMonto = !monto || Math.abs(data.monto) === monto;
          const matchCat = item.categoriaAnterior ? data.categoria?.toLowerCase() === item.categoriaAnterior.toLowerCase() : false;
          return matchMonto && matchCat;
        });

        if (!match && item.categoriaAnterior) {
          const catAnteriorLower = item.categoriaAnterior.toLowerCase();
          match = recentSnap.docs.find(doc => {
            const data = doc.data();
            return data.categoria?.toLowerCase() === catAnteriorLower;
          });
        }

        if (!match && monto > 0) {
          match = recentSnap.docs.find(doc => {
            const data = doc.data();
            return Math.abs(data.monto) === monto;
          });
        }

        if (!match && recentSnap.docs.length > 0) {
          match = recentSnap.docs[0];
        }

        if (match) {
          const oldCat = match.data().categoria;
          batch.update(match.ref, { categoria: item.categoria });
          results.push(`🔄 Reclasificado: $${Math.abs(match.data().monto)} de "${oldCat}" a "${item.categoria}".`);
        } else {
          results.push(`⚠️ No encontré ninguna transacción para reclasificar.`);
        }
      } 
      else if (item.tipo === "transferencia") {
        const fromDoc = findAccount(item.fromCuenta || item.cuentaAnterior, accountsSnap.docs);
        const toDoc = findAccount(item.toCuenta || item.cuenta, accountsSnap.docs);
        if (fromDoc && toDoc && fromDoc.id !== toDoc.id) {
          batch.set(adminDb.collection("transactions").doc(), {
            userId, monto, tipo: "transferencia", fromId: fromDoc.id, toId: toDoc.id,
            fromNombre: fromDoc.data().nombre, toNombre: toDoc.data().nombre,
            categoria: "Transferencia",
            timestamp, createdAt: admin.firestore.FieldValue.serverTimestamp(), fuente: "telegram",
            descripcion: item.descripcion || `Transferencia: ${fromDoc.data().nombre} → ${toDoc.data().nombre}`
          });
          batch.update(fromDoc.ref, { saldo: admin.firestore.FieldValue.increment(-monto) });
          batch.update(toDoc.ref, { saldo: admin.firestore.FieldValue.increment(monto) });
          results.push(`✅ Trf: $${monto} de ${fromDoc.data().nombre} a ${toDoc.data().nombre}.`);
        } else {
          results.push(`⚠️ No pude identificar cuentas válidas de origen y destino para la transferencia.`);
        }
      } else if (item.tipo === "consulta_saldo") {
        const cuentaBuscada = item.cuenta?.toLowerCase();
        let mensaje = "💰 *SALDOS:* \n";
        let total = 0;
        
        if (cuentaBuscada === "todas" || !cuentaBuscada) {
          for (const doc of accountsSnap.docs) {
            const data = doc.data();
            mensaje += `• ${data.nombre}: $${(data.saldo || 0).toFixed(2)}\n`;
            if (!data.nombre.toLowerCase().includes("ahorro")) {
              total += data.saldo || 0;
            }
          }
          mensaje += `────────────────\n*TOTAL DISPONIBLE:* $${total.toFixed(2)}\n\n`;

          // Fetch current month's transaction totals for summary & AI analysis
          try {
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);

            const transSnap = await adminDb.collection("transactions")
              .where("userId", "==", userId)
              .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(startOfMonth))
              .orderBy("timestamp", "desc")
              .get();

            let incomeTotal = 0;
            let expenseTotal = 0;
            const categoryExpenses: Record<string, number> = {};

            for (const tDoc of transSnap.docs) {
              const tData = tDoc.data();
              const tMonto = tData.monto || 0;
              if (tData.tipo === "ingreso") {
                incomeTotal += tMonto;
              } else if (tData.tipo === "gasto") {
                expenseTotal += tMonto;
                const cat = tData.categoria || "Otro";
                categoryExpenses[cat] = (categoryExpenses[cat] || 0) + tMonto;
              }
            }

            const mesActualNombre = new Date().toLocaleString('es-ES', { month: 'long' });
            mensaje += `📊 *RESUMEN DE ${mesActualNombre.toUpperCase()}:*\n`;
            mensaje += `• Ingresos: $${incomeTotal.toFixed(2)}\n`;
            mensaje += `• Gastos: $${expenseTotal.toFixed(2)}\n`;
            mensaje += `• Ahorro Neto: $${(incomeTotal - expenseTotal).toFixed(2)}\n\n`;

            const shouldRunAi = /anal|ia|gestor|consejo|recom|suger/i.test(userInput || "");
            
            if (shouldRunAi) {
              mensaje += `🧠 *ANÁLISIS DE IA (GESTOR.AI):*\n`;
              const balancesList = accountsSnap.docs.map(d => ({
                nombre: d.data().nombre,
                saldo: d.data().saldo || 0
              }));
              
              const userDoc = await adminDb.collection("users").doc(userId).get();
              const userName = userDoc.data()?.name || "Usuario";

              const recentTransactionsList = transSnap.docs.map(doc => {
                const data = doc.data();
                return {
                  tipo: data.tipo,
                  monto: data.monto || 0,
                  categoria: data.categoria || "Otro",
                  descripcion: data.descripcion || ""
                };
              });

              const aiAnalysis = await generateFinancialAnalysis(
                incomeTotal,
                expenseTotal,
                balancesList,
                categoryExpenses,
                userName,
                recentTransactionsList
              );
              
              mensaje += aiAnalysis;
            } else {
              mensaje += `💡 *Tip:* Si quieres consejos de GESTOR.AI, escribe *"analizar"* o *"consejos"*.`;
            }
          } catch (aiErr) {
            console.error("Error generating Telegram AI analysis:", aiErr);
            mensaje += "_(No se pudo generar el análisis de IA en este momento)_";
          }
        } else {
          const cuentaMatch = findAccount(cuentaBuscada, accountsSnap.docs);
          if (cuentaMatch) {
            const data = cuentaMatch.data();
            mensaje = `💰 *${data.nombre}:* $${(data.saldo || 0).toFixed(2)}`;
          } else {
            mensaje = `❌ No encontré la cuenta "${item.cuenta}".`;
          }
        }
        await safeReply(ctx, mensaje, { parse_mode: "Markdown" });
        return;
      } else if (item.tipo === "consulta_presupuesto") {
        const evaluated = await getEvaluatedUserBudgets(userId);
        if (!evaluated) {
          await safeReply(ctx, "📊 Aún no tienes presupuestos mensuales configurados. Créalos en la sección *Presupuestos* de la app.", { parse_mode: "Markdown" });
          return;
        }
        if (item.categoria) {
          const targetKey = normalizeCategoryKey(item.categoria);
          const matchItem = evaluated.items.find(
            (b) => normalizeCategoryKey(b.categoria) === targetKey
          );
          if (matchItem) {
            const emoji = getStatusEmoji(matchItem.status);
            const diffText =
              matchItem.remaining >= 0
                ? `Disponible: $${matchItem.remaining.toFixed(2)}`
                : `Excedido por: $${Math.abs(matchItem.remaining).toFixed(2)}`;
            await safeReply(
              ctx,
              `${emoji} *Presupuesto ${matchItem.categoria}:* ${getBudgetStatusLabel(matchItem.status)}\n• Gastado: $${matchItem.spent.toFixed(2)} / $${matchItem.limit.toFixed(2)} (${matchItem.pctRaw}%)\n• ${diffText}`,
              { parse_mode: "Markdown" }
            );
            return;
          }
        }
        await safeReply(ctx, formatBudgetReportMessage(evaluated), { parse_mode: "Markdown" });
        return;
      } else if (item.tipo === "consulta_gasto_categoria") {
        const catBuscada = item.categoria;
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        
        const transSnap = await adminDb.collection("transactions")
          .where("userId", "==", userId)
          .where("tipo", "==", "gasto")
          .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(startOfMonth))
          .get();
        
        let total = 0;
        let count = 0;
        const mesActual = new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' });
        
        if (catBuscada) {
          const catLower = catBuscada.toLowerCase();
          for (const doc of transSnap.docs) {
            const data = doc.data();
            if (data.categoria?.toLowerCase().includes(catLower)) {
              total += Number(data.monto || 0);
              count++;
            }
          }
          await safeReply(ctx, `📊 GASTOS EN ${catBuscada.toUpperCase()} (${mesActual}):\n\n💰 Total: $${total.toFixed(2)}\n📝 Transacciones: ${count}`);
          return;
        } else {
          const porCategoria: Record<string, number> = {};
          for (const doc of transSnap.docs) {
            const data = doc.data();
            const cat = data.categoria || "Varios";
            porCategoria[cat] = (porCategoria[cat] || 0) + Number(data.monto || 0);
          }
          let msg = `📊 GASTOS DEL MES (${mesActual}):\n\n`;
          for (const [cat, monto] of Object.entries(porCategoria).sort((a, b) => b[1] - a[1])) {
            msg += `• ${cat}: $${monto.toFixed(2)}\n`;
          }
          const totalGastos = Object.values(porCategoria).reduce((a, b) => a + b, 0);
          msg += `\n💰 TOTAL: $${totalGastos.toFixed(2)}`;
          await safeReply(ctx, msg);
          return;
        }
      } else if (item.tipo === "reverso") {
        const requestedMonto = item.monto ? Math.abs(item.monto) : 0;
        const cuentaBuscada = item.cuenta?.toLowerCase();
        
        const recentSnap = await adminDb.collection("transactions")
          .where("userId", "==", userId)
          .orderBy("timestamp", "desc")
          .limit(20)
          .get();
        
        let matchFound = false;
        
        for (const doc of recentSnap.docs) {
          const data = doc.data();
          const txMonto = Math.abs(data.monto || 0);
          const matchMonto = !requestedMonto || txMonto === requestedMonto;
          const matchedAcc = cuentaBuscada ? findAccount(cuentaBuscada, accountsSnap.docs) : null;
          const matchCuenta = !cuentaBuscada || 
            (data.accountId && matchedAcc && matchedAcc.id === data.accountId);
          
          if (matchMonto && matchCuenta) {
            const descripcionReverso = data.descripcion && data.descripcion !== data.categoria ? ` - ${data.descripcion}` : "";

            if (data.tipo === "transferencia") {
              if (data.fromId) {
                batch.update(adminDb.collection("accounts").doc(data.fromId), { saldo: admin.firestore.FieldValue.increment(txMonto) });
              }
              if (data.toId) {
                batch.update(adminDb.collection("accounts").doc(data.toId), { saldo: admin.firestore.FieldValue.increment(-txMonto) });
              }
              results.push(`↩️ REVERSADA transferencia: $${txMonto}${descripcionReverso}`);
            } else {
              const isGasto = data.tipo === "gasto";
              const multReverso = isGasto ? 1 : -1;
              if (data.accountId) {
                const accountDocMatch = accountsSnap.docs.find(a => a.id === data.accountId);
                if (accountDocMatch) {
                  const currentSaldo = accountDocMatch.data().saldo || 0;
                  const newSaldo = currentSaldo + (multReverso * txMonto);
                  batch.update(adminDb.collection("accounts").doc(data.accountId), { saldo: admin.firestore.FieldValue.increment(multReverso * txMonto) });
                  results.push(`↩️ REVERSADO: $${txMonto} en ${accountDocMatch.data().nombre}${descripcionReverso} (saldo: $${newSaldo.toFixed(2)})`);
                }
              }
            }
            
            batch.delete(adminDb.collection("transactions").doc(doc.id));
            matchFound = true;
            break;
          }
        }
        
        if (!matchFound) {
          results.push(requestedMonto ? `⚠️ No encontré transacción de $${requestedMonto} para revertir.` : `⚠️ No encontré ninguna transacción reciente para revertir.`);
        }
      } else if (item.tipo === "editar") {
        const recentSnap = await adminDb.collection("transactions")
          .where("userId", "==", userId)
          .orderBy("timestamp", "desc")
          .limit(20)
          .get();
        
        let matchDoc = null;
        
        // Criterios de búsqueda:
        const buscarMonto = item.montoAnterior ? Math.abs(item.montoAnterior) : (item.monto ? Math.abs(item.monto) : null);
        const buscarCuenta = item.cuentaAnterior?.toLowerCase();
        const buscarCat = item.categoriaAnterior?.toLowerCase();

        if (buscarMonto || buscarCuenta || buscarCat) {
          matchDoc = recentSnap.docs.find(doc => {
            const data = doc.data();
            const matchM = buscarMonto ? Math.abs(data.monto) === buscarMonto : true;
            
            let matchAc = true;
            if (buscarCuenta && data.accountId) {
              const matchedAcc = findAccount(buscarCuenta, accountsSnap.docs);
              matchAc = matchedAcc ? matchedAcc.id === data.accountId : false;
            }
            
            const matchC = buscarCat ? data.categoria?.toLowerCase() === buscarCat : true;
            
            return matchM && matchAc && matchC;
          });
        }
        
        // Fallback 1: Si no hay match con criterios anteriores pero sí con el monto especificado
        if (!matchDoc && item.monto) {
          const targetMonto = Math.abs(item.monto);
          matchDoc = recentSnap.docs.find(doc => Math.abs(doc.data().monto) === targetMonto);
        }

        // Fallback 2: La más reciente
        if (!matchDoc && recentSnap.docs.length > 0) {
          matchDoc = recentSnap.docs[0];
        }

        if (matchDoc) {
          const data = matchDoc.data();
          const oldTipo = data.tipo;
          const oldMonto = Math.abs(data.monto);
          const oldAccountId = data.accountId;
          const isTransfer = oldTipo === "transferencia";

          const finalMonto = item.monto ? Math.abs(item.monto) : oldMonto;
          const finalTipo = item.nuevoTipo || oldTipo;
          const finalCategoria = item.categoria || data.categoria;
          
          let newAccountId = oldAccountId;
          if (item.cuenta) {
            const newAccountDoc = findAccount(item.cuenta, accountsSnap.docs);
            if (newAccountDoc) newAccountId = newAccountDoc.id;
          }

          // 1. Revertir saldo anterior
          if (isTransfer) {
            if (data.fromId) {
              batch.update(adminDb.collection("accounts").doc(data.fromId), { saldo: admin.firestore.FieldValue.increment(oldMonto) });
            }
            if (data.toId) {
              batch.update(adminDb.collection("accounts").doc(data.toId), { saldo: admin.firestore.FieldValue.increment(-oldMonto) });
            }
          } else if (oldAccountId) {
            const multReverso = oldTipo === "gasto" ? 1 : -1;
            const oldAccountDoc = accountsSnap.docs.find(a => a.id === oldAccountId);
            if (oldAccountDoc) {
              batch.update(oldAccountDoc.ref, { saldo: admin.firestore.FieldValue.increment(multReverso * oldMonto) });
            }
          }

          // 2. Aplicar nuevo saldo
          if (finalTipo === "transferencia") {
            const fromId = data.fromId;
            const toId = data.toId;
            if (fromId) {
              batch.update(adminDb.collection("accounts").doc(fromId), { saldo: admin.firestore.FieldValue.increment(-finalMonto) });
            }
            if (toId) {
              batch.update(adminDb.collection("accounts").doc(toId), { saldo: admin.firestore.FieldValue.increment(finalMonto) });
            }
          } else if (newAccountId) {
            const multNuevo = finalTipo === "ingreso" ? 1 : -1;
            const newAccountDoc = accountsSnap.docs.find(a => a.id === newAccountId);
            if (newAccountDoc) {
              batch.update(newAccountDoc.ref, { saldo: admin.firestore.FieldValue.increment(multNuevo * finalMonto) });
            }
          }

          // 3. Actualizar la transacción
          const updates: Record<string, unknown> = {
            monto: finalMonto,
            tipo: finalTipo,
            categoria: finalCategoria,
            fuente: "telegram_edit"
          };
          if (newAccountId !== undefined && newAccountId !== null) updates.accountId = newAccountId;
          if (item.descripcion) updates.descripcion = item.descripcion;

          batch.update(matchDoc.ref, updates);
          
          results.push(`✏️ EDITADO: $${oldMonto} (${oldTipo}) -> $${finalMonto} (${finalTipo}) en ${finalCategoria}`);
        } else {
          results.push(`⚠️ No encontré ninguna transacción para editar.`);
        }
      } else {
        let accountDoc = findAccount(item.cuenta, accountsSnap.docs);
        
        // Si no se especifica cuenta o no matchea, buscar "Efectivo"
        if (!accountDoc) {
          accountDoc = accountsSnap.docs.find(d => d.data().nombre.toLowerCase().includes("efectivo")) ?? null;
        }

        // Si no hay "Efectivo", usar la primera cuenta disponible
        if (!accountDoc && accountsSnap.docs.length > 0) {
          accountDoc = accountsSnap.docs[0];
        }

        if (!accountDoc) {
          results.push(`⚠️ No tienes cuentas registradas. Crea una en la app web.`);
          continue;
        }

        const mult = item.tipo === "ingreso" ? 1 : -1;
        const categoriaFinal = item.categoria || "Varios";
        const descripcion = item.descripcion || categoriaFinal || userInput;
        batch.set(adminDb.collection("transactions").doc(), {
          userId, monto, tipo: item.tipo || "gasto", accountId: accountDoc.id,
          categoria: categoriaFinal, subcategoria: item.subcategoria || "", descripcion: descripcion,
          timestamp, createdAt: admin.firestore.FieldValue.serverTimestamp(), fuente: "telegram"
        });
        batch.update(accountDoc.ref, { saldo: admin.firestore.FieldValue.increment(mult * monto) });
        if (mult < 0) {
          const catKey = normalizeCategoryKey(categoriaFinal);
          addedExpensesByCat[catKey] = (addedExpensesByCat[catKey] || 0) + monto;
        }
        const dateLabel = item.fecha ? `[${item.fecha}] ` : "";
        const detailLabel = item.descripcion && item.descripcion !== item.categoria ? ` - ${item.descripcion}` : "";
        results.push(`${mult > 0 ? "💰" : "💳"} ${dateLabel}$${monto} en ${categoriaFinal}${detailLabel} (${accountDoc.data().nombre})`);
      }
    }

    if (results.length > 0) {
      let budgetNotes = "";
      const expenseKeys = Object.keys(addedExpensesByCat);
      if (expenseKeys.length > 0) {
        try {
          const evaluated = await getEvaluatedUserBudgets(userId, addedExpensesByCat);
          if (evaluated) {
            const matchedNotes = evaluated.items
              .filter((b) => expenseKeys.includes(normalizeCategoryKey(b.categoria)))
              .map((b) => {
                const emoji = getStatusEmoji(b.status);
                const estado = getBudgetStatusLabel(b.status);
                return `${emoji} Presupuesto ${b.categoria}: $${b.spent.toFixed(2)}/$${b.limit.toFixed(2)} (${b.pctRaw}% · ${estado})`;
              });
            if (matchedNotes.length > 0) {
              budgetNotes = "\n\n" + matchedNotes.join("\n");
            }
          }
        } catch (budgetErr) {
          console.warn("Could not evaluate budgets after transaction:", budgetErr);
        }
      }

      await batch.commit();
      await safeReply(ctx, `✅ REPORTE:\n${results.join("\n")}${budgetNotes}`);
    } else {
      await safeReply(ctx, "❌ Error: Verifica cuentas o montos.");
    }
  } catch (error) {
    console.error("Error in processIncomingTransaction:", error);
    await safeReply(ctx, "❌ Error en el procesamiento. Verifica la configuración de IA del bot.");
  }
}

bot.command("vincular", async (ctx) => {
  const args = ctx.message.text.split(" ").slice(1);
  const code = args[0];

  if (!code) {
    const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);
    
    try {
      await adminDb.collection("linkingCodes").doc(generatedCode).set({
        userId: "pending",
        telegramId: ctx.from.id.toString(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        used: false
      });
      
      return ctx.reply(`📋 Para vincular, necesitas ir a la app web:\n\n1. Abre: https://gastos-delta-pearl.vercel.app/ajustes\n2. Genera tu código de vinculación\n3. Usa: /vincular [código]\n\n⏰ El código de la web expira en 5 minutos.`);
    } catch (error) {
      console.error(error);
      return ctx.reply("❌ Error. Intenta de nuevo.");
    }
  }

  try {
    const codeDoc = await adminDb.collection("linkingCodes").doc(code).get();

    if (!codeDoc.exists) {
      return ctx.reply("❌ Código inválido. Genera uno nuevo desde la app web.");
    }

    const data = codeDoc.data()!;
    const now = admin.firestore.Timestamp.now();
    const isExpired = data.expiresAt.toMillis() < now.toMillis();

    if (data.used) {
      return ctx.reply("❌ Este código ya fue usado.");
    }

    if (isExpired) {
      return ctx.reply("⏰ Este código expiró. Genera uno nuevo desde la app web.");
    }

    const telegramId = ctx.from.id.toString();
    const username = ctx.from.username ? `@${ctx.from.username}` : "";

    await adminDb.collection("users").doc(data.userId).update({
      telegramId,
      telegramUsername: username
    });

    await codeDoc.ref.update({ used: true });

    await safeReply(ctx, "✅ ¡Cuenta vinculada exitosamente!\n\nYa puedes registrar gastos directamente desde Telegram.");
  } catch (error) {
    console.error(error);
    await safeReply(ctx, "❌ Error al vincular. Intenta de nuevo.");
  }
});

bot.on("text", async (ctx) => {
  const telegramId = ctx.from.id.toString();
  try {
    const userSnap = await adminDb.collection("users").where("telegramId", "==", telegramId).limit(1).get();
    if (userSnap.empty) return await safeReply(ctx, "⚠️ Vincula tu cuenta con /vincular [código].");
    const userData = userSnap.docs[0].data();
    if (userData.telegramState && userData.telegramState.startsWith("editing_")) {
      const pendingId = userData.telegramState.replace("editing_", "");
      await handlePendingEdit(ctx, userSnap.docs[0].id, pendingId, ctx.message.text);
      return;
    }
    await processIncomingTransaction(ctx, userSnap.docs[0].id, ctx.message.text);
  } catch (err) {
    console.error("Error handling text message:", err);
    await safeReply(ctx, "❌ Error al procesar tu mensaje.");
  }
});

bot.on("voice", async (ctx) => {
  const fileId = ctx.message.voice.file_id;
  const telegramId = ctx.from.id.toString();
  try {
     const userSnap = await adminDb.collection("users").where("telegramId", "==", telegramId).limit(1).get();
     if (userSnap.empty) return await safeReply(ctx, "⚠️ Vincula tu cuenta con /vincular [código].");
     const userId = userSnap.docs[0].id;
     await safeReply(ctx, "🎤 Escuchando...");
     const fileLink = await bot.telegram.getFileLink(fileId);
     const tempPath = path.join(os.tmpdir(), `${fileId}.ogg`);
     const response = await axios({ url: fileLink.toString(), responseType: 'stream' });
     const writer = fs.createWriteStream(tempPath);
     response.data.pipe(writer);
     await new Promise<void>((resolve, reject) => {
       writer.on('finish', () => resolve());
       writer.on('error', (err) => reject(err));
     });
     const transcription = await transcribeAudio(tempPath);
     await safeReply(ctx, `📝 "${transcription}"`);
     
     const userData = userSnap.docs[0].data();
     if (userData.telegramState && userData.telegramState.startsWith("editing_")) {
       const pendingId = userData.telegramState.replace("editing_", "");
       await handlePendingEdit(ctx, userId, pendingId, transcription);
     } else {
       await processIncomingTransaction(ctx, userId, transcription, true);
     }
     try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
   } catch (err) {
     console.error("Error handling voice message:", err);
     await safeReply(ctx, "❌ Error de audio.");
   }
});

bot.on("photo", async (ctx) => {
  const telegramId = ctx.from.id.toString();
  try {
     const userSnap = await adminDb.collection("users").where("telegramId", "==", telegramId).limit(1).get();
     if (userSnap.empty) return await safeReply(ctx, "⚠️ Vincula tu cuenta con /vincular [código].");
     
      const userId = userSnap.docs[0].id;
      // Telegram provee un array de resoluciones. [0] es la más pequeña (ilegible para facturas).
      // Usamos el último elemento para obtener la foto en alta resolución.
      const photo = ctx.message.photo[ctx.message.photo.length - 1]; 
      const fileId = photo.file_id;

      await safeReply(ctx, "🤖 Descargando y analizando factura...");

      const fileLink = await bot.telegram.getFileLink(fileId);
      
      // Download image as buffer
      const imageResponse = await axios.get(fileLink.toString(), { responseType: 'arraybuffer' });
      const base64Image = Buffer.from(imageResponse.data).toString('base64');

      // Send typing action to keep the connection alive
      await ctx.sendChatAction("typing");

      let result;
      try {
        result = await analyzeReceipt(base64Image, true);
      } catch (err: unknown) {
        const errMessage = err instanceof Error ? err.message : String(err);
        console.error("Error in analyzeReceipt:", err);
        return await safeReply(ctx, `❌ Error al analizar la imagen: ${errMessage}. Intenta de nuevo.`);
      }

      if (!result || result.error) {
        const debugMsg = result?.error?.includes("JSON") ? `\n\n(Debug: ${result.error})` : "";
        return await safeReply(ctx, `❌ ${result?.error || "No se pudo leer la imagen"}. Intenta de nuevo o describe el gasto manualmente.${debugMsg}`);
     }

     // 1. Guardar datos temporales en Firestore (para evitar el límite de 64 bytes de Telegram)
     const pendingRef = adminDb.collection("pendingTransactions").doc();
     await pendingRef.set({
       userId,
       monto: result.monto,
       categoria: result.categoria,
       descripcion: result.descripcion,
       fuente: "telegram_photo",
       createdAt: admin.firestore.FieldValue.serverTimestamp()
     });
     
     const message = `📝 *Datos detectados:*\n\n💰 Monto: $${result.monto}\n📂 Categoría: ${result.categoria}\n📄 Descripción: ${result.descripcion}\n\n¿Qué deseas hacer?`;

     // 2. Responder con botones inline pasando solo el ID
     await safeReply(ctx, message, {
       parse_mode: "Markdown",
       reply_markup: {
         inline_keyboard: [
           [
             { text: "✅ Confirmar", callback_data: `confirm_receipt_${pendingRef.id}` },
             { text: "✏️ Editar", callback_data: `edit_receipt_${pendingRef.id}` }
           ],
           [
             { text: "❌ Cancelar", callback_data: "cancel_receipt" }
           ]
         ]
       }
     });

  } catch (error) {
    console.error("Error processing photo:", error);
    await safeReply(ctx, "❌ Error al procesar la foto. Intenta de nuevo.");
  }
});

bot.on("callback_query", async (ctx) => {
  const cbQuery = ctx.callbackQuery as { data?: string; message?: { text?: string } };
  const callbackData = cbQuery.data;
  if (!callbackData) return;

  if (callbackData.startsWith("confirm_receipt_")) {
    try {
      const pendingId = callbackData.replace("confirm_receipt_", "");
      const pendingDoc = await adminDb.collection("pendingTransactions").doc(pendingId).get();
      
      if (!pendingDoc.exists) {
        return await ctx.answerCbQuery("❌ Error: Los datos expiraron o no existen.");
      }
      
      const data = pendingDoc.data()!;
      
      const userSnap = await adminDb.collection("users").doc(data.userId).get();
      if (!userSnap.exists) return await ctx.answerCbQuery("Error: Usuario no encontrado.");
      
      const userId = userSnap.id;
      const accountsSnap = await adminDb.collection("accounts").where("userId", "==", userId).get();
      
      if (accountsSnap.empty) {
        await ctx.answerCbQuery("❌ No tienes cuentas.");
        return await safeReply(ctx, "⚠️ No tienes cuentas registradas.");
      }

      // Buscar cuenta Efectivo o usar la primera
      let accountDoc = accountsSnap.docs.find(d => d.data().nombre.toLowerCase().includes("efectivo"));
      if (!accountDoc) accountDoc = accountsSnap.docs[0];

      const monto = Math.abs(data.monto);
      const batch = adminDb.batch();
      const timestamp = admin.firestore.FieldValue.serverTimestamp();

      batch.set(adminDb.collection("transactions").doc(), {
        userId,
        monto,
        tipo: "gasto",
        accountId: accountDoc.id,
        categoria: data.categoria || "Varios",
        subcategoria: data.subcategoria || "",
        descripcion: data.descripcion || "Factura",
        timestamp,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        fuente: "telegram_photo"
      });

      batch.update(accountDoc.ref, { saldo: admin.firestore.FieldValue.increment(-monto) });

      const catFinal = data.categoria || "Varios";
      let budgetLine = "";
      try {
        const catKey = normalizeCategoryKey(catFinal);
        const evaluated = await getEvaluatedUserBudgets(userId, { [catKey]: monto });
        const matchItem = evaluated?.items.find(
          (b) => normalizeCategoryKey(b.categoria) === catKey
        );
        if (matchItem) {
          const emoji = getStatusEmoji(matchItem.status);
          budgetLine = `\n${emoji} Presupuesto ${matchItem.categoria}: $${matchItem.spent.toFixed(2)}/$${matchItem.limit.toFixed(2)} (${matchItem.pctRaw}% · ${getBudgetStatusLabel(matchItem.status)})`;
        }
      } catch (budgetErr) {
        console.warn("Could not evaluate budget after receipt confirm:", budgetErr);
      }

      await batch.commit();
      
      // Limpiar datos temporales
      await adminDb.collection("pendingTransactions").doc(pendingId).delete();

      await ctx.answerCbQuery("✅ Registrado!");
      await ctx.editMessageText(`✅ *Gasto Registrado:*\n\n💰 $${monto} en ${catFinal}\n📂 ${data.descripcion}${budgetLine}`, { parse_mode: "Markdown" });

    } catch (error) {
      console.error("Error confirming receipt:", error);
      await ctx.answerCbQuery("❌ Error al confirmar.");
    }
  } else if (callbackData.startsWith("edit_receipt_")) {
    const pendingId = callbackData.replace("edit_receipt_", "");
    const pendingDoc = await adminDb.collection("pendingTransactions").doc(pendingId).get();
    
    if (!pendingDoc.exists) return await ctx.answerCbQuery("❌ Error: Expirado.");
    
    const data = pendingDoc.data()!;
    await adminDb.collection("users").doc(data.userId).update({
      telegramState: `editing_${pendingId}`
    });
    
    await ctx.answerCbQuery("Modo Edición Activado");
    
    // Attempt to extract original message text safely
    const originalText = cbQuery.message?.text || "Datos previos detectados.";
    
    await ctx.editMessageText(`✏️ *Modo Edición*\n\n${originalText}\n\n👉 *Escribe o envía un audio con los cambios que deseas* (ej: "Pon monto en 20" o "Cambia categoría a Transporte").`, { parse_mode: "Markdown" });

  } else if (callbackData === "cancel_receipt") {
    await ctx.answerCbQuery("Cancelado");
    await ctx.editMessageText("❌ Operación Cancelada.");
  }
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    await bot.handleUpdate(body);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid update" }, { status: 400 });
  }
}
