import Groq from "groq-sdk";
import fs from "fs";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const DEFAULT_EXPENSES = ["Comida", "Transporte", "Hogar", "Ocio", "Salud", "Educación", "Tecnología", "Ropa", "Regalos", "Mascotas", "Viajes", "Deudas", "Otros", "Golosinas", "Víveres", "Juegos", "Juguetes"];
const DEFAULT_INCOMES = ["Salario", "Venta", "Inversión", "Regalo", "Otros Ingresos"];

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
  const expCats = userExpCats || DEFAULT_EXPENSES;
  const incCats = userIncCats || DEFAULT_INCOMES;
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const prompt = `
    Eres un asistente contable experto. Fecha actual: ${dateStr}.
    Tu tarea es extraer información financiera de un texto en español.
    
    CAPACIDADES:
    1. Registrar transacciones (gasto, ingreso, transferencia).
    2. RECLASIFICAR: Si el usuario quiere cambiar la categoría de algo ya registrado. Ej: "Pasa los 4.5 de juegos a juguetes".
    3. FECHAS: Interpreta si fue "hoy", "ayer", "el lunes pasado", "hace 3 días", etc., y calcula la fecha exacta basándote en que hoy es ${dateStr}.

    REGLAS DE CLASIFICACIÓN:
    - "Golosinas": Pastel, dulces, snacks.
    - "Víveres": Alimentos básicos, súper.
    
    TEXTO: "${text}"
    CUENTAS DISPONIBLES: ${accountNames.join(", ")}
    CATEGORÍAS DE GASTO: ${expCats.join(", ")}
    CATEGORÍAS DE INGRESO: ${incCats.join(", ")}
    
    Responde ÚNICAMENTE con un JSON con la estructura:
    {
      "items": [
        {
          "monto": number,
          "categoria": string (nueva categoría o categoría del gasto),
          "categoriaAnterior": string (solo para reclasificar),
          "cuenta": string,
          "fromCuenta": string,
          "toCuenta": string,
          "descripcion": string,
          "tipo": "gasto" | "ingreso" | "transferencia" | "reclasificar",
          "fecha": "YYYY-MM-DD" (calculada según el texto, defecto hoy)
        }
      ]
    }
  `;

  const completion = await groq.chat.completions.create({
    messages: [
      { role: "system", content: "Analista financiero preciso. Siempre respondes con JSON puro (un objeto con 'items')." },
      { role: "user", content: prompt }
    ],
    model: "llama-3.3-70b-versatile",
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  return JSON.parse(completion.choices[0].message.content || '{"items": []}');
}
