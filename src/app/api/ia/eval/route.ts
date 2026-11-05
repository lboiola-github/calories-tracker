import { NextResponse, type NextRequest } from "next/server";
import cases from "../../../../../evals/interpretacion.json";
import { checkCase, type EvalCase } from "@/lib/ai/eval";
import { InterpretError, interpretText } from "@/lib/ai/groq";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Público pero acotado: cada tanda se calcula a lo sumo una vez cada 6 horas (cuota gratuita).
// Los casos están en el repositorio y no tienen datos personales.
const TTL = 6 * 60 * 60_000;
const cache = new Map<string, { at: number; body: object }>();

/** Corre una tanda de la evaluación (evals/interpretacion.json) contra Groq real. ?tanda=1 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const all = cases as EvalCase[];
  // Solo tandas fijas de 6 casos, para que el caché no se pueda esquivar con otros rangos.
  const batches = Math.ceil(all.length / 6);
  const batch = Number(q.get("tanda"));
  if (!Number.isInteger(batch) || batch < 1 || batch > batches)
    return NextResponse.json(
      { error: `tanda debe ser 1 a ${batches}` },
      { status: 400 },
    );
  const from = (batch - 1) * 6;
  const to = Math.min(all.length, from + 6);
  const key = `${from}-${to}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL)
    return NextResponse.json({ ...hit.body, cached: true });
  const results: {
    i: number;
    text: string;
    ok: boolean;
    problems: string[];
  }[] = [];
  for (let i = from; i < to; i++) {
    const c = all[i];
    try {
      const out = await interpretText(c.text);
      const problems = checkCase(c, out);
      results.push({ i, text: c.text, ok: problems.length === 0, problems });
    } catch (e) {
      results.push({
        i,
        text: c.text,
        ok: false,
        problems: [e instanceof InterpretError ? e.kind : "error"],
      });
    }
    if (i < to - 1) await new Promise((r) => setTimeout(r, 2500)); // límite gratuito por minuto
  }
  return NextResponse.json({
    total: all.length,
    from,
    to,
    passed: results.filter((r) => r.ok).length,
    results,
  });
}
