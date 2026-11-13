export async function analyzeReceipt(imageData: string, isBase64 = false) {
  const systemPrompt = `Eres un asistente de OCR experto en finanzas. 
Tu única tarea es analizar la imagen de una factura/ticket y extraer los siguientes datos.
RESPONDE EXCLUSIVAMENTE CON UN OBJETO JSON VÁLIDO. NO incluyas saludos, explicaciones, markdown ni ningún otro texto fuera del JSON.
Estructura JSON estricta y esperada:
{
  "monto": número (total numérico exacto de la factura, sin símbolos de moneda),
  "categoria": "categoría detectada" (elige una: Restaurantes, Comida, Supermercado, Transporte, Salud, Ropa, Hogar, Educación, Ocio, Otro),
  "descripcion": "nombre del establecimiento o descripción muy corta",
  "fecha": "YYYY-MM-DD" (si se ve la fecha, si no usa la actual)
}
Si no logras deducir nada, devuelve {"error": "No se pudo leer"}.`;

  const userPrompt = "Analiza la imagen adjunta y devuelve ÚNICAMENTE el JSON requerido, sin añadir nada más.";

  try {
    const imageUrl = isBase64 
      ? `data:image/jpeg;base64,${imageData}`
      : imageData;

    const body = {
      models: [
        "google/gemma-4-31b-it:free",
        "google/gemma-4-26b-a4b-it:free",
        "nvidia/nemotron-3.5-super-vl:free"
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
      max_tokens: 2048
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
      try {
        return JSON.parse(cleanedContent);
      } catch {
        const start = cleanedContent.indexOf("{");
        const end = cleanedContent.lastIndexOf("}");
        if (start !== -1 && end > start) {
          return JSON.parse(cleanedContent.slice(start, end + 1));
        }
        throw new Error("Invalid JSON");
      }
    } catch {
      return { error: "Formato de respuesta inválido.", raw: content };
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("OpenRouter Fetch API Error:", message);
    return { error: message };
  }
}
