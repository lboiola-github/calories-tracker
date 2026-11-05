import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type RecipeIngredient = {
  position: number;
  foodId: string | null;
  quantity: number;
  unit: string;
  grams: number;
  foodName: string;
  preparation: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type RecipeVersion = {
  id: string;
  version: number;
  name: string;
  finalWeightG: number;
  finalWeightMeasured: boolean;
  portions: number | null;
  ingredientsWeightG: number;
  total: { kcal: number; protein: number; carbs: number; fat: number; fiber: number | null };
  per100: { kcal: number; protein: number; carbs: number; fat: number; fiber: number | null };
  notes: string | null;
  createdAt: string;
  ingredients: RecipeIngredient[];
};

export type Recipe = {
  id: string;
  name: string;
  foodId: string | null;
  currentVersion: number;
  archived: boolean;
  versions: RecipeVersion[]; // de la más nueva a la más vieja
};

const n = (v: unknown) => Number(v);
const nn = (v: unknown) => (v == null ? null : Number(v));

const SELECT = `id, name, food_id, current_version, archived_at,
  recipe_versions(id, version, name, final_weight_g, final_weight_measured, portions, ingredients_weight_g,
    total_kcal, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g,
    kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, notes, created_at,
    recipe_ingredients(position, food_id, quantity, unit, grams, food_name, preparation, kcal, protein_g, carbs_g, fat_g))`;

type Row = Record<string, unknown> & { recipe_versions?: Record<string, unknown>[] };

function mapRecipe(r: Row): Recipe {
  const versions = (r.recipe_versions ?? [])
    .map((v) => ({
      id: String(v.id),
      version: n(v.version),
      name: String(v.name),
      finalWeightG: n(v.final_weight_g),
      finalWeightMeasured: Boolean(v.final_weight_measured),
      portions: nn(v.portions),
      ingredientsWeightG: n(v.ingredients_weight_g),
      total: { kcal: n(v.total_kcal), protein: n(v.total_protein_g), carbs: n(v.total_carbs_g), fat: n(v.total_fat_g), fiber: nn(v.total_fiber_g) },
      per100: { kcal: n(v.kcal_per_100g), protein: n(v.protein_per_100g), carbs: n(v.carbs_per_100g), fat: n(v.fat_per_100g), fiber: nn(v.fiber_per_100g) },
      notes: (v.notes as string | null) ?? null,
      createdAt: String(v.created_at),
      ingredients: ((v.recipe_ingredients as Record<string, unknown>[] | undefined) ?? [])
        .map((i) => ({
          position: n(i.position),
          foodId: (i.food_id as string | null) ?? null,
          quantity: n(i.quantity),
          unit: String(i.unit),
          grams: n(i.grams),
          foodName: String(i.food_name),
          preparation: String(i.preparation),
          kcal: n(i.kcal),
          protein: n(i.protein_g),
          carbs: n(i.carbs_g),
          fat: n(i.fat_g),
        }))
        .sort((a, b) => a.position - b.position),
    }))
    .sort((a, b) => b.version - a.version);
  return {
    id: String(r.id),
    name: String(r.name),
    foodId: (r.food_id as string | null) ?? null,
    currentVersion: n(r.current_version),
    archived: r.archived_at != null,
    versions,
  };
}

export async function listRecipes(supabase: SupabaseClient, opts: { archived?: boolean } = {}): Promise<Recipe[]> {
  let q = supabase.from("recipes").select(SELECT).order("name");
  q = opts.archived ? q.not("archived_at", "is", null) : q.is("archived_at", null);
  const { data, error } = await q.returns<Row[]>();
  if (error) throw error;
  return (data ?? []).map(mapRecipe);
}

export async function getRecipe(supabase: SupabaseClient, id: string): Promise<Recipe | null> {
  const { data, error } = await supabase.from("recipes").select(SELECT).eq("id", id).maybeSingle<Row>();
  if (error) throw error;
  return data ? mapRecipe(data) : null;
}
