"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/(app)/comidas/actions";
import { activityKind, distanceKcal, isActivityKind, type ActivityKind } from "@/lib/activity/activity";
import { requireUser } from "@/lib/auth";
import { weightForDate } from "@/lib/data/activity";
import { loadMetabolicState } from "@/lib/data/metabolism";
import { isIsoDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

const addSchema = z.object({
  operationId: z.string().uuid(),
  date: z.string().refine(isIsoDate),
  kind: z.custom<ActivityKind>(isActivityKind),
  km: z.number().positive().max(200).nullable(),
  kcal: z.number().positive().max(10000).nullable(),
});

/** Peso que usaría la fórmula ese día (para mostrar el cálculo antes de guardar). */
export async function activityWeight(date: string): Promise<ActionResult<number | null>> {
  await requireUser();
  if (!isIsoDate(date)) return { ok: false, error: "Fecha inválida." };
  try {
    return { ok: true, data: await weightForDate(await createClient(), date) };
  } catch {
    return { ok: false, error: "No se pudo leer el peso." };
  }
}

export async function addActivity(input: z.input<typeof addSchema>): Promise<ActionResult<{ kcal: number }>> {
  const user = await requireUser();
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisá los datos de la actividad." };
  const v = parsed.data;
  const supabase = await createClient();
  const state = await loadMetabolicState(supabase, user.id);
  if (v.date > state.today) return { ok: false, error: "No se puede cargar actividad de un día futuro." };

  let kcal: number;
  let weightKg: number | null = null;
  if (activityKind(v.kind).byDistance) {
    if (v.km == null) return { ok: false, error: "Ingresá los km." };
    weightKg = await weightForDate(supabase, v.date);
    if (weightKg == null) return { ok: false, error: "Para calcular hace falta un peso registrado. Cargalo en Peso." };
    kcal = distanceKcal(v.kind, v.km, weightKg)!;
  } else {
    if (v.kcal == null) return { ok: false, error: "Ingresá las kcal." };
    kcal = Math.round(v.kcal * 10) / 10;
  }

  const { error } = await supabase.from("activity_entries").upsert(
    {
      user_id: user.id,
      entry_date: v.date,
      kind: v.kind,
      distance_km: activityKind(v.kind).byDistance ? Math.round(v.km! * 100) / 100 : null,
      weight_kg: weightKg,
      kcal,
      operation_id: v.operationId,
    },
    { onConflict: "user_id,operation_id", ignoreDuplicates: true },
  );
  if (error) return { ok: false, error: "No se pudo guardar la actividad." };
  revalidatePath("/");
  revalidatePath("/historial");
  return { ok: true, data: { kcal } };
}

/** Quita (o restaura) una actividad. Borrado lógico: idempotente por naturaleza. */
export async function setActivityDeleted(id: string, deleted: boolean): Promise<ActionResult<null>> {
  await requireUser();
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Datos inválidos." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("activity_entries")
    .update({ deleted_at: deleted ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { ok: false, error: "No se pudo actualizar la actividad." };
  revalidatePath("/");
  revalidatePath("/historial");
  return { ok: true, data: null };
}
