import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isActivityKind, type ActivityKind } from "@/lib/activity/activity";

export type ActivityEntry = { id: string; kind: ActivityKind; km: number | null; weightKg: number | null; kcal: number };
export type DayActivity = { entries: ActivityEntry[]; burned: number };

type Row = { id: string; kind: string; distance_km: number | string | null; weight_kg: number | string | null; kcal: number | string };

const num = (v: number | string | null) => (v == null ? null : Number(v));

/** Actividades vigentes de un día (RLS filtra por usuario). */
export async function loadDayActivity(supabase: SupabaseClient, date: string): Promise<DayActivity> {
  const { data, error } = await supabase
    .from("activity_entries")
    .select("id, kind, distance_km, weight_kg, kcal")
    .eq("entry_date", date)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .returns<Row[]>();
  if (error) throw error;
  const entries = (data ?? [])
    .filter((r) => isActivityKind(r.kind))
    .map((r) => ({ id: r.id, kind: r.kind as ActivityKind, km: num(r.distance_km), weightKg: num(r.weight_kg), kcal: Number(r.kcal) }));
  return { entries, burned: entries.reduce((s, e) => s + e.kcal, 0) };
}

/** Peso para la fórmula: el último registrado hasta esa fecha, o el más antiguo posterior si no hay. */
export async function weightForDate(supabase: SupabaseClient, date: string): Promise<number | null> {
  const before = await supabase
    .from("weight_entries")
    .select("weight_kg")
    .lte("entry_date", date)
    .order("entry_date", { ascending: false })
    .limit(1)
    .maybeSingle<{ weight_kg: number | string }>();
  if (before.error) throw before.error;
  if (before.data) return Number(before.data.weight_kg);
  const after = await supabase
    .from("weight_entries")
    .select("weight_kg")
    .gt("entry_date", date)
    .order("entry_date", { ascending: true })
    .limit(1)
    .maybeSingle<{ weight_kg: number | string }>();
  if (after.error) throw after.error;
  return after.data ? Number(after.data.weight_kg) : null;
}
