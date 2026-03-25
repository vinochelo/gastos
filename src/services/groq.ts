import Groq from "groq-sdk";
import fs from "fs";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function transcribeAudio(filePath: string) {
  const transcription = await groq.audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model: "whisper-large-v3",
    language: "es",
    response_format: "json",
  });
  return transcription.text;
}

export async function parseTransaction(text: string, accountNames: string[], userExpCats?: string[], userIncCats?: string[]) {
  const expCats = userExpCats?.length ? userExpCats : ["Casa", "Cine", "Comida", "Compras Ecommerce", "Comunicaciones", "Deportes", "Costos Bancarios", "Desayunos", "Restaurantes", "Entretenimiento", "Higiene", "IVA Electronico", "Juegos", "Mascotas", "Regalos", "Ropa", "Salud", "Servicios Basicos", "Streaming", "Taxi/Uber", "Transporte"];
  const incCats = userIncCats?.length ? userIncCats : ["Salario", "Inversion", "Regalo", "Otro"];
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const prompt = `
Eres un asistente contable experto en español latinoamericano. Fecha actual: ${dateStr}.
El usuario te envía un mensaje sobre sus finanzas personales. Tu trabajo es entender QUÉ QUIERE HACER y extraer los datos.

**COMPRENSIÓN AMPLIADA:**
- Reconoce variaciones comunes: "gasté", "gaste", "pagué", "pague", "pago", "coloqué", "metí", "invertí"
- Reconoce expresiones informales: "me compré", "saqué", "mandé", "le di"
- Si el usuario escribe solo un monto como "50" o "$50", asume que es un gasto
- Si dice "ingresé" o "recibí" seguido de monto, asume que es un ingreso
- Detecta negaciones y correcciones: "no fue" "no era" "era otra cosa" "no lo hice"
- Si dice "gracias", "hola", "buenas" - solo saluda, no proceses

**CAPACIDADES:**
1. **REGISTRAR GASTO**: "gasté 50 en almuerzo", "pagué 20 de taxi", "me compré algo de 100"
   - Detecta montos: números solos, con $, con "pesos", decimales opcional
   
2. **REGISTRAR INGRESO**: "recibí 500 de salario", "ingresé 1000", "me entró un pago de 200"
   - Detecta palabras como: "recibí", "ingresé", "me entró", "me llegó", "entró"
   
3. **REGISTRAR TRANSFERENCIA**: "transferí 200 de mi cuenta al banco", "mover 500 de banco a efectivo"

  4. **REVERTIR/CANCELAR**: "borra eso", "no, era 100 no 200", "cancela el gasto", "elimina eso"
    - Si detecta arrepentimiento o corrección, marca como "reverso"

  5. **RECLASIFICAR**: "era comida no cine", "me equivoqué era transporte", "pasa eso a juegos"
    - Detecta que quiere cambiar categoría de algo ya registrado

  6. **EDITAR TRANSACCIÓN**: "cambia eso", "modifica el monto a 50", "era 100 no 200", "cámbialo a ingreso", "cambia la cuenta a banco"
    - Usa "editar" cuando el usuario quiere cambiar algo de la última transacción sin borrarla completamente.
    - Si dice "era X no Y" (ej: "era 100 no 200"), implica que hubo un error en el monto anterior y quiere cambiarlo.
    - Puede cambiar: monto, categoría, tipo (gasto/ingreso), cuenta.

6. **CONSULTAR SALDO**: "cuánto tengo", "mi saldo", "cuánto hay en la cuenta", "balances"
   - Si menciona cuenta específica: "cuánto hay en efectivo"

  7. **CONSULTAR GASTOS**: "cuánto gasté esta semana", "qué gasté en comer", "mis gastos del mes"

  8. **ENLACE WEB**: Si el usuario pide el link, url, página web, aplicación o cómo acceder, responde con tipo "enlace_web"

**CATEGORÍAS DEL USUARIO:**
Gastos: ${expCats.join(", ")}
Ingresos: ${incCats.join(", ")}

**CUENTAS DISPONIBLES:**
${accountNames.join(", ")}

**REGLAS DE MONTO:**
- "centavos", "ctvs", "céntimos" = dividir entre 100 (ej: "35 centavos" = 0.35)
- "uno", "una" = 1; "dos" = 2; etc.
- "$50", "50 pesos", "50" = 50
- Si hay varios montos separados por "más", "y", "+", crea un item por cada uno
- Si dice "pasajes", "pasaje", "pasaje de bus", "pasaje del bus" → categoría "Transporte"

**ENLACE A LA APLICACIÓN WEB:**
https://gastos-delta-pearl.vercel.app/

**INSTRUCCIONES DE RESPUESTA:**
Responde SOLO con JSON válido, sin explicaciones.
Estructura exacta:
{
  "items": [
    {
      "tipo": "gasto" | "ingreso" | "transferencia" | "reverso" | "reclasificar" | "editar" | "consulta_saldo" | "consulta_gasto_categoria" | "ayuda" | "enlace_web",
      "monto": número (OBLIGATORIO para gasto/ingreso/transferencia/reverso/editar, usa decimales con punto: 0.35),
      "categoria": "categoría detectada del usuario o común (opcional en editar si no se especifica)",
      "cuenta": "nombre de la cuenta donde se hizo (usa la primera si hay varias, o 'Efectivo' por defecto)",
      "descripcion": "descripción o lo que escribió el usuario",
      "fecha": "YYYY-MM-DD (solo si menciona fecha específica, si no omite el campo)",
      "nuevoTipo": "gasto | ingreso (SOLO para tipo 'editar', si el usuario quiere cambiar el tipo de la transacción)"
    }
  ]
}

Si detecta varios gastos en un mensaje, crea un item separado para cada uno.

Si el mensaje es solo un saludo o no puedes entender qué quiere hacer, devuelve:
{"items": [{"tipo": "ayuda", "monto": 0}]}

**MENSAJE DEL USUARIO:**
"${text}"
`;

  const completion = await groq.chat.completions.create({
    messages: [
      { role: "system", content: "Eres un parser de intenciones financieras. Solo devuelves JSON puro y válido." },
      { role: "user", content: prompt }
    ],
    model: "llama-3.3-70b-versatile",
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  try {
    return JSON.parse(completion.choices[0].message.content || '{"items": []}');
  } catch {
    return { items: [] };
  }
}

export function getHelpMessage(): string {
  return `🤖 *Puedo ayudarte con:*

 📝 *Registrar gastos:*
"gasté 50 en comida"
"pagué 20 de taxi"

 💰 *Registrar ingresos:*
"recibí 500 de salario"
"ingresé 1000"

 💼 *Ver saldos:*
"mi saldo"
"cuánto tengo"

 📊 *Gastos por categoría:*
"cuánto gasté en transporte"
"mis gastos del mes"

 ❌ *Eliminar transacciones:*
"borra el gasto de 100"

 📅 *Con fecha específica:*
"ayer gasté 30"
"el lunes pagué 50"

 🌐 *Acceder a la web:*
"dame el link" | "cómo entro a la app" | "la página web"

 📸 *Escanear facturas:*
"Envía una foto de tu ticket o factura y la analizaré automáticamente."

¡Escríbeme cualquier cosa y haré mi mejor esfuerzo!`;
}
