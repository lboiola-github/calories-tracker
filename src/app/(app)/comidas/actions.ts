"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getFoods, searchFoods, type FoodSearchHit } from "@/lib/data/foods";
import { isIsoDate } from "@/lib/dates";
import { isMealType, PREPARATIONS, type MealType } from "@/lib/meals";
import { nutrientsFor, toGrams } from "@/lib/nutrition/calc";
import { getOffProduct } from "@/lib/references/off";
import { foodFromReference } from "@/lib/references/to-food";
import { ReferenceError, type ReferenceCandidate } from "@/lib/references/types";
import { getUsdaFood } from "@/lib/references/usda";
import { createClient } from "@/lib/supabase/server";

export type ActionResult<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

const uuid = z.string().uuid();
const mealType = z.custom<MealType>(isMealType, "Comida inválida");
const date = z.string().refine(isIsoDate, "Fecha inválida");

export async function findFoods(query: string): Promise<ActionResult<FoodSearchHit[]>> {
  await requireUser();
  try {
    return { ok: true, data: await searchFoods(await createClient(), query.slice(0, 120)) };
  } catch {
    return { ok: false, error: "No se pudo buscar. Probá de nuevo." };
  }
}

export async function foodUnits(foodId: string): Promise<ActionResult<{ name: string; grams: number }[]>> {
  await requireUser();
  if (!uuid.safeParse(foodId).success) return { ok: false, error: "Datos inválidos." };
  const [food] = await getFoods(await createClient(), [foodId]);
  return { ok: true, data: food ? food.units.map((u) => ({ name: u.name, grams: u.grams })) : [] };
}

const refSchema = z.object({
  source: z.enum(["usda", "off"]),
  ref: z.string().regex(/^\d{1,14}$/),
  typedName: z.string().max(120),
  // Preparación que dijo el usuario (desde la interpretación); manda sobre la del nombre.
  preparation: z.enum(PREPARATIONS.map((p) => p.key) as [string, ...string[]]).nullable().optional(),
});

export type AddedFood = { hit: FoodSearchHit; units: { name: string; grams: number }[] };

/**
 * Agrega al catálogo un alimento elegido de USDA u Open Food Facts, para poder registrarlo sin
 * cargarlo antes. Los valores se vuelven a pedir a la fuente acá: no se confía en lo que manda el
 * cliente. Si ya estaba en el catálogo (misma fuente y referencia), se reutiliza.
 */
export async function addReferenceFood(input: z.input<typeof refSchema>): Promise<ActionResult<AddedFood>> {
  await requireUser();
  const parsed = refSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  const { source, ref, typedName, preparation } = parsed.data;
  const supabase = await createClient();

  const toResult = async (id: string): Promise<ActionResult<AddedFood>> => {
    const [food] = await getFoods(supabase, [id]);
    if (!food) return { ok: false, error: "No se pudo agregar el alimento." };
    return {
      ok: true,
      data: {
        hit: {
          id: food.id,
          name: food.name,
          preparation: food.preparation,
          brand: food.brand,
          kcalPer100g: food.per100.kcal,
          validated: food.validated,
          score: 1,
        },
        units: food.units.map((u) => ({ name: u.name, grams: u.grams })),
      },
    };
  };

  const { data: existing } = await supabase
    .from("foods")
    .select("id")
    .eq("source_type", source)
    .eq("source_ref", ref)
    .is("archived_at", null)
    .limit(1);
  if (existing?.[0]?.id) return toResult(existing[0].id);

  let candidate: ReferenceCandidate;
  try {
    candidate = source === "usda" ? await getUsdaFood(ref) : await getOffProduct(ref);
  } catch (e) {
    return { ok: false, error: e instanceof ReferenceError ? e.message : "No se pudo consultar la fuente." };
  }
  const { units, aliases, ...food } = foodFromReference(candidate, typedName, preparation);
  const { data: id, error } = await supabase.rpc("save_food", { p_id: null, p_food: food, p_units: units, p_aliases: aliases });
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: `Ya tenés “${food.name}” en tu catálogo con otros valores. Elegilo de la lista o cambiá la búsqueda.` };
    }
    return { ok: false, error: "No se pudo agregar el alimento." };
  }
  if (typeof id !== "string") return { ok: false, error: "No se pudo agregar el alimento." };
  revalidatePath("/alimentos");
  return toResult(id);
}

const logSchema = z.object({
  operationId: uuid,
  date,
  mealType,
  inputText: z.string().max(2000).nullable().optional(),
  items: z
    .array(z.object({ foodId: uuid, quantity: z.number().positive().max(10000), unit: z.string().min(1).max(40) }))
    .min(1)
    .max(30),
});

/**
 * Registra uno o varios alimentos del catálogo en una comida, en una sola transacción.
 * Los valores se calculan acá desde el catálogo; el cliente solo envía alimento y cantidad.
 */
export async function logItems(input: z.input<typeof logSchema>): Promise<ActionResult<{ itemIds: string[]; replayed: boolean }>> {
  await requireUser();
  const parsed = logSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  const { operationId, items } = parsed.data;

  const supabase = await createClient();
  const foods = await getFoods(supabase, [...new Set(items.map((i) => i.foodId))]);

  const payload = [];
  for (const it of items) {
    const food = foods.find((f) => f.id === it.foodId);
    if (!food) return { ok: false, error: "Uno de los alimentos ya no existe." };
    const grams = toGrams(it.quantity, it.unit, food.units);
    if (grams == null) return { ok: false, error: `“${food.name}” no tiene definida la unidad “${it.unit}”.` };
    const n = nutrientsFor(food.per100, grams);
    payload.push({
      food_id: food.id,
      quantity: it.quantity,
      unit: it.unit,
      grams,
      food_name: food.brand ? `${food.name} (${food.brand})` : food.name,
      preparation: food.preparation,
      kcal_per_100g: food.per100.kcal,
      protein_per_100g: food.per100.protein,
      carbs_per_100g: food.per100.carbs,
      fat_per_100g: food.per100.fat,
      fiber_per_100g: food.per100.fiber,
      source_type: food.sourceType,
      source_ref: food.sourceRef,
      kcal: n.kcal,
      protein_g: n.protein,
      carbs_g: n.carbs,
      fat_g: n.fat,
      fiber_g: n.fiber,
    });
  }

  const { data, error } = await supabase.rpc("log_meal_items", {
    p_operation_id: operationId,
    p_meal_date: parsed.data.date,
    p_meal_type: parsed.data.mealType,
    p_items: payload,
    p_input_text: parsed.data.inputText ?? null,
  });
  if (error || !Array.isArray(data?.item_ids)) return { ok: false, error: "No se pudo registrar. Tus datos no se perdieron: probá de nuevo." };
  revalidatePath("/", "layout");
  return { ok: true, data: { itemIds: data.item_ids as string[], replayed: Boolean(data.replayed) } };
}

const updateSchema = z.object({
  operationId: uuid,
  itemId: uuid,
  quantity: z.number().positive().max(10000).optional(),
  unit: z.string().min(1).max(40).optional(),
  mealType: mealType.optional(),
  date: date.optional(),
});

/** Cambia cantidad y/o comida de un ítem. Recalcula con los valores por 100 g del snapshot. */
export async function updateItem(input: z.input<typeof updateSchema>): Promise<ActionResult> {
  await requireUser();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  const v = parsed.data;
  const supabase = await createClient();

  const patch: Record<string, unknown> = {};
  if (v.mealType) patch.meal_type = v.mealType;
  if (v.date) patch.meal_date = v.date;

  if (v.quantity != null && v.unit) {
    const { data: item, error } = await supabase
      .from("meal_items")
      .select("food_id, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g")
      .eq("id", v.itemId)
      .maybeSingle();
    if (error || !item) return { ok: false, error: "El registro ya no existe." };
    const units = item.food_id ? ((await getFoods(supabase, [item.food_id]))[0]?.units ?? []) : [];
    const grams = toGrams(v.quantity, v.unit, units);
    if (grams == null) return { ok: false, error: `La unidad “${v.unit}” no está definida para este alimento.` };
    const n = nutrientsFor(
      {
        kcal: Number(item.kcal_per_100g),
        protein: Number(item.protein_per_100g),
        carbs: Number(item.carbs_per_100g),
        fat: Number(item.fat_per_100g),
        fiber: item.fiber_per_100g == null ? null : Number(item.fiber_per_100g),
      },
      grams,
    );
    Object.assign(patch, {
      quantity: v.quantity,
      unit: v.unit,
      grams,
      kcal: n.kcal,
      protein_g: n.protein,
      carbs_g: n.carbs,
      fat_g: n.fat,
      fiber_g: n.fiber,
    });
  }

  const { error } = await supabase.rpc("update_meal_item", { p_operation_id: v.operationId, p_item_id: v.itemId, p_patch: patch });
  if (error) return { ok: false, error: "No se pudo guardar el cambio." };
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

export async function setItemDeleted(input: { operationId: string; itemId: string; deleted: boolean }): Promise<ActionResult> {
  await requireUser();
  const parsed = z.object({ operationId: uuid, itemId: uuid, deleted: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_meal_item_deleted", {
    p_operation_id: parsed.data.operationId,
    p_item_id: parsed.data.itemId,
    p_deleted: parsed.data.deleted,
  });
  if (error) return { ok: false, error: "No se pudo actualizar." };
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}
