"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/(app)/comidas/actions";
import { requireUser } from "@/lib/auth";
import { getFoods } from "@/lib/data/foods";
import { toGrams } from "@/lib/nutrition/calc";
import { createClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();
const schema = z.object({
  operationId: uuid,
  recipeId: uuid.nullable(),
  name: z.string().trim().min(1, "Ingresá un nombre").max(120),
  ingredients: z
    .array(z.object({ foodId: uuid, quantity: z.number().positive().max(20000), unit: z.string().min(1).max(40) }))
    .min(1, "Agregá al menos un ingrediente")
    .max(60),
  finalWeightG: z.number().positive().max(50000).nullable(),
  portions: z.number().positive().max(100).nullable(),
  notes: z.string().max(1000).nullable(),
});

/**
 * Guarda la receta como una versión nueva. Los gramos de cada ingrediente se calculan acá con las
 * unidades del catálogo, y la base calcula los valores; el cliente no manda calorías.
 */
export async function saveRecipe(input: z.input<typeof schema>): Promise<ActionResult<{ recipeId: string; version: number }>> {
  await requireUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const v = parsed.data;
  const supabase = await createClient();

  const foods = await getFoods(supabase, [...new Set(v.ingredients.map((i) => i.foodId))]);
  const payload = [];
  for (const it of v.ingredients) {
    const food = foods.find((f) => f.id === it.foodId);
    if (!food) return { ok: false, error: "Uno de los ingredientes ya no existe." };
    if (v.recipeId && food.recipeId === v.recipeId) return { ok: false, error: "Una receta no puede contenerse a sí misma." };
    const grams = toGrams(it.quantity, it.unit, food.units);
    if (grams == null) return { ok: false, error: `“${food.name}” no tiene definida la unidad “${it.unit}”.` };
    payload.push({ food_id: food.id, quantity: it.quantity, unit: it.unit, grams: Math.round(grams * 100) / 100 });
  }

  const { data, error } = await supabase.rpc("save_recipe", {
    p_operation_id: v.operationId,
    p_recipe_id: v.recipeId,
    p_name: v.name,
    p_ingredients: payload,
    p_final_weight_g: v.finalWeightG,
    p_portions: v.portions,
    p_notes: v.notes,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Ya tenés un alimento con ese nombre. Elegí otro nombre para la receta." };
    if (error.code === "22023" && /peso/.test(error.message)) return { ok: false, error: "El peso final es menor que el de los nutrientes: revisá el peso." };
    if (error.code === "P0002") return { ok: false, error: "La receta no existe o está archivada." };
    return { ok: false, error: "No se pudo guardar la receta." };
  }
  const r = data as { recipe_id?: string; version?: number; food_id?: string } | null;
  if (!r?.recipe_id || !r.version) return { ok: false, error: "No se pudo guardar la receta." };

  // Sin porciones en esta versión: quitar la unidad "porción" que pudo quedar de una anterior.
  if (v.portions == null && r.food_id) {
    await supabase.from("food_units").delete().eq("food_id", r.food_id).eq("name_normalized", "porcion");
  }

  revalidatePath("/alimentos", "layout");
  return { ok: true, data: { recipeId: r.recipe_id, version: r.version } };
}

export async function archiveRecipe(id: string, archived: boolean): Promise<ActionResult<null>> {
  await requireUser();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Datos inválidos." };
  const { error } = await (await createClient()).rpc("set_recipe_archived", { p_recipe_id: id, p_archived: archived });
  if (error) return { ok: false, error: "No se pudo archivar la receta." };
  revalidatePath("/alimentos", "layout");
  return { ok: true, data: null };
}
