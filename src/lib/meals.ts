export const MEAL_TYPES = [
  { key: "breakfast", label: "Desayuno" },
  { key: "lunch", label: "Almuerzo" },
  { key: "snack", label: "Merienda" },
  { key: "dinner", label: "Cena" },
  { key: "other", label: "Snack" },
] as const;

export type MealType = (typeof MEAL_TYPES)[number]["key"];

export const mealLabel = (t: MealType) => MEAL_TYPES.find((m) => m.key === t)!.label;
export const isMealType = (v: unknown): v is MealType => MEAL_TYPES.some((m) => m.key === v);

/** Comida sugerida según la hora local (solo una sugerencia editable). */
export function suggestMealType(localHour: number): MealType {
  if (localHour >= 5 && localHour < 11) return "breakfast";
  if (localHour >= 11 && localHour < 15) return "lunch";
  if (localHour >= 15 && localHour < 19) return "snack";
  if (localHour >= 19 && localHour < 24) return "dinner";
  return "other";
}

export const PREPARATIONS = [
  { key: "na", label: "Sin especificar" },
  { key: "raw", label: "Crudo" },
  { key: "cooked", label: "Cocido" },
  { key: "boiled", label: "Hervido" },
  { key: "grilled", label: "A la plancha" },
  { key: "baked", label: "Al horno" },
  { key: "roasted", label: "Asado" },
  { key: "fried", label: "Frito" },
  { key: "steamed", label: "Al vapor" },
] as const;

export type Preparation = (typeof PREPARATIONS)[number]["key"];
export const preparationLabel = (p: string) => PREPARATIONS.find((x) => x.key === p)?.label ?? p;
