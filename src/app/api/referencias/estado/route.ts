import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Diagnóstico público de USDA y Open Food Facts desde el servidor: código HTTP y el comienzo
// de la respuesta, sin la clave. Se calcula a lo sumo una vez cada 10 minutos por instancia.
const TTL = 10 * 60_000;
let cache: { at: number; body: object } | null = null;

async function probe(url: URL, headers: Record<string, string> = {}) {
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json", ...headers },
      signal: AbortSignal.timeout(8000),
    });
    const text = (await res.text()).slice(0, 300);
    return {
      status: res.status,
      body: text.replaceAll(process.env.USDA_API_KEY || "\u0000", "***"),
    };
  } catch (e) {
    return { status: 0, body: e instanceof Error ? e.name : "error" };
  }
}

export async function GET() {
  if (cache && Date.now() - cache.at < TTL)
    return NextResponse.json({ ...cache.body, cached: true });
  const usda = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  usda.searchParams.set("api_key", process.env.USDA_API_KEY || "DEMO_KEY");
  usda.searchParams.set("query", "chicken breast");
  usda.searchParams.set("pageSize", "2");
  usda.searchParams.set("dataType", "Foundation,SR Legacy,Survey (FNDDS)");
  const off = new URL("https://world.openfoodfacts.org/cgi/search.pl");
  for (const [k, v] of Object.entries({
    search_terms: "dulce de leche",
    search_simple: "1",
    json: "1",
    page_size: "2",
    fields: "code,product_name",
  }))
    off.searchParams.set(k, v);
  const offV2 = new URL(
    "https://world.openfoodfacts.org/api/v2/product/7790080032312",
  );
  offV2.searchParams.set("fields", "code,product_name");
  const offSal = new URL("https://search.openfoodfacts.org/search");
  for (const [k, v] of Object.entries({
    q: "dulce de leche",
    page_size: "2",
    fields: "code,product_name",
  }))
    offSal.searchParams.set(k, v);
  const ua = {
    "user-agent":
      "Calorias/1.0 (app personal; https://github.com/lboiola-github/calories-tracker)",
  };
  const body = {
    usdaKey: process.env.USDA_API_KEY ? "propia" : "DEMO_KEY",
    usda: await probe(usda),
    offSearch: await probe(off, ua),
    offProduct: await probe(offV2, ua),
    offSearchALicious: await probe(offSal, ua),
    checkedAt: new Date().toISOString(),
  };
  cache = { at: Date.now(), body };
  return NextResponse.json(body);
}
