import axios from 'axios';

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
    const imageUrl = isBase64 
      ? `data:image/jpeg;base64,${imageData}`
      : imageData;

    const body = {
      models: [
        "nvidia/nemotron-nano-12b-v2-vl:free",
        "mistralai/mistral-small-3.1-24b-instruct:free",
        "google/gemma-3-12b-it:free",
        "google/gemma-3-4b-it:free",
        "google/gemma-3-27b-it:free"
      ],
      route: "fallback",
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
    };

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://gastos-delta-pearl.vercel.app",
        "X-OpenRouter-Title": "Control de Gastos"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter HTTP Error:", response.status, errorText);
      return { error: `HTTP ${response.status}: ${errorText}` };
    }

    const completion = await response.json();
    const content = completion.choices?.[0]?.message?.content || "";
    
    try {
      const cleanedContent = content.replace(/```json\n?|\n?```/g, "").trim();
      return JSON.parse(cleanedContent);
    } catch {
      return { error: "Formato de respuesta inválido.", raw: content };
    }
  } catch (error: any) {
    console.error("OpenRouter Fetch API Error:", error.message);
    return { error: error.message };
  }
}
