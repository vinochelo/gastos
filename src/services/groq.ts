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

  6. **EDITAR TRANSACCIÓN**: "cambia eso", "modifica el monto a 50", "era 100 no 200", "cámbialo a ingreso", "cambia la cuenta a banco", "el ultimo pago fue con produbanco"
    - Usa "editar" cuando el usuario quiere cambiar algo de la última transacción sin borrarla completamente.
    - Si dice "era X no Y" (ej: "era 100 no 200", "era produbanco no efectivo"), implica que hubo un error y quiere cambiarlo.
    - Ejemplos de cambio de cuenta: "el ultimo pago fue con produbanco" -> tipo: "editar", cuenta: "Produbanco"; "paga con banco" -> tipo: "editar", cuenta: "Banco"; "cambia la cuenta a efectivo" -> tipo: "editar", cuenta: "Efectivo".
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
      "descripcion": "concepto limpio de la transacción en singular (ej: 'pan', 'taxi', 'almuerzo', 'salario'), excluyendo palabras de acción como 'añade', 'gasté', 'pagué', 'ingresa', 'un dólar', 'pesos' o similares",
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
  return `🤖 *¡Hola! Soy tu asistente contable y financiero (GESTOR.AI).* 

Puedes enviarme notas de voz, fotos de facturas o texto. Aquí tienes los comandos que entiendo:

💰 *REGISTROS RÁPIDOS:*
• *Gastos:* "gasté 50 en comida", "pagué 20 de taxi", "12.50 pasaje de bus"
• *Ingresos:* "recibí 500 de salario", "ingresé 100"
• *Con fecha:* "ayer gasté 30 en ropa", "el lunes pagué 15 de almuerzo"

💸 *TRANSFERENCIAS ENTRE CUENTAS:*
• "transferí 50 de efectivo a produbanco"
• "mueve 100 de guayaquil a peigo"

🔄 *RECLASIFICAR Y EDITAR (Última Transacción):*
• *Cambiar categoría:* "era comida no cine", "pásalo a juguetes"
• *Cambiar monto:* "cambia el monto a 60", "era 10 no 20"
• *Cambiar cuenta:* "fue con tarjeta no efectivo", "pagado con produbanco"
• *Cambiar tipo:* "cámbialo a ingreso"

❌ *ELIMINAR / DESHACER:*
• "borra eso", "cancela el último gasto", "elimina la última transacción"

💼 *CONSULTAS Y REPORTES:*
• *Saldos de cuentas:* "mi saldo", "cuánto tengo en efectivo", "balances"
• *Gastos generales del mes:* "mis gastos", "cuánto he gastado este mes", "gastos del mes"
• *Gastos por categoría:* "cuánto gasté en comida", "gastos de viaje este mes", "qué gasté en taxi"

🧠 *ASESORÍA IA (GESTOR.AI):*
• "analiza mis finanzas", "dame consejos", "recomiéndame qué hacer"

📸 *FACTURAS:*
• Envía una foto de tu ticket o factura y la procesaré automáticamente.

🌐 *APLICACIÓN WEB:*
• Escribe "link" o "web" para obtener el enlace de acceso directo.`;
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

export async function generateFinancialAnalysis(
  incomeTotal: number,
  expenseTotal: number,
  balances: { nombre: string; saldo: number }[],
  categoryExpenses: Record<string, number>,
  userName: string = "Usuario",
  recentTransactions: { tipo: string; monto: number; categoria: string; descripcion?: string }[] = [],
  targetMonth?: number,
  targetYear?: number
): Promise<string> {
  try {
    const targetDate = (targetMonth !== undefined && targetYear !== undefined)
      ? new Date(targetYear, targetMonth, 1)
      : new Date();
    const dateStr = targetDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    const currentDateStr = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const currentDay = new Date().getDate();
    
    const isCurrentMonth = (targetDate.getMonth() === new Date().getMonth() && targetDate.getFullYear() === new Date().getFullYear());

    const balanceText = (balances || []).map(b => `${b.nombre}: $${Number(b.saldo || 0).toFixed(2)}`).join("\n");
    const categoryText = Object.entries(categoryExpenses || {})
      .map(([cat, val]) => `- ${cat}: $${Number(val || 0).toFixed(2)}`)
      .join("\n");

    const txListText = (recentTransactions || [])
      .map(t => `- [${t.tipo.toUpperCase()}] ${t.categoria}: $${Number(t.monto).toFixed(2)}${t.descripcion ? ` (${t.descripcion})` : ""}`)
      .join("\n");

    const progressContext = isCurrentMonth
      ? `*NOTA TEMPORAL IMPORTANTE*: Dado que estamos a mediados de mes (Día ${currentDay}), advierte claramente al usuario que el balance positivo actual no es un ahorro consolidado final de mes, sino el presupuesto/superávit temporal disponible para afrontar los gastos del resto de días del mes. Aconséjale administrar con cautela este saldo positivo.`
      : `*NOTA HISTÓRICA*: Este mes de ${dateStr} ya finalizó por completo. Evalúa el rendimiento financiero y el balance final de forma definitiva y consolidada para todo el período mensual transcurrido.`;

    const prompt = `
Eres un asesor financiero personal experto en finanzas personales para latinoamérica, llamado GESTOR.AI.
Analiza la situación financiera de ${userName} para el mes de ${dateStr} con los siguientes datos reales:

**DATOS TEMPORALES:**
- Fecha de hoy: ${currentDateStr} (Día ${currentDay} del mes)
- Mes bajo análisis: ${dateStr}

**DATOS FINANCIEROS:**
- Ingresos Totales de este mes: $${Number(incomeTotal || 0).toFixed(2)}
- Gastos Totales de este mes: $${Number(expenseTotal || 0).toFixed(2)}
- Balances actuales en Cuentas:
${balanceText}

**DESGLOSE DE GASTOS POR CATEGORÍA:**
${categoryText || "No hay gastos registrados este mes."}

**LISTADO DETALLADO DE TRANSACCIONES DEL MES (Analiza las descripciones/notas para mayor contexto):**
${txListText || "No hay transacciones registradas este mes."}

**INSTRUCCIONES PARA TU ANÁLISIS:**
1. **Tono**: Empático, profesional, motivador y claro. Evita tecnicismos innecesarios.
2. **Estructura Recomendada**:
   - **Resumen del Estado de Salud Financiera**: ¿Cómo se ve su mes? (¿Está ahorrando, al límite, o gastando de más?). Calcula su tasa de ahorro.
     ${progressContext}
   - **Categorías de Alerta**: Identifica la categoría donde más ha gastado. **Lee el listado detallado de transacciones y sus descripciones** para entender de qué se trata exactamente y evaluar si es justificable o preocupante (por ejemplo, si la categoría es el nombre de una persona pero la descripción aclara que es la cuota de la universidad o matrícula, reconócelo como un gasto educativo o inversión esencial).
   - **Recomendaciones Prácticas**: Consejos específicos, detallados y realistas para reducir gastos en sus categorías críticas, mejorar sus cuentas o presupuestar mejor. Explica el porqué y cómo aplicar cada consejo.
   - **Frase Corta Motivadora**: Una línea corta al final que inspire control financiero.
3. **Criterio de Gastos Fijos vs. Variables (Crítico)**:
   - Categorías como "Educación", "Universidad", "Estudios", "Diezmos" o "Arriendo/Casa" son inversiones esenciales o compromisos fijos. **NO debes sugerir recortarlos, eliminarlos ni cuestionar si son necesarios**. Concentra tus recomendaciones de ahorro exclusivamente en gastos hormiga, gastos variables o de consumo discrecional (comidas fuera, entretenimiento, compras no esenciales).
4. **Criterio de Ahorros**:
   - Las cuentas que contengan la palabra "Ahorro" o "Ahorros" en su nombre son fondos reservados de ahorro. **NO debes sumarlos como dinero disponible para gasto diario**, sino valorarlos como un capital acumulado de protección.
5. **Formato**: Usa formato Markdown limpio y profesional (negritas, listas con viñetas, bloques de cita). No incluyas intros innecesarios de chat como "Aquí tienes tu análisis". Ve directo al grano.
6. **Sin Restricciones de Longitud**: No limites artificialmente tus respuestas ni la cantidad de explicaciones. Ofrece un análisis profundo, completo, claro y verdaderamente útil para las finanzas del usuario.

Genera el análisis financiero:
`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: "Eres un asesor financiero inteligente experto en finanzas personales. Devuelves respuestas directas en Markdown." },
        { role: "user", content: prompt }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 1500
    });

    return chatCompletion.choices[0]?.message?.content || "No se pudo generar el análisis en este momento.";
  } catch (error) {
    console.error("Error generating financial analysis:", error);
    return "Error al generar el análisis financiero. Verifica la conexión con la IA.";
  }
}

