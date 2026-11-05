/**
 * Cálculos nutricionales deterministas. Ningún valor sale del modelo de lenguaje:
 * todo se calcula acá a partir de valores por 100 g y gramos.
 */

export type Per100g = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
};

export type Nutrients = { kcal: number; protein: number; carbs: number; fat: number; fiber: number | null };

export type FoodUnit = { name: string; grams: number };

export const ZERO: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

const round = (n: number, decimals: number) => {
  const f = 10 ** decimals;
  return Math.round((n + Number.EPSILON) * f) / f;
};

/** Unidades de masa reconocidas siempre. Las demás deben estar definidas en el alimento. */
const MASS_UNITS: Record<string, number> = { g: 1, gr: 1, gramo: 1, gramos: 1, kg: 1000, kilo: 1000, kilos: 1000 };

export function normalizeUnit(unit: string): string {
  return unit
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Convierte una cantidad a gramos. Si la unidad no es de masa y el alimento no la define,
 * devuelve null: nunca se asume un peso.
 */
export function toGrams(quantity: number, unit: string, units: FoodUnit[] = []): number | null {
  if (!(quantity > 0) || !Number.isFinite(quantity)) return null;
  const u = normalizeUnit(unit);
  if (u in MASS_UNITS) return quantity * MASS_UNITS[u];
  const singular = (s: string) => s.replace(/(es|s)$/, "");
  const match = units.find((x) => {
    const n = normalizeUnit(x.name);
    return n === u || singular(n) === singular(u);
  });
  return match ? quantity * match.grams : null;
}

/** Nutrientes de una porción en gramos. Guardado con 2 decimales; se redondea al mostrar. */
export function nutrientsFor(per100: Per100g, grams: number): Nutrients {
  if (!(grams > 0)) throw new Error("Los gramos deben ser positivos");
  const f = grams / 100;
  return {
    kcal: round(per100.kcal * f, 2),
    protein: round(per100.protein * f, 2),
    carbs: round(per100.carbs * f, 2),
    fat: round(per100.fat * f, 2),
    fiber: per100.fiber == null ? null : round(per100.fiber * f, 2),
  };
}

export function sumNutrients(list: Nutrients[]): Nutrients {
  return list.reduce<Nutrients>(
    (acc, n) => ({
      kcal: round(acc.kcal + n.kcal, 2),
      protein: round(acc.protein + n.protein, 2),
      carbs: round(acc.carbs + n.carbs, 2),
      fat: round(acc.fat + n.fat, 2),
      fiber: acc.fiber == null || n.fiber == null ? (acc.fiber ?? 0) + (n.fiber ?? 0) : round(acc.fiber + n.fiber, 2),
    }),
    { ...ZERO },
  );
}

/**
 * Energía estimada por macros (Atwater general 4/4/9). Solo para detectar datos inconsistentes,
 * nunca reemplaza el valor de la referencia.
 */
export function atwaterKcal(per100: Pick<Per100g, "protein" | "carbs" | "fat">): number {
  return 4 * per100.protein + 4 * per100.carbs + 9 * per100.fat;
}

/** Diferencia relativa entre kcal declaradas y estimadas por macros (0,15 = 15 %). */
export function energyMismatch(per100: Per100g): number | null {
  const est = atwaterKcal(per100);
  if (per100.kcal < 20 && est < 20) return null; // alimentos casi sin energía: no es significativo
  const base = Math.max(per100.kcal, est);
  return base === 0 ? null : Math.abs(per100.kcal - est) / base;
}

export type DayProgress = { target: number | null; consumed: number; remaining: number | null; percent: number | null };

export function dayProgress(target: number | null, consumed: number): DayProgress {
  if (target == null || target <= 0) return { target: null, consumed, remaining: null, percent: null };
  return { target, consumed, remaining: round(target - consumed, 2), percent: round((consumed / target) * 100, 1) };
}
