export type FoodFormValues = {
  id: string | null;
  name: string;
  preparation: string;
  brand: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  sourceType: string;
  sourceRef: string;
  validated: boolean;
  units: { name: string; grams: string }[];
  aliases: string;
};

export const EMPTY_FOOD: FoodFormValues = {
  id: null,
  name: "",
  preparation: "na",
  brand: "",
  kcal: "",
  protein: "",
  carbs: "",
  fat: "",
  fiber: "",
  sourceType: "label",
  sourceRef: "",
  validated: true,
  units: [],
  aliases: "",
};


type Reference = {
  source: "usda" | "off";
  ref: string;
  name: string;
  brand: string | null;
  per100: { kcal: number; protein: number; carbs: number; fat: number; fiber: number | null };
  portions: { name: string; grams: number }[];
  energyMismatch: number | null;
};

const dec = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

/**
 * Carga los valores de una referencia en el formulario. Conserva el nombre, la preparación y los
 * alias que el usuario ya escribió; suma las porciones que falten. Nada se guarda hasta "Guardar".
 */
export function applyReference(v: FoodFormValues, c: Reference): FoodFormValues {
  const existing = new Set(v.units.map((u) => u.name.trim().toLowerCase()));
  const units = [
    ...v.units.filter((u) => u.name.trim() || u.grams.trim()),
    ...c.portions
      .filter((p) => !existing.has(p.name.trim().toLowerCase()))
      .slice(0, 3)
      .map((p) => ({ name: p.name, grams: dec(p.grams) })),
  ];
  return {
    ...v,
    name: v.name.trim() ? v.name : c.name.slice(0, 120),
    brand: v.brand.trim() ? v.brand : (c.brand ?? "").slice(0, 80),
    kcal: dec(c.per100.kcal),
    protein: dec(c.per100.protein),
    carbs: dec(c.per100.carbs),
    fat: dec(c.per100.fat),
    fiber: c.per100.fiber == null ? "" : dec(c.per100.fiber),
    sourceType: c.source,
    sourceRef: c.ref,
    // Los datos colaborativos o inconsistentes quedan sin validar: se confirman al usarlos.
    validated: c.source === "usda" && !(c.energyMismatch != null && c.energyMismatch > 0.15),
    units: units.slice(0, 20),
  };
}
