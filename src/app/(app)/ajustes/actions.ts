"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { loadMetabolicState, syncTodayTarget } from "@/lib/data/metabolism";
import { isIsoDate } from "@/lib/dates";
import { parseDecimal } from "@/lib/format";
import { ACTIVITY_LEVELS, DEFICIT_OPTIONS, type ActivityLevel } from "@/lib/metabolism/config";
import { createClient } from "@/lib/supabase/server";

export type SettingsState = { status: "idle" | "saved" | "error"; message: string | null; fieldErrors: Record<string, string> };

const decimal = (min: number, max: number, label: string) =>
  z
    .unknown()
    .transform((v) => (v === "" || v == null ? null : parseDecimal(v)))
    .refine((v) => v === null || (v >= min && v <= max), { message: `${label}: entre ${min} y ${max}` });

const schema = z.object({
  birthDate: z
    .string()
    .transform((v) => v.trim() || null)
    .refine((v) => v === null || isIsoDate(v), { message: "Fecha inválida" }),
  sex: z.enum(["female", "male"]).nullable().catch(null),
  heightCm: decimal(100, 250, "Altura"),
  weightKg: decimal(20, 400, "Peso"),
  activityLevel: z
    .string()
    .nullable()
    .transform((v) => (ACTIVITY_LEVELS.some((a) => a.key === v) ? (v as ActivityLevel) : null)),
  deficitKcal: z.coerce
    .number()
    .refine((d) => (DEFICIT_OPTIONS as readonly number[]).includes(d), { message: "Déficit inválido" }),
  targetMode: z.enum(["auto", "manual"]),
  targetManual: decimal(800, 8000, "Objetivo"),
  bmrManual: decimal(500, 5000, "BMR"),
  tdeeManual: decimal(800, 8000, "TDEE"),
});

export async function saveSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await requireUser();
  const raw = Object.fromEntries(
    ["birthDate", "sex", "heightCm", "weightKg", "activityLevel", "deficitKcal", "targetMode", "targetManual", "bmrManual", "tdeeManual"].map(
      (k) => [k, formData.get(k) ?? ""],
    ),
  );
  const parsed = schema.safeParse({ ...raw, sex: raw.sex || null, activityLevel: raw.activityLevel || null });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { status: "error", message: "Revisá los campos marcados.", fieldErrors };
  }
  const v = parsed.data;
  if (v.targetMode === "manual" && v.targetManual == null) {
    return { status: "error", message: "Ingresá el objetivo manual.", fieldErrors: { targetManual: "Requerido" } };
  }

  const supabase = await createClient();
  const before = await loadMetabolicState(supabase, user.id);

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ birth_date: v.birthDate, sex: v.sex, height_cm: v.heightCm, activity_level: v.activityLevel })
    .eq("id", user.id);
  if (profileError) return { status: "error", message: "No se pudo guardar el perfil.", fieldErrors: {} };

  const { error: settingsError } = await supabase.from("metabolic_settings").upsert({
    user_id: user.id,
    deficit_kcal: v.deficitKcal,
    target_manual: v.targetMode === "manual" ? Math.round(v.targetManual!) : null,
    bmr_manual: v.bmrManual,
    tdee_manual: v.tdeeManual,
  });
  if (settingsError) return { status: "error", message: "No se pudo guardar la configuración.", fieldErrors: {} };

  // Un peso distinto al último registrado se guarda como el peso de hoy.
  if (v.weightKg != null && v.weightKg !== before.latestWeight?.kg) {
    const { error } = await supabase
      .from("weight_entries")
      .upsert({ user_id: user.id, entry_date: before.today, weight_kg: v.weightKg }, { onConflict: "user_id,entry_date" });
    if (error) return { status: "error", message: "No se pudo guardar el peso.", fieldErrors: {} };
  }

  try {
    await syncTodayTarget(supabase, await loadMetabolicState(supabase, user.id));
  } catch {
    return { status: "error", message: "Se guardaron los datos, pero no el objetivo de hoy. Probá de nuevo.", fieldErrors: {} };
  }

  revalidatePath("/", "layout");
  return { status: "saved", message: "Guardado", fieldErrors: {} };
}
