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
- **Retención del Contexto de Centavos**: Si el usuario menciona "centavos" (o ctvs) en un gasto dentro de una lista o secuencia (ej: "gasté 25 centavos en el bus luego 45 y luego 35"), asume que los montos subsiguientes en la misma frase u oración que no tengan unidad explícita también se refieren a centavos (dividir entre 100: 0.25, 0.45, 0.35) a menos que cambie de contexto explícitamente (ej: "y luego 5 dólares").
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
      "monto": número (monto nuevo o detectado, usa decimales con punto: 0.35),
      "montoAnterior": número (monto incorrecto anterior que se está corrigiendo o editando, ej: "era 50 no 70" -> monto: 50, montoAnterior: 70),
      "categoria": "categoría nueva o detectada",
      "categoriaAnterior": "categoría incorrecta anterior que se quiere cambiar (ej: 'era comida no cine' -> categoria: 'Comida', categoriaAnterior: 'Cine')",
      "cuenta": "nombre de la cuenta nueva o detectada",
      "cuentaAnterior": "nombre de la cuenta incorrecta anterior que se quiere cambiar (ej: 'era efectivo no banco' -> cuenta: 'Efectivo', cuentaAnterior: 'Cuenta Bancaria')",
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

export async function editPendingWithAI(oldData: any, userInput: string, userExpCats?: string[], userIncCats?: string[]) {
  const systemPrompt = `Eres un asistente AI financiero. 
Tu única tarea es aplicar las modificaciones pedidas por el usuario sobre un JSON existente.
Modifica los valores o categorías según la orden, respetando los datos originales que NO pide cambiar.

Variables permitidas:
Categorías de gasto: ${(userExpCats || []).join(", ")}
Categorías de ingreso: ${(userIncCats || []).join(", ")}

JSON ACTUAL a editar:
${JSON.stringify(oldData, null, 2)}

INSTRUCCIÓN: "${userInput}"

DEVUELVE ÚNICAMENTE EL NUEVO JSON MODIFICADO. NO incluyas saludos ni explicaciones extras, SOLO EL JSON VÁLIDO.`;

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "system", content: systemPrompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
    });
    
    let content = chatCompletion.choices[0]?.message?.content || "";
    content = content.replace(/```json\n?|\n?```/g, "").trim();
    
    return JSON.parse(content);
  } catch (error) {
    console.error("Error editing pending transaction:", error);
    return oldData;
  }
}
