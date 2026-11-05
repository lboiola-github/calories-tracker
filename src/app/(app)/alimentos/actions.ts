"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { parseDecimal } from "@/lib/format";
import { PREPARATIONS } from "@/lib/meals";
import { createClient } from "@/lib/supabase/server";

export type FoodFormState = { error: string | null; fieldErrors: Record<string, string> };

const num = (min: number, max: number, label: string, optional = false) =>
  z
    .unknown()
    .transform((v) => (v === "" || v == null ? null : parseDecimal(v)))
    .refine((v) => (v === null ? optional : v >= min && v <= max), { message: `${label}: entre ${min} y ${max}` });

const schema = z
  .object({
    id: z.string().uuid().nullable(),
    name: z.string().trim().min(1, "Ingresá un nombre").max(120),
    preparation: z.enum(PREPARATIONS.map((p) => p.key) as [string, ...string[]]),
    brand: z.string().trim().max(80),
    kcal: num(0, 950, "Calorías"),
    protein: num(0, 100, "Proteínas"),
    carbs: num(0, 100, "Carbohidratos"),
    fat: num(0, 100, "Grasas"),
    fiber: num(0, 100, "Fibra", true),
    sourceType: z.enum(["manual", "label", "usda", "off", "other"]),
    sourceRef: z.string().trim().max(200),
    validated: z.boolean(),
    units: z.array(z.object({ name: z.string().trim().min(1).max(40), grams: z.number().positive().max(5000) })).max(20),
    aliases: z.array(z.string().trim().min(1).max(120)).max(30),
  })
  .refine((v) => (v.protein ?? 0) + (v.carbs ?? 0) + (v.fat ?? 0) <= 100.5, {
    message: "Proteínas + carbohidratos + grasas no pueden superar 100 g",
    path: ["carbs"],
  });

function readUnits(formData: FormData) {
  const names = formData.getAll("unitName").map(String);
  const grams = formData.getAll("unitGrams").map((g) => parseDecimal(String(g)));
  return names
    .map((name, i) => ({ name: name.trim(), grams: grams[i] ?? NaN }))
    .filter((u) => u.name !== "" || Number.isFinite(u.grams));
}

export async function saveFood(_prev: FoodFormState, formData: FormData): Promise<FoodFormState> {
  await requireUser();
  const parsed = schema.safeParse({
    id: (formData.get("id") as string) || null,
    name: formData.get("name") ?? "",
    preparation: formData.get("preparation") ?? "na",
    brand: formData.get("brand") ?? "",
    kcal: formData.get("kcal"),
    protein: formData.get("protein"),
    carbs: formData.get("carbs"),
    fat: formData.get("fat"),
    fiber: formData.get("fiber"),
    sourceType: formData.get("sourceType") ?? "manual",
    sourceRef: formData.get("sourceRef") ?? "",
    validated: formData.get("validated") === "on",
    units: readUnits(formData),
    aliases: String(formData.get("aliases") ?? "")
      .split(/[,\n]/)
      .map((a) => a.trim())
      .filter(Boolean),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { error: "Revisá los campos marcados.", fieldErrors };
  }
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_food", {
    p_id: v.id,
    p_food: {
      name: v.name,
      preparation: v.preparation,
      brand: v.brand,
      kcal_per_100g: v.kcal,
      protein_per_100g: v.protein,
      carbs_per_100g: v.carbs,
      fat_per_100g: v.fat,
      fiber_per_100g: v.fiber,
      source_type: v.sourceType,
      source_ref: v.sourceRef,
      validated: v.validated,
    },
    p_units: v.units,
    p_aliases: v.aliases,
  });
  if (error) {
    if (error.code === "23505") return { error: "Ya tenés un alimento con ese nombre y preparación.", fieldErrors: { name: "Duplicado" } };
    return { error: "No se pudo guardar el alimento.", fieldErrors: {} };
  }
  revalidatePath("/alimentos");
  const back = String(formData.get("returnTo") ?? "");
  redirect(back.startsWith("/") && !back.startsWith("//") ? back : `/alimentos/${data}`);
}

export async function archiveFood(id: string, archived: boolean) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("foods")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", z.string().uuid().parse(id));
  if (error) throw new Error("No se pudo archivar");
  revalidatePath("/alimentos");
}

export async function deleteFood(id: string) {
  await requireUser();
  const supabase = await createClient();
  // Los registros históricos conservan su snapshot (food_id queda en null).
  const { error } = await supabase.from("foods").delete().eq("id", z.string().uuid().parse(id));
  if (error) throw new Error("No se pudo eliminar");
  revalidatePath("/alimentos");
  redirect("/alimentos");
}
