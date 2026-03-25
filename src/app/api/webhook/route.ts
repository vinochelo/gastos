import { NextRequest, NextResponse } from "next/server";
import { Telegraf } from "telegraf";
import admin from "firebase-admin";
import { adminDb } from "@/lib/firebase-admin";
import { transcribeAudio, parseTransaction, getHelpMessage, editPendingWithAI } from "@/services/groq";
import { analyzeReceipt } from "@/services/ai";
import axios from "axios";
import fs from "fs";
import path from "path";
import os from "os";

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || "");

async function handlePendingEdit(ctx: any, userId: string, pendingId: string, userInput: string) {
  ctx.reply("✏️ Aplicando cambio...");
  const pendingDoc = await adminDb.collection("pendingTransactions").doc(pendingId).get();
  const userRef = adminDb.collection("users").doc(userId);
  if (!pendingDoc.exists) {
     await userRef.update({ telegramState: admin.firestore.FieldValue.delete() });
     return ctx.reply("❌ La transacción expiró o ya fue guardada.");
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

  ctx.reply(message, {
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

async function processIncomingTransaction(ctx: { reply: (msg: string) => Promise<unknown> }, userId: string, userInput: string, isAudio = false) {
  try {
    const userDoc = await adminDb.collection("users").doc(userId).get();
    const userData = userDoc.data() || {};
    const accountsSnap = await adminDb.collection("accounts").where("userId", "==", userId).get();
    const accountNames = accountsSnap.docs.map(d => d.data().nombre);

    if (isAudio) ctx.reply("🤖 Analizando...");
    else ctx.reply("🤖 Procesando...");

    const result = await parseTransaction(
      userInput, 
      accountNames, 
      userData.expenseCategories || userData.categories, 
      userData.incomeCategories
    );

    if (!result.items || result.items.length === 0) {
      return ctx.reply("🤔 No entendí. " + getHelpMessage());
    }

    const batch = adminDb.batch();
    const results: string[] = [];

    for (const item of result.items) {
      if (item.tipo === "ayuda") {
        return ctx.reply(getHelpMessage());
      }
      
      if (item.tipo === "enlace_web") {
        return ctx.reply("🌐 *Accede a la aplicación web:*\n\nhttps://gastos-delta-pearl.vercel.app/");
      }
      
      if (!item.monto && item.tipo !== "consulta_saldo") continue;
      const monto = Math.abs(item.monto);
      
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
            timestamp, createdAt: admin.firestore.FieldValue.serverTimestamp(), fuente: "telegram",
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
          return;
        }
      } else if (item.tipo === "reverso") {
        const montoReverso = Math.abs(item.monto);
        const cuentaBuscada = item.cuenta?.toLowerCase();
        
        const recentSnap = await adminDb.collection("transactions")
          .where("userId", "==", userId)
          .orderBy("timestamp", "desc")
          .limit(20)
          .get();
        
        let matchFound = false;
        
        for (const doc of recentSnap.docs) {
          const data = doc.data();
          const matchMonto = Math.abs(data.monto) === montoReverso;
          const matchCuenta = !cuentaBuscada || 
            (data.accountId && accountsSnap.docs.some(a => a.id === data.accountId && a.data().nombre.toLowerCase().includes(cuentaBuscada)));
          
          if (matchMonto && matchCuenta) {
            const isGasto = data.tipo === "gasto";
            const multReverso = isGasto ? 1 : -1;
            const descripcionReverso = data.descripcion && data.descripcion !== data.categoria ? ` - ${data.descripcion}` : "";
            
            if (data.accountId) {
              const accountDocMatch = accountsSnap.docs.find(a => a.id === data.accountId);
              if (accountDocMatch) {
                const currentSaldo = accountDocMatch.data().saldo || 0;
                const newSaldo = currentSaldo + (multReverso * montoReverso);
                await adminDb.collection("accounts").doc(data.accountId).update({ saldo: newSaldo });
                results.push(`↩️ REVERSADO: $${montoReverso} en ${accountDocMatch.data().nombre}${descripcionReverso} (saldo: $${newSaldo.toFixed(2)})`);
              }
            }
            
            await adminDb.collection("transactions").doc(doc.id).delete();
            matchFound = true;
            break;
          }
        }
        
        if (!matchFound) {
          results.push(`⚠️ No encontré transacción de $${montoReverso} para revertir.`);
        }
      } else if (item.tipo === "editar") {
        const montoNuevo = Math.abs(item.monto);
        const cuentaBuscada = item.cuenta?.toLowerCase();
        
        const recentSnap = await adminDb.collection("transactions")
          .where("userId", "==", userId)
          .orderBy("timestamp", "desc")
          .limit(20)
          .get();
        
        let matchFound = false;

        for (const doc of recentSnap.docs) {
          const data = doc.data();
          const matchMonto = Math.abs(data.monto) === montoNuevo;
          const matchCuenta = !cuentaBuscada || 
            (data.accountId && accountsSnap.docs.some(a => a.id === data.accountId && a.data().nombre.toLowerCase().includes(cuentaBuscada)));
          
          if (matchMonto && matchCuenta) {
            const oldTipo = data.tipo;
            const oldMonto = Math.abs(data.monto);
            const oldAccountId = data.accountId;
            
            // 1. Revertir saldo cuenta vieja
            const multReverso = oldTipo === "gasto" ? 1 : -1;
            if (oldAccountId) {
              const oldAccountDoc = accountsSnap.docs.find(a => a.id === oldAccountId);
              if (oldAccountDoc) {
                batch.update(oldAccountDoc.ref, { saldo: admin.firestore.FieldValue.increment(multReverso * oldMonto) });
              }
            }

            // 2. Determinar nuevos valores
            const finalTipo = item.nuevoTipo || oldTipo;
            const finalCategoria = item.categoria || data.categoria;
            
            let newAccountId = oldAccountId;
            if (item.cuenta) {
               const newAccountDoc = accountsSnap.docs.find(d => 
                d.data().nombre.toLowerCase().includes(item.cuenta?.toLowerCase()) ||
                item.cuenta?.toLowerCase().includes(d.data().nombre.toLowerCase())
              );
              if (newAccountDoc) newAccountId = newAccountDoc.id;
            }

            // 3. Crear nueva transacción
            const finalDesc = data.descripcion;
            const finalMonto = montoNuevo;
            const multNuevo = finalTipo === "ingreso" ? 1 : -1;
            const timestamp = data.timestamp; 

            batch.set(adminDb.collection("transactions").doc(), {
              userId,
              monto: finalMonto,
              tipo: finalTipo,
              accountId: newAccountId,
              categoria: finalCategoria,
              descripcion: finalDesc,
              timestamp,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              fuente: "telegram_edit"
            });

            // 4. Aplicar nuevo saldo cuenta nueva
            if (newAccountId) {
              const newAccountDoc = accountsSnap.docs.find(a => a.id === newAccountId);
              if (newAccountDoc) {
                batch.update(newAccountDoc.ref, { saldo: admin.firestore.FieldValue.increment(multNuevo * finalMonto) });
              }
            }

            // 5. Eliminar old
            batch.delete(doc.ref);
            
            results.push(`✏️ EDITADO: $${oldMonto} (${oldTipo}) -> $${finalMonto} (${finalTipo}) en ${finalCategoria}`);
            matchFound = true;
            break; 
          }
        }

        if (!matchFound) {
          results.push(`⚠️ No encontré transacción de $${montoNuevo} para editar.`);
        }
      } else {
        let accountDoc = accountsSnap.docs.find(d => 
          d.data().nombre.toLowerCase().includes(item.cuenta?.toLowerCase()) ||
          item.cuenta?.toLowerCase().includes(d.data().nombre.toLowerCase())
        );
        
        // Si no se指定cuenta o no matchea, buscar "Efectivo"
        if (!accountDoc) {
           accountDoc = accountsSnap.docs.find(d => d.data().nombre.toLowerCase().includes("efectivo"));
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
        const descripcion = item.descripcion || item.categoria || userInput;
        batch.set(adminDb.collection("transactions").doc(), {
          userId, monto, tipo: item.tipo || "gasto", accountId: accountDoc.id,
          categoria: item.categoria || "Varios", descripcion: descripcion,
          timestamp, createdAt: admin.firestore.FieldValue.serverTimestamp(), fuente: "telegram"
        });
        batch.update(accountDoc.ref, { saldo: admin.firestore.FieldValue.increment(mult * monto) });
        const dateLabel = item.fecha ? `[${item.fecha}] ` : "";
        const detailLabel = item.descripcion && item.descripcion !== item.categoria ? ` - ${item.descripcion}` : "";
        results.push(`${mult > 0 ? "💰" : "💳"} ${dateLabel}$${monto} en ${item.categoria}${detailLabel} (${accountDoc.data().nombre})`);
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

    ctx.reply("✅ ¡Cuenta vinculada exitosamente!\n\nYa puedes registrar gastos directamente desde Telegram.");
  } catch (error) {
    console.error(error);
    ctx.reply("❌ Error al vincular. Intenta de nuevo.");
  }
});

bot.on("text", async (ctx) => {
  const telegramId = ctx.from.id.toString();
  try {
    const userSnap = await adminDb.collection("users").where("telegramId", "==", telegramId).limit(1).get();
    if (userSnap.empty) return ctx.reply("⚠️ Vincula tu cuenta.");
    const userData = userSnap.docs[0].data();
    if (userData.telegramState && userData.telegramState.startsWith("editing_")) {
      const pendingId = userData.telegramState.replace("editing_", "");
      await handlePendingEdit(ctx, userSnap.docs[0].id, pendingId, ctx.message.text);
      return;
    }
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
     ctx.reply("🎤 Escuchando...");
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
     
     const userData = userSnap.docs[0].data();
     if (userData.telegramState && userData.telegramState.startsWith("editing_")) {
       const pendingId = userData.telegramState.replace("editing_", "");
       await handlePendingEdit(ctx, userId, pendingId, transcription);
     } else {
       await processIncomingTransaction(ctx, userId, transcription, true);
     }
     try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
   } catch { ctx.reply("❌ Error de audio."); }
});

bot.on("photo", async (ctx) => {
  const telegramId = ctx.from.id.toString();
  try {
     const userSnap = await adminDb.collection("users").where("telegramId", "==", telegramId).limit(1).get();
     if (userSnap.empty) return ctx.reply("⚠️ Vincula tu cuenta.");
     
      const userId = userSnap.docs[0].id;
      // Telegram provee un array de resoluciones. [0] es la más pequeña (ilegible para facturas).
      // Usamos el último elemento para obtener la foto en alta resolución.
      const photo = ctx.message.photo[ctx.message.photo.length - 1]; 
      const fileId = photo.file_id;

      console.log("Processing photo, fileId:", fileId);
      ctx.reply("📸 Descargando imagen...");

      const fileLink = await bot.telegram.getFileLink(fileId);
      
      console.log("Downloading image...");
      ctx.reply("🤖 Descargando y analizando... (10-15s)");
      
      // Download image as buffer
      const imageResponse = await axios.get(fileLink.toString(), { responseType: 'arraybuffer' });
      const base64Image = Buffer.from(imageResponse.data).toString('base64');

      // Send typing action to keep the connection alive
      await ctx.sendChatAction("typing");

      console.log("Starting AI analysis with Base64...");

      let result;
      try {
        result = await analyzeReceipt(base64Image, true);
        console.log("analyzeReceipt returned:", result);
      } catch (err: any) {
        console.error("Error in analyzeReceipt:", err);
        return ctx.reply(`❌ Error al analizar la imagen: ${err.message}. Intenta de nuevo.`);
      }

      console.log("Result received:", result);
      if (!result || result.error) {
        // Show the raw response if available for debugging
        const debugMsg = result.error.includes("JSON") ? `\n\n(Debug: ${result.error})` : "";
        return ctx.reply(`❌ ${result.error}. Intenta de nuevo o describe el gasto manualmente.${debugMsg}`);
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
     ctx.reply(message, {
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
    ctx.reply("❌ Error al procesar la foto. Intenta de nuevo.");
  }
});

// Store para confirmar transacciones de facturas (en memoria)
const pendingReceipts = new Map();

bot.on("callback_query", async (ctx) => {
  const callbackData = (ctx.callbackQuery as any).data;
  if (!callbackData) return;
  
  const telegramId = ctx.from.id.toString();

  if (callbackData.startsWith("confirm_receipt_")) {
    try {
      const pendingId = callbackData.replace("confirm_receipt_", "");
      const pendingDoc = await adminDb.collection("pendingTransactions").doc(pendingId).get();
      
      if (!pendingDoc.exists) {
        return ctx.answerCbQuery("❌ Error: Los datos expiraron o no existen.");
      }
      
      const data = pendingDoc.data()!;
      
      const userSnap = await adminDb.collection("users").doc(data.userId).get();
      if (!userSnap.exists) return ctx.answerCbQuery("Error: Usuario no encontrado.");
      
      const userId = userSnap.id;
      const accountsSnap = await adminDb.collection("accounts").where("userId", "==", userId).get();
      
      if (accountsSnap.empty) {
        ctx.answerCbQuery("❌ No tienes cuentas.");
        return ctx.reply("⚠️ No tienes cuentas registradas.");
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
        descripcion: data.descripcion || "Factura",
        timestamp,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        fuente: "telegram_photo"
      });

      batch.update(accountDoc.ref, { saldo: admin.firestore.FieldValue.increment(-monto) });

      await batch.commit();
      
      // Limpiar datos temporales
      await adminDb.collection("pendingTransactions").doc(pendingId).delete();

      ctx.answerCbQuery("✅ Registrado!");
      ctx.editMessageText(`✅ *Gasto Registrado:*\n\n💰 $${monto} en ${data.categoria}\n📂 ${data.descripcion}`, { parse_mode: "Markdown" });

    } catch (error) {
      console.error("Error confirming receipt:", error);
      ctx.answerCbQuery("❌ Error al confirmar.");
    }
  } else if (callbackData.startsWith("edit_receipt_")) {
    const pendingId = callbackData.replace("edit_receipt_", "");
    const pendingDoc = await adminDb.collection("pendingTransactions").doc(pendingId).get();
    
    if (!pendingDoc.exists) return ctx.answerCbQuery("❌ Error: Expirado.");
    
    const data = pendingDoc.data()!;
    await adminDb.collection("users").doc(data.userId).update({
      telegramState: `editing_${pendingId}`
    });
    
    ctx.answerCbQuery("Modo Edición Activado");
    
    // Attempt to extract original message text safely
    const originalText = (ctx.callbackQuery as any).message?.text || "Datos previos detectados.";
    
    ctx.editMessageText(`✏️ *Modo Edición*\n\n${originalText}\n\n👉 *Escribe o envía un audio con los cambios que deseas* (ej: "Pon monto en 20" o "Cambia categoría a Transporte").`, { parse_mode: "Markdown" });

  } else if (callbackData === "cancel_receipt") {
    ctx.answerCbQuery("Cancelado");
    ctx.editMessageText("❌ Operación Cancelada.");
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
