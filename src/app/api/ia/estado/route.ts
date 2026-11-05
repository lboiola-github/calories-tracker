import { NextResponse } from "next/server";
import { InterpretError, interpretText, isAiConfigured } from "@/lib/ai/groq";
import { GROQ_MODEL } from "@/lib/ai/parse";
import { silentWav } from "@/lib/ai/eval";
import { transcribeAudio, WHISPER_MODEL } from "@/lib/ai/transcribe";

export const dynamic = "force-dynamic";

type Check = { ok: boolean; detail: string };
let cache: { at: number; body: object } | null = null;
const TTL = 10 * 60_000; // limita el consumo de cuota: una prueba real cada 10 minutos

const reason = (e: unknown) => (e instanceof InterpretError ? e.kind : "error");

/**
 * Estado público de la IA, sin datos personales ni secretos: si hay clave y si una prueba real
 * con un texto fijo y un audio de silencio responde bien.
 */
export async function GET() {
  if (cache && Date.now() - cache.at < TTL)
    return NextResponse.json({ ...cache.body, cached: true });
  const configured = isAiConfigured();
  let interpret: Check = { ok: false, detail: "sin clave" };
  let transcribe: Check = { ok: false, detail: "sin clave" };
  if (configured) {
    try {
      const out = await interpretText("Almorcé 200 g de arroz blanco cocido");
      const item = out.items[0];
      const ok =
        out.mealType === "lunch" &&
        item?.quantity === 200 &&
        /arroz/i.test(item.food);
      interpret = {
        ok,
        detail: ok
          ? "arroz 200 g, almuerzo"
          : JSON.stringify(out).slice(0, 300),
      };
    } catch (e) {
      interpret = { ok: false, detail: reason(e) };
    }
    try {
      const text = await transcribeAudio(silentWav(), "prueba.wav");
      transcribe = {
        ok: true,
        detail: `respondió (${text.length} caracteres)`,
      };
    } catch (e) {
      transcribe = { ok: false, detail: reason(e) };
    }
  }
  const body = {
    configured,
    models: { interpret: GROQ_MODEL, transcribe: WHISPER_MODEL },
    interpret,
    transcribe,
    checkedAt: new Date().toISOString(),
  };
  cache = { at: Date.now(), body };
  return NextResponse.json(body);
}
