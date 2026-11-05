import { NextResponse, type NextRequest } from "next/server";
import cases from "../../../../../evals/interpretacion.json";
import { checkCase, type EvalCase } from "@/lib/ai/eval";
import { InterpretError, interpretText } from "@/lib/ai/groq";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Público pero acotado: cada tanda fija se calcula a lo sumo una vez cada 6 horas por instancia
// (cuota gratuita). Los casos están en el repositorio y no tienen datos personales.
const TTL = 6 * 60 * 60_000;
const SIZE = 3; // tandas cortas: responden en pocos segundos
const cache = new Map<number, { at: number; body: object }>();

type Result = {
  i: number;
  text: string;
  ok: boolean;
  problems: string[];
  got?: unknown;
};

// Sin reintentos: con 429 la tanda vuelve enseguida marcada "rate_limited" y no se cachea.
async function runCase(i: number, c: EvalCase): Promise<Result> {
  try {
    const out = await interpretText(c.text);
    const problems = checkCase(c, out);
    return {
      i,
      text: c.text,
      ok: problems.length === 0,
      problems,
      ...(problems.length ? { got: out.items } : {}),
    };
  } catch (e) {
    return {
      i,
      text: c.text,
      ok: false,
      problems: [e instanceof InterpretError ? e.kind : "error"],
    };
  }
}

/** Corre una tanda de la evaluación (evals/interpretacion.json) contra Groq real. ?tanda=1 */
export async function GET(req: NextRequest) {
  const all = cases as EvalCase[];
  const batches = Math.ceil(all.length / SIZE);
  const batch = Number(req.nextUrl.searchParams.get("tanda"));
  // Solo tandas fijas, para que el caché no se pueda esquivar con otros rangos.
  if (!Number.isInteger(batch) || batch < 1 || batch > batches)
    return NextResponse.json(
      { error: `tanda debe ser 1 a ${batches}` },
      { status: 400 },
    );
  const hit = cache.get(batch);
  if (hit && Date.now() - hit.at < TTL)
    return NextResponse.json({ ...hit.body, cached: true });

  const from = (batch - 1) * SIZE;
  const to = Math.min(all.length, from + SIZE);
  const results: Result[] = [];
  for (let i = from; i < to; i++) results.push(await runCase(i, all[i]));
  const body = {
    total: all.length,
    batches,
    from,
    to,
    passed: results.filter((r) => r.ok).length,
    results,
    checkedAt: new Date().toISOString(),
  };
  // No se cachean tandas cortadas por el límite de cuota, para poder reintentar.
  if (!results.some((r) => r.problems.includes("rate_limited")))
    cache.set(batch, { at: Date.now(), body });
  return NextResponse.json(body);
}
