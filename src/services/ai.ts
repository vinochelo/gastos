import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "https://gastos-delta-pearl.vercel.app", // Optional
    "X-OpenRouter-Title": "Control de Gastos", // Optional
  },
});

export async function analyzeReceipt(imageData: string, isBase64 = false) {
  const systemPrompt = `Eres un asistente de OCR experto en finanzas. 
Tu tarea es analizar la imagen de una factura/ticket y extraer: monto, categoria, descripcion y fecha.
Responde ÚNICAMENTE en formato JSON válido.
Estructura esperada:
{
  "monto": número (total de la factura),
  "categoria": "categoría detectada" (ej: Restaurantes, Comida, Supermercado, Transporte, etc.),
  "descripcion": "nombre del establecimiento o descripción corta",
  "fecha": "YYYY-MM-DD" (si se ve la fecha, si no, usa la actual)
}
Si no puedes leer NADA, devuelve {"error": "No se pudo leer la factura"}.
Si ves datos parciales, haz tu mejor esfuerzo por completar el JSON.`;

  const userPrompt = "Analiza esta imagen y extrae los datos en JSON.";

  try {
    const modelOptions = [
      "google/gemma-3-12b-it:free",
      "mistralai/mistral-small-24b-instruct-2501:free"
    ];
    
    // Usaremos Gemma 3 12B por defecto ya que es excelente en visión
    const selectedModel = modelOptions[0];

    console.log(`Calling OpenRouter API with model ${selectedModel} (Vision)`);

    const imageUrl = isBase64 
      ? `data:image/jpeg;base64,${imageData}`
      : imageData;

    const completionPromise = openai.chat.completions.create({
      model: selectedModel,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageUrl } },
            { type: "text", text: userPrompt }
          ]
        }
      ],
      temperature: 0.1,
      max_tokens: 512
    });

    const timeoutPromise = new Promise<any>((_, reject) => 
      setTimeout(() => reject(new Error("Timeout: OpenRouter API took too long (60s)")), 60000)
    );

    const completion: any = await Promise.race([completionPromise, timeoutPromise]);

    const content = completion.choices[0].message.content || "";
    
    try {
      // Intentar limpiar markdown como ```json ... ```
      const cleanedContent = content.replace(/```json\n?|\n?```/g, "").trim();
      return JSON.parse(cleanedContent);
    } catch {
      // Si falla el parseo, devolvemos el contenido puro o error
      return { error: "Formato de respuesta inválido.", raw: content };
    }
  } catch (error: any) {
    console.error("OpenRouter API Error:", error.message);
    return { error: error.message };
  }
}
