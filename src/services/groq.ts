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
- Reconoce variaciones comunes: "gasté", "gaste", "pagué", "pague", "pago", "coloqué", "coloqué", "invertí", "metí"
- Reconoce expresiones informales: "me compré", "me compré", "saqué", "saque", "echen", "eche", "mandé", "mande"
- Si el usuario escribe solo un monto como "50" o "$50", asum[e que es un gasto
- Si dice "ingresé" o "recibí" seguido de monto, asum[e que es un ingreso
- Detecta negaciones: "no fue" "no era" "no lo hice" - puede ser que quiera revertir algo

**CAPACIDADES:**
1. **REGISTRAR GASTO**: "gasté 50 en almuerzo", "pagué 20 de taxi", "me compré algo de 100"
   - Detecta montos: números solos, con $, con "pesos", decimales opcional
   - Detecta categoría: lo que sigue después de "en", "de", "para"
   
2. **REGISTRAR INGRESO**: "recibí 500 de salaryo", "ingresé 1000", "me entró un pago de 200"
   - Detecta palabras como: "recibí", "ingresé", "me entró", "me llegó", "entró", "caí", "cae"
   
3. **REGISTRAR TRANSFERENCIA**: "transferí 200 de mi cuenta al banco", "mover 500 de banco a efectivo"

4. **REVERTIR/CANCELAR**: "borra eso", "no, era 100 no 200", "cancela el gasto", "elimina eso", "no era gasto"
   - Si detecta arrepentimiento o corrección, marca como "reverso"
   - Si dice monto específico: "borra el de 50"

5. **RECLASIFICAR**: "era comida no cine", "me equivoqué era transporte", "pasa eso a juegos"
   - Detecta que quiere cambiar categoría de algo ya registrado

6. **CONSULTAR SALDO**: "cuánto tengo", "mi saldo", "cuánto hay en la cuenta", "balances", "qué tal"
   - Si menciona cuenta específica: "cuánto hay en efectivo"

7. **CONSULTAR GASTOS**: "cuánto gasté esta semana", "qué gasté en comer", "mis gastos del mes"
   - Detecta períodos: "esta semana", "este mes", "hoy", "ayer", "la semana pasada"

**CATEGORÍAS DEL USUARIO:**
Gastos: ${expCats.join(", ")}
Ingresos: ${incCats.join(", ")}

**CUENTAS DISPONIBLES:**
${accountNames.join(", ")}

**INSTRUCCIONES DE RESPUESTA:**
Responde SOLO con JSON válido, sin explicaciones adicionales.
El JSON debe tener esta estructura exacta:
{
  "items": [
    {
      "tipo": "gasto" | "ingreso" | "transferencia" | "reverso" | "reclasificar" | "consulta_saldo" | "consulta_gasto_categoria",
      "monto": número (obligatorio para gasto/ingreso/transferencia/reverso),
      "categoria": "categoría detectada" (obligatorio para gastos),
      "cuenta": "cuenta donde se hizo" (opcional, detecta si se menciona),
      "descripcion": "descripción o lo que escribió el usuario" (opcional),
      "fecha": "YYYY-MM-DD" (calculada si menciona "hoy", "ayer", etc., si no pone "hoy")
    }
  ]
}

Si no puedes entender qué quiere hacer, devuelve {"items": []} con items vacío.
Si es solo una pregunta/saludo que no implica acción, devuelve {"items": []}.

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
