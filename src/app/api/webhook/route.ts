import { NextRequest, NextResponse } from "next/server";
import { Telegraf } from "telegraf";
import admin from "firebase-admin";
import { adminDb } from "@/lib/firebase-admin";
import { transcribeAudio, parseTransaction } from "@/services/groq";
import axios from "axios";
import fs from "fs";
import path from "path";
import os from "os";

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || "");

async function processIncomingTransaction(ctx: { reply: (msg: string) => Promise<unknown> }, userId: string, userInput: string, isAudio = false) {
  try {
    const userDoc = await adminDb.collection("users").doc(userId).get();
    const userData = userDoc.data() || {};
    const accountsSnap = await adminDb.collection("accounts").where("userId", "==", userId).get();
    const accountNames = accountsSnap.docs.map(d => d.data().nombre);

    if (isAudio) ctx.reply("🤖 Analizando lo que dijiste...");
    else ctx.reply("🤖 Procesando con IA...");

    const result = await parseTransaction(
      userInput, 
      accountNames, 
      userData.expenseCategories || userData.categories, 
      userData.incomeCategories
    );

    if (!result.items || result.items.length === 0) {
      return ctx.reply("🤔 ¿Qué deseas hacer? No pude detectar una acción clara.");
    }

    const batch = adminDb.batch();
    const results: string[] = [];

    for (const item of result.items) {
      if (!item.monto && item.tipo !== "consulta_saldo") continue;
      const monto = Math.abs(item.monto);
      
      let timestamp = admin.firestore.FieldValue.serverTimestamp();
      if (item.fecha) {
        const d = new Date(item.fecha);
        d.setUTCHours(12, 0, 0, 0); 
        timestamp = admin.firestore.Timestamp.fromDate(d);
      }

      if (item.tipo === "reclasificar") {
        // Obtenemos los últimos 50 movimientos para filtrar en memoria (evita errores de índices complejos)
        const recentSnap = await adminDb.collection("transactions")
          .where("userId", "==", userId)
          .orderBy("timestamp", "desc")
          .limit(50)
          .get();

        const match = recentSnap.docs.find(doc => {
          const data = doc.data();
          const matchMonto = Math.abs(data.monto) === monto;
          const matchCat = item.categoriaAnterior ? data.categoria === item.categoriaAnterior : true;
          return matchMonto && matchCat;
        });

        if (match) {
          batch.update(match.ref, { categoria: item.categoria });
          results.push(`🔄 Reclasificado: $${monto} a "${item.categoria}".`);
        } else {
          results.push(`⚠️ No encontré el gasto de $${monto} entre los últimos 50 movimientos.`);
        }
      } 
      else if (item.tipo === "transferencia") {
        const fromDoc = accountsSnap.docs.find(d => 
          d.data().nombre.toLowerCase().includes(item.fromCuenta?.toLowerCase()) ||
          item.fromCuenta?.toLowerCase().includes(d.data().nombre.toLowerCase())
        );
        const toDoc = accountsSnap.docs.find(d => 
          d.data().nombre.toLowerCase().includes(item.toCuenta?.toLowerCase()) ||
          item.toCuenta?.toLowerCase().includes(d.data().nombre.toLowerCase())
        );
        if (fromDoc && toDoc) {
          batch.set(adminDb.collection("transactions").doc(), {
            userId, monto, tipo: "transferencia", fromId: fromDoc.id, toId: toDoc.id,
            timestamp, fuente: "telegram",
            descripcion: item.descripcion || "Transferencia"
          });
          batch.update(fromDoc.ref, { saldo: admin.firestore.FieldValue.increment(-monto) });
          batch.update(toDoc.ref, { saldo: admin.firestore.FieldValue.increment(monto) });
          results.push(`✅ Trf: $${monto} de ${fromDoc.data().nombre} a ${toDoc.data().nombre}.`);
        }
      } else if (item.tipo === "consulta_saldo") {
        const cuentaBuscada = item.cuenta?.toLowerCase();
        let mensaje = "💰 *SALDOS:*\n";
        let total = 0;
        
        if (cuentaBuscada === "todas" || !cuentaBuscada) {
          for (const doc of accountsSnap.docs) {
            const data = doc.data();
            mensaje += `• ${data.nombre}: $${(data.saldo || 0).toFixed(2)}\n`;
            total += data.saldo || 0;
          }
          mensaje += `────────────────\n*TOTAL:* $${total.toFixed(2)}`;
        } else {
          const cuentaMatch = accountsSnap.docs.find(d => 
            d.data().nombre.toLowerCase().includes(cuentaBuscada) ||
            cuentaBuscada.includes(d.data().nombre.toLowerCase())
          );
          if (cuentaMatch) {
            const data = cuentaMatch.data();
            mensaje = `💰 *${data.nombre}:* $${(data.saldo || 0).toFixed(2)}`;
          } else {
            mensaje = `❌ No encontré la cuenta "${item.cuenta}".`;
          }
        }
        ctx.reply(mensaje);
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
              total += data.monto || 0;
              count++;
            }
          }
          ctx.reply(`📊 GASTOS EN ${catBuscada.toUpperCase()} (${mesActual}):\n\n💰 Total: $${total.toFixed(2)}\n📝 Transacciones: ${count}`);
        } else {
          const porCategoria: Record<string, number> = {};
          for (const doc of transSnap.docs) {
            const data = doc.data();
            const cat = data.categoria || "Varios";
            porCategoria[cat] = (porCategoria[cat] || 0) + (data.monto || 0);
          }
          let msg = `📊 GASTOS DEL MES (${mesActual}):\n\n`;
          for (const [cat, monto] of Object.entries(porCategoria).sort((a, b) => b[1] - a[1])) {
            msg += `• ${cat}: $${monto.toFixed(2)}\n`;
          }
          const totalGastos = Object.values(porCategoria).reduce((a, b) => a + b, 0);
          msg += `\n💰 TOTAL: $${totalGastos.toFixed(2)}`;
          ctx.reply(msg);
        }
        return;
      } else {
        const accountDoc = accountsSnap.docs.find(d => 
          d.data().nombre.toLowerCase().includes(item.cuenta?.toLowerCase()) ||
          item.cuenta?.toLowerCase().includes(d.data().nombre.toLowerCase())
        ) || (accountsSnap.docs.length === 1 ? accountsSnap.docs[0] : null);

        if (accountDoc) {
          const mult = item.tipo === "ingreso" ? 1 : -1;
          batch.set(adminDb.collection("transactions").doc(), {
            userId, monto, tipo: item.tipo || "gasto", accountId: accountDoc.id,
            categoria: item.categoria || "Varios", descripcion: item.descripcion || userInput,
            timestamp, fuente: "telegram"
          });
          batch.update(accountDoc.ref, { saldo: admin.firestore.FieldValue.increment(mult * monto) });
          const dateLabel = item.fecha ? `[${item.fecha}] ` : "";
          results.push(`${mult > 0 ? "💰" : "💳"} ${dateLabel}$${monto} en ${item.categoria}.`);
        }
      }
    }

    if (results.length > 0) {
      await batch.commit();
      ctx.reply(`✅ REPORTE:\n${results.join("\n")}`);
    } else {
      ctx.reply("❌ Error: Verifica cuentas o montos.");
    }
  } catch (error) {
    console.error(error);
    ctx.reply("❌ Error en el procesamiento. Verifica que el bot esté configurado.");
  }
}

bot.on("text", async (ctx) => {
  const telegramId = ctx.from.id.toString();
  try {
    const userSnap = await adminDb.collection("users").where("telegramId", "==", telegramId).limit(1).get();
    if (userSnap.empty) return ctx.reply("⚠️ Vincula tu cuenta.");
    await processIncomingTransaction(ctx, userSnap.docs[0].id, ctx.message.text);
  } catch { ctx.reply("❌ Error."); }
});

bot.on("voice", async (ctx) => {
  const fileId = ctx.message.voice.file_id;
  const telegramId = ctx.from.id.toString();
  try {
     const userSnap = await adminDb.collection("users").where("telegramId", "==", telegramId).limit(1).get();
     if (userSnap.empty) return ctx.reply("⚠️ Vincula tu cuenta.");
     const userId = userSnap.docs[0].id;
     ctx.reply("🎤 Analizando...");
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
     ctx.reply(`📝 "${transcription}"`);
     await processIncomingTransaction(ctx, userId, transcription, true);
     try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
  } catch { ctx.reply("❌ Error de audio."); }
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
