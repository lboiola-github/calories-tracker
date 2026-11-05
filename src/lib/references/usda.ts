import { energyMismatch, type Per100g } from "@/lib/nutrition/calc";
import { ReferenceError, type ReferenceCandidate } from "./types";

/**
 * USDA FoodData Central (dominio público, CC0). Límite: 1.000 solicitudes/hora por clave.
 * https://fdc.nal.usda.gov/api-guide
 */
// USDA_BASE_URL solo se cambia en pruebas e2e (servidor simulado).
const base = () =>
  process.env.USDA_BASE_URL || "https://api.nal.usda.gov/fdc/v1";

/** Tipos de dato para alimentos genéricos. Branded solo cuando se busca un producto de marca. */
export const GENERIC_DATA_TYPES = [
  "Foundation",
  "SR Legacy",
  "Survey (FNDDS)",
] as const;

// Ids de nutrientes de FDC (y su número histórico de SR Legacy).
export const NUTRIENT = {
  energyKcal: { id: 1008, number: "208" },
  energyAtwaterGeneral: { id: 2047, number: "957" },
  energyAtwaterSpecific: { id: 2048, number: "958" },
  energyKj: { id: 1062, number: "268" },
  protein: { id: 1003, number: "203" },
  fat: { id: 1004, number: "204" },
  carbs: { id: 1005, number: "205" },
  fiber: { id: 1079, number: "291" },
} as const;

export type FdcNutrient = {
  id: number | null;
  number: string | null;
  name: string;
  unit: string;
  amount: number;
};

/** Normaliza los dos formatos de nutrientes de FDC (búsqueda y detalle). */
export function readNutrients(raw: unknown[]): FdcNutrient[] {
  const out: FdcNutrient[] = [];
  for (const r of raw as Record<string, unknown>[]) {
    const nested = r.nutrient as Record<string, unknown> | undefined;
    const id = (r.nutrientId ?? nested?.id) as number | undefined;
    const number = (r.nutrientNumber ?? nested?.number) as string | undefined;
    const name = (r.nutrientName ?? nested?.name ?? "") as string;
    const unit = String(r.unitName ?? nested?.unitName ?? "").toLowerCase();
    const amount = (r.value ?? r.amount) as number | undefined;
    if (typeof amount !== "number" || !Number.isFinite(amount)) continue;
    out.push({
      id: id ?? null,
      number: number ? String(number) : null,
      name,
      unit,
      amount,
    });
  }
  return out;
}

const find = (
  list: FdcNutrient[],
  key: { id: number; number: string },
  unit?: string,
) =>
  list.find(
    (n) =>
      (n.id === key.id || n.number === key.number) &&
      (!unit || n.unit === unit),
  );

/**
 * Regla fija para elegir la energía (kcal/100 g), documentada en la auditoría:
 *   1. "Energy" en kcal (id 1008). Es el valor publicado en SR Legacy y FNDDS.
 *   2. "Energy (Atwater Specific Factors)" (2048): más preciso para Foundation Foods.
 *   3. "Energy (Atwater General Factors)" (2047).
 *   4. "Energy" en kJ (1062) convertido (÷ 4,184).
 * Nunca se calcula la energía desde los macros.
 */
export function pickEnergy(
  list: FdcNutrient[],
): { kcal: number; basis: string } | null {
  const kcal = find(list, NUTRIENT.energyKcal, "kcal");
  if (kcal) return { kcal: kcal.amount, basis: "USDA Energy (kcal, 1008)" };
  const specific = find(list, NUTRIENT.energyAtwaterSpecific, "kcal");
  if (specific)
    return {
      kcal: specific.amount,
      basis: "USDA Energy, Atwater Specific Factors (2048)",
    };
  const general = find(list, NUTRIENT.energyAtwaterGeneral, "kcal");
  if (general)
    return {
      kcal: general.amount,
      basis: "USDA Energy, Atwater General Factors (2047)",
    };
  const kj =
    find(list, NUTRIENT.energyKj, "kj") ??
    list.find((n) => n.unit === "kj" && /energy/i.test(n.name));
  if (kj)
    return {
      kcal: Math.round((kj.amount / 4.184) * 100) / 100,
      basis: "USDA Energy (kJ ÷ 4,184)",
    };
  return null;
}

type FdcFood = Record<string, unknown> & {
  fdcId: number;
  description: string;
  dataType?: string;
};

export function parseFdcFood(food: FdcFood): ReferenceCandidate | null {
  const list = readNutrients((food.foodNutrients as unknown[]) ?? []);
  const energy = pickEnergy(list);
  const protein = find(list, NUTRIENT.protein, "g");
  const fat = find(list, NUTRIENT.fat, "g");
  const carbs = find(list, NUTRIENT.carbs, "g");
  if (!energy || !protein || !fat || !carbs) return null; // incompleto: no se ofrece
  const fiber = find(list, NUTRIENT.fiber, "g");
  const per100: Per100g = {
    kcal: energy.kcal,
    protein: protein.amount,
    carbs: carbs.amount,
    fat: fat.amount,
    fiber: fiber?.amount ?? null,
  };

  const portions: { name: string; grams: number }[] = [];
  for (const p of (
    (food.foodPortions ?? food.foodMeasures ?? []) as Record<string, unknown>[]
  ).slice(0, 8)) {
    const grams = Number(p.gramWeight);
    const label = String(
      p.disseminationText ??
        p.portionDescription ??
        [p.amount, (p.measureUnit as { name?: string })?.name, p.modifier]
          .filter(Boolean)
          .join(" "),
    ).trim();
    if (grams > 0 && label && !/quantity not specified/i.test(label))
      portions.push({ name: label.slice(0, 40), grams });
  }

  const mismatch = energyMismatch(per100);
  const warnings: string[] = [];
  if (mismatch != null && mismatch > 0.15)
    warnings.push(
      "Las calorías no coinciden con los macros: revisá antes de aceptar.",
    );
  warnings.push("USDA informa carbohidratos totales (incluyen fibra).");

  return {
    source: "usda",
    ref: String(food.fdcId),
    name: food.description,
    brand:
      (food.brandOwner as string | undefined) ??
      (food.brandName as string | undefined) ??
      null,
    detail: food.dataType ?? "USDA",
    per100,
    energyBasis: energy.basis,
    portions,
    energyMismatch: mismatch,
    warnings,
    url: `https://fdc.nal.usda.gov/food-details/${food.fdcId}/nutrients`,
  };
}

async function fdcFetch(
  path: string,
  params: Record<string, string>,
  fetchImpl: typeof fetch,
  body?: Record<string, unknown>,
): Promise<unknown> {
  const url = new URL(`${base()}${path}`);
  url.searchParams.set("api_key", process.env.USDA_API_KEY || "DEMO_KEY");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: body ? "POST" : "GET",
      signal: AbortSignal.timeout(8000),
      headers: body
        ? { accept: "application/json", "content-type": "application/json" }
        : { accept: "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ReferenceError(
      "USDA no respondió. Podés cargar los valores a mano.",
      "unavailable",
    );
  }
  if (res.status === 429)
    throw new ReferenceError(
      "Se alcanzó el límite de consultas a USDA. Probá más tarde.",
      "rate_limited",
    );
  if (res.status === 404)
    throw new ReferenceError("No se encontró en USDA.", "not_found");
  if (!res.ok)
    throw new ReferenceError("USDA no está disponible ahora.", "unavailable");
  try {
    return await res.json();
  } catch {
    throw new ReferenceError("Respuesta inválida de USDA.", "bad_response");
  }
}

// La búsqueda va por POST con JSON: es la forma documentada de pasar la lista de tipos
// ("Survey (FNDDS)" tiene espacios y paréntesis, y por GET el servidor de USDA respondía 400).
export async function searchUsda(
  query: string,
  opts: { branded?: boolean; fetchImpl?: typeof fetch } = {},
): Promise<ReferenceCandidate[]> {
  const data = (await fdcFetch("/foods/search", {}, opts.fetchImpl ?? fetch, {
    query,
    pageSize: 15,
    dataType: opts.branded ? ["Branded"] : [...GENERIC_DATA_TYPES],
  })) as { foods?: FdcFood[] };
  return (data.foods ?? [])
    .map(parseFdcFood)
    .filter((c): c is ReferenceCandidate => c !== null);
}

export async function getUsdaFood(
  fdcId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ReferenceCandidate> {
  if (!/^\d{1,10}$/.test(fdcId))
    throw new ReferenceError("Id de USDA inválido.", "not_found");
  const food = (await fdcFetch(`/food/${fdcId}`, {}, fetchImpl)) as FdcFood;
  const c = parseFdcFood(food);
  if (!c)
    throw new ReferenceError(
      "La referencia de USDA no tiene datos completos.",
      "bad_response",
    );
  return c;
}
