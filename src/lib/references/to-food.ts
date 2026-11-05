import type { ReferenceCandidate } from "./types";

/** Estado de preparación según palabras del nombre (español o inglés de USDA). */
const PREP_WORDS: [RegExp, string][] = [
  [/\b(raw|crud[oa]s?)\b/i, "raw"],
  [/\b(boiled|hervid[oa]s?|hard-boiled|duro)\b/i, "boiled"],
  [/\b(grilled|broiled|plancha|grillad[oa]s?)\b/i, "grilled"],
  [/\b(roasted|asad[oa]s?)\b/i, "roasted"],
  [/\b(baked|horno|horneado)\b/i, "baked"],
  [/\b(fried|frit[oa]s?)\b/i, "fried"],
  [/\b(steamed|vapor)\b/i, "steamed"],
  [/\b(cooked|cocid[oa]s?)\b/i, "cooked"],
];

export function preparationFromText(
  ...texts: (string | null | undefined)[]
): string {
  for (const t of texts) {
    if (!t) continue;
    for (const [re, prep] of PREP_WORDS) if (re.test(t)) return prep;
  }
  return "na";
}

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * Alimento del catálogo a partir de una referencia elegida por el usuario. El nombre es el que
 * buscó (en español); el de la fuente queda como alias. La preparación sale primero de lo que
 * escribió el usuario y, si no dice, de la descripción de la fuente.
 */
export function foodFromReference(
  c: ReferenceCandidate,
  typedName: string,
  preparation?: string | null,
) {
  const name =
    capitalize(typedName.trim().replace(/\s+/g, " ")).slice(0, 120) ||
    c.name.slice(0, 120);
  const mismatch = c.energyMismatch != null && c.energyMismatch > 0.15;
  return {
    name,
    preparation: preparation || preparationFromText(typedName, c.name),
    brand: c.brand?.slice(0, 80) ?? "",
    kcal_per_100g: c.per100.kcal,
    protein_per_100g: c.per100.protein,
    carbs_per_100g: c.per100.carbs,
    fat_per_100g: c.per100.fat,
    fiber_per_100g: c.per100.fiber,
    source_type: c.source,
    source_ref: c.ref,
    source_detail: {
      name: c.name,
      detail: c.detail,
      energyBasis: c.energyBasis,
      url: c.url,
    },
    // Datos colaborativos o inconsistentes quedan sin validar.
    validated: c.source === "usda" && !mismatch,
    units: c.portions.slice(0, 3).map((p) => ({
      name: p.name.slice(0, 40),
      grams: Math.round(p.grams * 100) / 100,
    })),
    aliases:
      c.name.toLowerCase() !== name.toLowerCase() ? [c.name.slice(0, 120)] : [],
  };
}
