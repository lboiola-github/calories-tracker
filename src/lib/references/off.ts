import { energyMismatch, type Per100g } from "@/lib/nutrition/calc";
import { ReferenceError, type ReferenceCandidate } from "./types";

/**
 * Open Food Facts (datos bajo ODbL; hay que atribuir la fuente).
 * Límites: 100 lecturas de producto/min y 10 búsquedas/min por IP. Exigen un User-Agent propio.
 * https://openfoodfacts.github.io/openfoodfacts-server/api/
 */
const PUBLIC = "https://world.openfoodfacts.org";
// OFF_BASE_URL solo se cambia en pruebas e2e (servidor simulado).
const base = () => process.env.OFF_BASE_URL || PUBLIC;
// Buscador nuevo de OFF (search-a-licious). La búsqueda clásica /cgi/search.pl responde 503.
const searchBase = () =>
  process.env.OFF_SEARCH_BASE_URL || "https://search.openfoodfacts.org";
export const OFF_USER_AGENT =
  "Calorias/1.0 (app personal; https://github.com/lboiola-github/calories-tracker)";
const FIELDS =
  "code,product_name,product_name_es,generic_name_es,brands,nutriments,nutrition_data_per,serving_size,serving_quantity,quantity";

type OffProduct = {
  code?: unknown;
  product_name?: unknown;
  product_name_es?: unknown;
  generic_name_es?: unknown;
  brands?: unknown;
  nutriments?: Record<string, unknown>;
  nutrition_data_per?: string;
  serving_size?: string;
  serving_quantity?: number | string;
};

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null;
};

/** Códigos EAN-8, UPC-A, EAN-13 o GTIN-14. */
export function isBarcode(s: string): boolean {
  return /^\d{8}$|^\d{12,14}$/.test(s.trim());
}

/**
 * Energía por 100 g: kcal publicadas; si solo hay kJ, se convierten (÷ 4,184).
 * `energy_100g` de OFF está en kJ. Nunca se calcula desde los macros.
 */
export function pickOffEnergy(
  n: Record<string, unknown>,
): { kcal: number; basis: string } | null {
  const kcal = num(n["energy-kcal_100g"]);
  if (kcal != null) return { kcal, basis: "Open Food Facts energy-kcal_100g" };
  const kj = num(n["energy-kj_100g"]) ?? num(n["energy_100g"]);
  if (kj != null)
    return {
      kcal: Math.round((kj / 4.184) * 100) / 100,
      basis: "Open Food Facts kJ ÷ 4,184",
    };
  return null;
}

/**
 * El buscador nuevo devuelve algunos campos como listas (brands) o por idioma ({ es, en, main }).
 * Se normalizan a texto antes de usarlos.
 */
export function offText(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.map(offText).filter(Boolean).join(", ");
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return offText(o.es ?? o.main ?? o.en ?? Object.values(o)[0] ?? "");
  }
  return "";
}

export function parseOffProduct(p: OffProduct): ReferenceCandidate | null {
  const n =
    p.nutriments && typeof p.nutriments === "object" ? p.nutriments : {};
  const energy = pickOffEnergy(n);
  const protein = num(n.proteins_100g);
  const carbs = num(n.carbohydrates_100g);
  const fat = num(n.fat_100g);
  const code = offText(p.code).trim();
  const name = (
    offText(p.product_name_es) ||
    offText(p.product_name) ||
    offText(p.generic_name_es)
  ).trim();
  if (
    !energy ||
    protein == null ||
    carbs == null ||
    fat == null ||
    !code ||
    !name
  )
    return null;

  const per100: Per100g = {
    kcal: energy.kcal,
    protein,
    carbs,
    fat,
    fiber: num(n.fiber_100g),
  };
  const warnings: string[] = [];

  // Valores mayores a 100 g por 100 g son errores de carga del producto.
  if (protein + carbs + fat > 100.5 || energy.kcal > 950) return null;

  const mismatch = energyMismatch(per100);
  if (mismatch != null && mismatch > 0.15) {
    warnings.push(
      "Las calorías no coinciden con los macros (¿kJ o valores por porción?): revisá antes de aceptar.",
    );
  }
  // Si el producto declara la tabla "por porción", los *_100g los calculó OFF: conviene verificar con la etiqueta.
  if (p.nutrition_data_per && offText(p.nutrition_data_per) !== "100g") {
    warnings.push(
      "La etiqueta está cargada por porción: OFF calculó los valores por 100 g.",
    );
  }
  warnings.push("Datos colaborativos: compará con la etiqueta.");

  const portions: { name: string; grams: number }[] = [];
  const sq = num(p.serving_quantity);
  if (sq && sq > 0 && sq <= 5000) portions.push({ name: "porción", grams: sq });

  return {
    source: "off",
    ref: code,
    name: name.slice(0, 120),
    brand: offText(p.brands).split(",")[0]?.trim() || null,
    detail: "Open Food Facts",
    per100,
    energyBasis: energy.basis,
    portions,
    energyMismatch: mismatch,
    warnings,
    url: `${PUBLIC}/product/${encodeURIComponent(code)}`,
  };
}

async function offFetch(url: URL, fetchImpl: typeof fetch): Promise<Response> {
  let res: Response;
  try {
    res = await fetchImpl(url, {
      signal: AbortSignal.timeout(8000),
      headers: { accept: "application/json", "user-agent": OFF_USER_AGENT },
    });
  } catch {
    throw new ReferenceError(
      "Open Food Facts no respondió. Podés cargar los valores a mano.",
      "unavailable",
    );
  }
  if (res.status === 429)
    throw new ReferenceError(
      "Se alcanzó el límite de consultas a Open Food Facts. Probá en un minuto.",
      "rate_limited",
    );
  if (res.status === 404)
    throw new ReferenceError(
      "No se encontró el producto en Open Food Facts.",
      "not_found",
    );
  if (!res.ok)
    throw new ReferenceError(
      "Open Food Facts no está disponible ahora.",
      "unavailable",
    );
  return res;
}

async function json(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    throw new ReferenceError(
      "Respuesta inválida de Open Food Facts.",
      "bad_response",
    );
  }
}

export async function getOffProduct(
  barcode: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ReferenceCandidate> {
  const code = barcode.trim();
  if (!isBarcode(code))
    throw new ReferenceError("Código de barras inválido.", "not_found");
  const url = new URL(`${base()}/api/v2/product/${code}`);
  url.searchParams.set("fields", FIELDS);
  const data = (await json(await offFetch(url, fetchImpl))) as {
    status?: number;
    product?: OffProduct;
  };
  if (data.status !== 1 || !data.product)
    throw new ReferenceError(
      "No se encontró el producto en Open Food Facts.",
      "not_found",
    );
  const c = parseOffProduct({ code, ...data.product });
  if (!c)
    throw new ReferenceError(
      "El producto no tiene la tabla nutricional completa en Open Food Facts.",
      "bad_response",
    );
  return c;
}

export async function searchOff(
  query: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ReferenceCandidate[]> {
  const url = new URL(`${searchBase()}/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("page_size", "25");
  url.searchParams.set("langs", "es");
  url.searchParams.set("fields", `${FIELDS},countries_tags`);
  const data = (await json(await offFetch(url, fetchImpl))) as {
    hits?: (OffProduct & { countries_tags?: string[] })[];
  };
  const hits = data.hits ?? [];
  // Primero los productos vendidos en Argentina.
  const ar = (p: { countries_tags?: string[] }) =>
    (p.countries_tags ?? []).includes("en:argentina");
  return [...hits.filter(ar), ...hits.filter((p) => !ar(p))]
    .map((p) => {
      try {
        return parseOffProduct(p);
      } catch {
        return null; // un producto con datos raros no tumba la búsqueda
      }
    })
    .filter((c): c is ReferenceCandidate => c !== null)
    .slice(0, 15);
}
