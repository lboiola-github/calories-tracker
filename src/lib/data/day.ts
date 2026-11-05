import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MEAL_TYPES, type MealType } from "@/lib/meals";
import { sumNutrients, type Nutrients } from "@/lib/nutrition/calc";

export type DayItem = {
  id: string;
  foodId: string | null;
  name: string;
  preparation: string;
  quantity: number;
  unit: string;
  grams: number;
  nutrients: Nutrients;
  per100: { kcal: number; protein: number; carbs: number; fat: number; fiber: number | null };
  sourceType: string;
};

export type DayMeal = { type: MealType; items: DayItem[]; subtotal: Nutrients };
export type Day = { date: string; meals: DayMeal[]; total: Nutrients };

type Row = {
  id: string;
  food_id: string | null;
  food_name: string;
  preparation: string;
  quantity: number | string;
  unit: string;
  grams: number | string;
  kcal: number | string;
  protein_g: number | string;
  carbs_g: number | string;
  fat_g: number | string;
  fiber_g: number | string | null;
  kcal_per_100g: number | string;
  protein_per_100g: number | string;
  carbs_per_100g: number | string;
  fat_per_100g: number | string;
  fiber_per_100g: number | string | null;
  source_type: string;
  created_at: string;
  meals: { meal_type: MealType; meal_date: string };
};

const n = (v: number | string) => Number(v);
const nn = (v: number | string | null) => (v == null ? null : Number(v));

/** Comidas de una fecha local con subtotales y total (calculados en código desde los snapshots). */
export async function loadDay(supabase: SupabaseClient, date: string): Promise<Day> {
  const { data, error } = await supabase
    .from("meal_items")
    .select(
      "id, food_id, food_name, preparation, quantity, unit, grams, kcal, protein_g, carbs_g, fat_g, fiber_g, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, source_type, created_at, meals!inner(meal_type, meal_date)",
    )
    .eq("meals.meal_date", date)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .returns<Row[]>();
  if (error) throw error;

  const byType = new Map<MealType, DayItem[]>();
  for (const r of data ?? []) {
    const item: DayItem = {
      id: r.id,
      foodId: r.food_id,
      name: r.food_name,
      preparation: r.preparation,
      quantity: n(r.quantity),
      unit: r.unit,
      grams: n(r.grams),
      nutrients: { kcal: n(r.kcal), protein: n(r.protein_g), carbs: n(r.carbs_g), fat: n(r.fat_g), fiber: nn(r.fiber_g) },
      per100: {
        kcal: n(r.kcal_per_100g),
        protein: n(r.protein_per_100g),
        carbs: n(r.carbs_per_100g),
        fat: n(r.fat_per_100g),
        fiber: nn(r.fiber_per_100g),
      },
      sourceType: r.source_type,
    };
    const list = byType.get(r.meals.meal_type) ?? [];
    list.push(item);
    byType.set(r.meals.meal_type, list);
  }

  const meals: DayMeal[] = MEAL_TYPES.map(({ key }) => {
    const items = byType.get(key) ?? [];
    return { type: key, items, subtotal: sumNutrients(items.map((i) => i.nutrients)) };
  });
  return { date, meals, total: sumNutrients(meals.map((m) => m.subtotal)) };
}
