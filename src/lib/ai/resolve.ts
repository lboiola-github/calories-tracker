import type { FoodSearchHit } from "@/lib/data/foods";
import { toGrams, type FoodUnit } from "@/lib/nutrition/calc";

export type ResolvedItem = {
  fragment: string;
  food: string;
  quantity: number | null;
  unit: string;
  preparation: string | null;
  note: string | null;
  match: FoodSearchHit | null;
  units: FoodUnit[];
  grams: number | null;
};

/** Mejor resultado del catálogo para un ítem: respeta la preparación si el usuario la dijo. */
export function pickMatch(hits: FoodSearchHit[], preparation: string | null, minScore = 0.45): FoodSearchHit | null {
  const good = hits.filter((h) => h.score >= minScore);
  if (good.length === 0) return null;
  if (preparation) {
    const same = good.find((h) => h.preparation === preparation);
    if (same) return same;
    // Dijo una preparación y el catálogo solo tiene otras: no se elige solo (cambian las calorías).
    if (good.every((h) => h.preparation !== "na")) return null;
    return good.find((h) => h.preparation === "na") ?? null;
  }
  return good[0];
}

/** Unidad a usar: la que dijo, "g" si no dijo; "unidad" solo si el alimento la tiene definida. */
export function resolveGrams(quantity: number | null, unit: string | null, units: FoodUnit[]): { unit: string; grams: number | null } {
  const u = unit ?? "g";
  if (quantity == null) return { unit: u, grams: null };
  const grams = toGrams(quantity, u, units);
  return { unit: u, grams: grams == null ? null : Math.round(grams * 100) / 100 };
}

/** Se registra directo solo si todo está completo y los alimentos están validados. */
export const canAutoLog = (items: ResolvedItem[]) =>
  items.length > 0 && items.every((i) => i.match?.validated && i.grams != null && i.grams > 0 && !i.note);
