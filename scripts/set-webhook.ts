import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const token = process.env.TELEGRAM_BOT_TOKEN;
const url = process.env.WEBHOOK_URL;

if (!token || !url) {
  console.error("Error: Se requiere TELEGRAM_BOT_TOKEN y WEBHOOK_URL en .env.local");
  process.exit(1);
}

const bot = new Telegraf(token);

async function setWebhook() {
  try {
    console.log(`Configurando webhook a: ${url}`);
    await bot.telegram.setWebhook(url!);
    console.log("¡Webhook configurado correctamente! ✅");
  } catch (error) {
    console.error("Error al configurar el webhook:", error);
  }
}

setWebhook();
