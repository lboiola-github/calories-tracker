import "server-only";
import { groqRequestBody, sanitizeInterpretation, type Interpretation } from "./parse";

// GROQ_BASE_URL solo se cambia en pruebas e2e (servidor simulado).
const base = () => process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";

export class InterpretError extends Error {
  constructor(
    message: string,
    readonly kind: "not_configured" | "rate_limited" | "unavailable" | "bad_response",
  ) {
    super(message);
  }
}

export const isAiConfigured = () => Boolean(process.env.GROQ_API_KEY);

/** Pide al modelo que separe el texto en ítems. La clave queda en el servidor. */
export async function interpretText(text: string, fetchImpl: typeof fetch = fetch): Promise<Interpretation> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new InterpretError("La interpretación automática no está configurada.", "not_configured");
  let res: Response;
  try {
    res = await fetchImpl(`${base()}/chat/completions`, {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify(groqRequestBody(text)),
    });
  } catch {
    throw new InterpretError("La interpretación no respondió. Podés cargarlo a mano.", "unavailable");
  }
  if (res.status === 429) throw new InterpretError("Se alcanzó el límite gratuito de interpretación. Probá en un rato o cargalo a mano.", "rate_limited");
  if (!res.ok) throw new InterpretError("La interpretación no está disponible ahora. Podés cargarlo a mano.", "unavailable");
  try {
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return sanitizeInterpretation(JSON.parse(data.choices?.[0]?.message?.content ?? ""), text);
  } catch {
    throw new InterpretError("No se pudo entender la respuesta. Probá de nuevo o cargalo a mano.", "bad_response");
  }
}
