import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FoodUnit, Per100g } from "@/lib/nutrition/calc";

export type Food = {
  id: string;
  name: string;
  preparation: string;
  brand: string | null;
  per100: Per100g;
  sourceType: string;
  sourceRef: string | null;
  validated: boolean;
  archived: boolean;
  /** Si es el alimento de una receta: se edita desde la receta. */
  recipeId: string | null;
  units: (FoodUnit & { id: string })[];
  aliases: { id: string; alias: string }[];
  createdAt: string;
};

type FoodRow = {
  id: string;
  name: string;
  preparation: string;
  brand: string | null;
  kcal_per_100g: number | string;
  protein_per_100g: number | string;
  carbs_per_100g: number | string;
  fat_per_100g: number | string;
  fiber_per_100g: number | string | null;
  source_type: string;
  source_ref: string | null;
  validated: boolean;
  archived_at: string | null;
  recipe_id?: string | null;
  created_at: string;
  food_units?: { id: string; name: string; grams: number | string }[];
  food_aliases?: { id: string; alias: string }[];
};

const SELECT =
  "id, name, preparation, brand, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, source_type, source_ref, validated, archived_at, recipe_id, created_at, food_units(id, name, grams), food_aliases(id, alias)";

export function mapFood(r: FoodRow): Food {
  return {
    id: r.id,
    name: r.name,
    preparation: r.preparation,
    brand: r.brand,
    per100: {
      kcal: Number(r.kcal_per_100g),
      protein: Number(r.protein_per_100g),
      carbs: Number(r.carbs_per_100g),
      fat: Number(r.fat_per_100g),
      fiber: r.fiber_per_100g == null ? null : Number(r.fiber_per_100g),
    },
    sourceType: r.source_type,
    sourceRef: r.source_ref,
    validated: r.validated,
    archived: r.archived_at != null,
    recipeId: r.recipe_id ?? null,
    units: (r.food_units ?? []).map((u) => ({ id: u.id, name: u.name, grams: Number(u.grams) })),
    aliases: r.food_aliases ?? [],
    createdAt: r.created_at,
  };
}

export async function listFoods(supabase: SupabaseClient, opts: { archived?: boolean } = {}): Promise<Food[]> {
  let q = supabase.from("foods").select(SELECT).order("name");
  q = opts.archived ? q.not("archived_at", "is", null) : q.is("archived_at", null);
  const { data, error } = await q.returns<FoodRow[]>();
  if (error) throw error;
  return (data ?? []).map(mapFood);
}

export async function getFood(supabase: SupabaseClient, id: string): Promise<Food | null> {
  const { data, error } = await supabase.from("foods").select(SELECT).eq("id", id).maybeSingle<FoodRow>();
  if (error) throw error;
  return data ? mapFood(data) : null;
}

export async function getFoods(supabase: SupabaseClient, ids: string[]): Promise<Food[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("foods").select(SELECT).in("id", ids).returns<FoodRow[]>();
  if (error) throw error;
  return (data ?? []).map(mapFood);
}

export type FoodSearchHit = {
  id: string;
  name: string;
  preparation: string;
  brand: string | null;
  kcalPer100g: number;
  validated: boolean;
  score: number;
};

export async function searchFoods(supabase: SupabaseClient, query: string): Promise<FoodSearchHit[]> {
  const q = query.trim();
  if (!q) return [];
  const { data, error } = await supabase.rpc("search_foods", { p_query: q, p_limit: 20 });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    preparation: String(r.preparation),
    brand: (r.brand as string | null) ?? null,
    kcalPer100g: Number(r.kcal_per_100g),
    validated: Boolean(r.validated),
    score: Number(r.score),
  }));
}
