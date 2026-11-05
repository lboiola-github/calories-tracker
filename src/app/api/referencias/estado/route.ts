import { NextResponse } from "next/server";
import { searchOff } from "@/lib/references/off";
import { ReferenceError } from "@/lib/references/types";
import { searchUsda } from "@/lib/references/usda";

export const dynamic = "force-dynamic";

// Diagnóstico público de USDA y Open Food Facts desde el servidor, con las mismas funciones que usa
// la app. Sin datos personales ni la clave. Se recalcula a lo sumo una vez cada 10 minutos.
const TTL = 10 * 60_000;
let cache: { at: number; body: object } | null = null;

async function check(run: () => Promise<{ name: string }[]>) {
  try {
    const r = await run();
    return { ok: r.length > 0, results: r.length, first: r[0]?.name ?? null };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof ReferenceError
          ? `${e.kind}: ${e.message}`
          : `${e instanceof Error ? e.name : "error"}: ${e instanceof Error ? e.message.slice(0, 200) : ""}`,
    };
  }
}

export async function GET() {
  if (cache && Date.now() - cache.at < TTL)
    return NextResponse.json({ ...cache.body, cached: true });
  const body = {
    usdaKey: process.env.USDA_API_KEY ? "propia" : "DEMO_KEY",
    usda: await check(() => searchUsda("chicken breast")),
    off: await check(() => searchOff("dulce de leche")),
    checkedAt: new Date().toISOString(),
  };
  cache = { at: Date.now(), body };
  return NextResponse.json(body);
}
