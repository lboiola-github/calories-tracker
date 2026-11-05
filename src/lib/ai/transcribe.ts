import "server-only";
import { InterpretError } from "./groq";

// GROQ_BASE_URL solo se cambia en pruebas e2e (servidor simulado).
const base = () => process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
export const WHISPER_MODEL = "whisper-large-v3-turbo";

// Vocabulario que ayuda a Whisper con comidas y medidas habituales en Argentina.
const PROMPT = "Almorcé 230 gramos de pechuga de pollo, dos tostadas, media taza de arroz, una medialuna, un alfajor, milanesa con puré, mate.";

/** Transcribe audio en español con Whisper (Groq). La clave queda en el servidor. */
export async function transcribeAudio(audio: Blob, filename: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new InterpretError("La transcripción no está configurada.", "not_configured");
  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", WHISPER_MODEL);
  form.append("language", "es");
  form.append("temperature", "0");
  form.append("response_format", "json");
  form.append("prompt", PROMPT);
  let res: Response;
  try {
    res = await fetchImpl(`${base()}/audio/transcriptions`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new InterpretError("La transcripción no respondió. Probá de nuevo o escribilo.", "unavailable");
  }
  if (res.status === 429) throw new InterpretError("Se alcanzó el límite gratuito de transcripción. Probá en un rato o escribilo.", "rate_limited");
  if (!res.ok) throw new InterpretError("La transcripción no está disponible ahora. Escribilo.", "unavailable");
  const data = (await res.json().catch(() => null)) as { text?: string } | null;
  return (data?.text ?? "").trim().slice(0, 2000);
}
