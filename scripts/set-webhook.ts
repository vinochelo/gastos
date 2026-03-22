import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const token = process.env.TELEGRAM_BOT_TOKEN;
const argUrl = process.argv[2];
const url = argUrl || process.env.WEBHOOK_URL;

if (!token || !url) {
  console.error("Error: Se requiere TELEGRAM_BOT_TOKEN. Proporciona la URL como argumento: npm run set-webhook https://mi-app.vercel.app/api/webhook");
  process.exit(1);
}

// Asegurar que la URL termine en /api/webhook si no está presente
const finalUrl = url.endsWith('/api/webhook') ? url : `${url.replace(/\/$/, '')}/api/webhook`;

const bot = new Telegraf(token);

async function setWebhook() {
  try {
    console.log(`🚀 Configurando webhook en: ${finalUrl}`);
    const success = await bot.telegram.setWebhook(finalUrl);
    if (success) {
      console.log("✅ ¡Bot vinculado correctamente a Vercel!");
    } else {
      console.log("❌ Error al configurar el webhook.");
    }
  } catch (error) {
    console.error("❌ Fallo crítico:", error);
  }
}

setWebhook();
