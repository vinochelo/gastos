/**
 * start-dev.ts
 * Inicia el servidor de desarrollo de Next.js y configura el webhook de Telegram
 * usando ngrok para exponer el servidor local a internet.
 */

import { spawn } from "child_process";
import https from "https";
import http from "http";

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PORT = 3000;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function httpsPost(url: string, body: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
    };
    const req = https.request(options, (res) => {
      let raw = "";
      res.on("data", (chunk) => (raw += chunk));
      res.on("end", () => {
         try { resolve(JSON.parse(raw)); } catch(e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function httpsGet(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let raw = "";
      res.on("data", (chunk) => (raw += chunk));
      res.on("end", () => {
         try { resolve(JSON.parse(raw)); } catch(e) { reject(e); }
      });
    }).on("error", reject);
  });
}

/** Obtiene el URL público del túnel ngrok vía su API local */
async function getNgrokUrl(): Promise<string | null> {
  return new Promise((resolve) => {
    http.get("http://localhost:4040/api/tunnels", (res) => {
      let raw = "";
      res.on("data", (chunk) => (raw += chunk));
      res.on("end", () => {
        try {
          const data = JSON.parse(raw);
          const tunnel = data.tunnels?.find((t: any) => t.proto === "https");
          resolve(tunnel?.public_url || null);
        } catch {
          resolve(null);
        }
      });
    }).on("error", () => resolve(null));
  });
}

async function setWebhook(tunnelUrl: string) {
  return httpsPost(
    `https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook`,
    { url: `${tunnelUrl}/api/webhook` }
  );
}

async function getWebhookInfo() {
  return httpsGet(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getWebhookInfo`);
}

async function main() {
  if (!TELEGRAM_TOKEN) {
    console.error("❌ TELEGRAM_BOT_TOKEN no está configurado en .env.local");
    process.exit(1);
  }

  console.log("🚀 Iniciando servidor Next.js...");
  const nextProcess = spawn("npx", ["next", "dev", "--port", String(PORT)], {
    stdio: "inherit",
    shell: true,
  });

  console.log("⏳ Esperando que Next.js esté listo...");
  await sleep(5000);

  console.log("\n🌐 Iniciando túnel con ngrok (npx)...");
  // npx ngrok http PORT --log=stdout
  const ngrokProcess = spawn("npx", ["ngrok", "http", String(PORT)], {
    shell: true,
    stdio: "inherit",
  });

  // Esperar a que ngrok arranque
  await sleep(3000);

  // Intentar obtener el URL de ngrok con reintentos
  let tunnelUrl: string | null = null;
  for (let i = 0; i < 15; i++) {
    tunnelUrl = await getNgrokUrl();
    if (tunnelUrl) break;
    process.stdout.write(`⏳ Esperando ngrok (${i + 1}/15)...\r`);
    await sleep(2000);
  }

  if (!tunnelUrl) {
    console.error("\n❌ No se pudo obtener el URL de ngrok.");
    console.error("   Verifica que tienes ngrok autenticado: npx ngrok config add-authtoken <TU_TOKEN>");
    nextProcess.kill();
    ngrokProcess.kill();
    process.exit(1);
  }

  console.log(`\n✅ Túnel ngrok activo: ${tunnelUrl}`);
  console.log(`📡 Webhook URL: ${tunnelUrl}/api/webhook`);

  console.log("\n⚙️ Registrando webhook en Telegram...");
  const result = await setWebhook(tunnelUrl);

  if (result.ok) {
    console.log("✅ ¡Webhook configurado en Telegram correctamente!");
  } else {
    console.error("❌ Error configurando webhook:", result.description);
  }

  const info = await getWebhookInfo();
  console.log("\n📊 Estado del Webhook:");
  console.log(`   URL: ${info.result?.url}`);
  console.log(`   Pendientes: ${info.result?.pending_update_count}`);
  if (info.result?.last_error_message) {
    console.log(`   ⚠️ Último error: ${info.result.last_error_message}`);
  } else {
    console.log("   ✅ Sin errores recientes");
  }

  console.log("\n🤖 Bot listo para recibir mensajes de Telegram!");
  console.log(`🌐 Panel local: http://localhost:4040`);
  console.log(`🌐 App local:   http://localhost:${PORT}\n`);

  process.on("SIGINT", () => {
    console.log("\n👋 Cerrando...");
    nextProcess.kill();
    ngrokProcess.kill();
    process.exit(0);
  });
}

main().catch(console.error);
