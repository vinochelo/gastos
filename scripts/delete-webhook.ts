/**
 * delete-webhook.ts
 * Elimina el webhook de Telegram (útil para resetear)
 */
import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error("❌ TELEGRAM_BOT_TOKEN no encontrado en .env.local");
  process.exit(1);
}

const bot = new Telegraf(token);

async function deleteWebhook() {
  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    console.log("✅ Webhook eliminado correctamente.");

    const info = await bot.telegram.getWebhookInfo();
    console.log("📊 Estado actual:", info);
  } catch (error) {
    console.error("❌ Error eliminando webhook:", error);
  }
}

deleteWebhook();
