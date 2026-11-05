import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import cases from "../../../../../evals/interpretacion.json";
import { checkCase, type EvalCase } from "@/lib/ai/eval";
import { InterpretError, interpretText } from "@/lib/ai/groq";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Solo el hash del token está en el código; el token no se publica.
const TOKEN_SHA256 =
  "87fc09e360072071031de732a32af1fd0d961bb6511becd9eb3d4aef9dbafa32";

function authorized(token: string | null) {
  if (!token) return false;
  const got = createHash("sha256").update(token).digest();
  return timingSafeEqual(got, Buffer.from(TOKEN_SHA256, "hex"));
}

/** Corre una tanda de la evaluación (evals/interpretacion.json) contra Groq real. ?t=token&desde=0&hasta=6 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  if (!authorized(q.get("t")))
    return NextResponse.json({ error: "no autorizado" }, { status: 404 });
  const all = cases as EvalCase[];
  const from = Math.max(0, Number(q.get("desde") ?? 0) || 0);
  const to = Math.min(
    all.length,
    Number(q.get("hasta") ?? from + 6) || from + 6,
    from + 8,
  );
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
