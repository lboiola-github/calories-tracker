import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_DEFICIT, type ActivityLevel } from "@/lib/metabolism/config";
import {
  resolveMetabolism,
  roundKcal,
  targetWarnings,
  type MetabolicInputs,
  type MetabolicResult,
  type Sex,
  type TargetWarning,
} from "@/lib/metabolism/metabolism";
import { DEFAULT_TIMEZONE, localDate } from "@/lib/dates";

export type MetabolicState = {
  today: string;
  timezone: string;
  inputs: MetabolicInputs;
  latestWeight: { date: string; kg: number } | null;
  result: MetabolicResult;
  warnings: TargetWarning[];
};

type ProfileRow = {
  birth_date: string | null;
  sex: Sex | null;
  height_cm: number | string | null;
  activity_level: ActivityLevel | null;
  timezone: string | null;
};
type SettingsRow = {
  deficit_kcal: number;
  bmr_manual: number | string | null;
  tdee_manual: number | string | null;
  target_manual: number | null;
};

const num = (v: number | string | null | undefined) => (v == null ? null : Number(v));

/** Lee perfil, configuración y último peso del usuario actual (RLS filtra por usuario). */
export async function loadMetabolicState(supabase: SupabaseClient, userId: string): Promise<MetabolicState> {
  const [profileRes, settingsRes, weightRes] = await Promise.all([
    supabase.from("profiles").select("birth_date, sex, height_cm, activity_level, timezone").eq("id", userId).maybeSingle<ProfileRow>(),
    supabase.from("metabolic_settings").select("deficit_kcal, bmr_manual, tdee_manual, target_manual").eq("user_id", userId).maybeSingle<SettingsRow>(),
    supabase.from("weight_entries").select("entry_date, weight_kg").order("entry_date", { ascending: false }).limit(1).maybeSingle<{ entry_date: string; weight_kg: number | string }>(),
  ]);
  for (const r of [profileRes, settingsRes, weightRes]) if (r.error) throw r.error;

  const profile = profileRes.data;
  const settings = settingsRes.data;
  const timezone = profile?.timezone ?? DEFAULT_TIMEZONE;
  const today = localDate(new Date(), timezone);
  const latestWeight = weightRes.data ? { date: weightRes.data.entry_date, kg: Number(weightRes.data.weight_kg) } : null;

  const inputs: MetabolicInputs = {
    birthDate: profile?.birth_date ?? null,
    sex: profile?.sex ?? null,
    heightCm: num(profile?.height_cm),
    weightKg: latestWeight?.kg ?? null,
    activityLevel: profile?.activity_level ?? null,
    bmrManual: num(settings?.bmr_manual),
    tdeeManual: num(settings?.tdee_manual),
    targetManual: settings?.target_manual ?? null,
    deficitKcal: settings?.deficit_kcal ?? DEFAULT_DEFICIT,
  };
  const result = resolveMetabolism(inputs, today);
  const warnings = targetWarnings({
    target: result.target.value,
    tdee: result.tdee.value,
    bmr: result.bmr.value,
    sex: inputs.sex,
  });
  return { today, timezone, inputs, latestWeight, result, warnings };
}

/**
 * Recalcula y guarda el objetivo vigente desde hoy. Respeta los valores manuales
 * y nunca toca días anteriores (la fecha la fija la base de datos).
 */
export async function syncTodayTarget(supabase: SupabaseClient, state: MetabolicState): Promise<void> {
  const { result, inputs } = state;
  if (result.target.value == null) return;
  const round1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);
  const { error } = await supabase.rpc("set_today_target", {
    p_target_kcal: roundKcal(result.target.value),
    p_target_source: result.target.source,
    p_bmr_kcal: round1(result.bmr.value),
    p_bmr_source: result.bmr.value == null ? null : result.bmr.source,
    p_tdee_kcal: round1(result.tdee.value),
    p_tdee_source: result.tdee.value == null ? null : result.tdee.source,
    p_deficit_kcal: result.target.source === "auto" ? inputs.deficitKcal : null,
    p_weight_kg: inputs.weightKg,
    p_activity_level: inputs.activityLevel,
  });
  if (error) throw error;
}

/** Objetivo vigente en una fecha local (YYYY-MM-DD), o null si nunca se definió. */
export async function targetFor(supabase: SupabaseClient, date: string): Promise<number | null> {
  const { data, error } = await supabase.rpc("target_for", { p_date: date });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row?.target_kcal ?? null;
}
