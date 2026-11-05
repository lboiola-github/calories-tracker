"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { loadMetabolicState, syncTodayTarget } from "@/lib/data/metabolism";
import { PHOTO_BUCKET } from "@/lib/data/weights";
import { isIsoDate } from "@/lib/dates";
import { parseDecimal } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export type WeightFormState = { status: "idle" | "saved" | "error"; message: string | null; fieldErrors: Record<string, string> };

const MAX_PHOTOS = 4;
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

const schema = z.object({
  date: z.string().refine(isIsoDate, "Fecha inválida"),
  kg: z
    .unknown()
    .transform((v) => parseDecimal(v))
    .refine((v): v is number => v != null && v >= 20 && v <= 400, "Ingresá un peso entre 20 y 400 kg"),
  notes: z.string().trim().max(1000),
});

/** Sincroniza el objetivo de hoy (usa el último peso). Si falla, el peso igual quedó guardado. */
async function resyncTarget(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<boolean> {
  try {
    await syncTodayTarget(supabase, await loadMetabolicState(supabase, userId));
    return true;
  } catch {
    return false;
  }
}

/** Guarda el peso de un día (reemplaza el de ese día si ya había) y, opcionalmente, fotos privadas. */
export async function saveWeight(_prev: WeightFormState, formData: FormData): Promise<WeightFormState> {
  const user = await requireUser();
  const parsed = schema.safeParse({ date: formData.get("date") ?? "", kg: formData.get("kg"), notes: formData.get("notes") ?? "" });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { status: "error", message: "Revisá los campos marcados.", fieldErrors };
  }
  const v = parsed.data;
  const photos = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (photos.length > MAX_PHOTOS) return { status: "error", message: `Hasta ${MAX_PHOTOS} fotos por vez.`, fieldErrors: {} };
  if (photos.some((p) => !PHOTO_TYPES.includes(p.type) || p.size > MAX_PHOTO_BYTES)) {
    return { status: "error", message: "Las fotos deben ser JPG, PNG o WebP de hasta 3 MB.", fieldErrors: {} };
  }

  const supabase = await createClient();
  const state = await loadMetabolicState(supabase, user.id);
  if (v.date > state.today) return { status: "error", message: "No se puede cargar un peso de un día futuro.", fieldErrors: { date: "Fecha futura" } };

  const { data: entry, error } = await supabase
    .from("weight_entries")
    .upsert({ user_id: user.id, entry_date: v.date, weight_kg: Math.round(v.kg * 100) / 100, notes: v.notes || null }, { onConflict: "user_id,entry_date" })
    .select("id")
    .single<{ id: string }>();
  if (error || !entry) return { status: "error", message: "No se pudo guardar el peso.", fieldErrors: {} };

  let failedPhotos = 0;
  for (const photo of photos) {
    const path = `${user.id}/${entry.id}/${crypto.randomUUID()}.${EXT[photo.type]}`;
    const up = await supabase.storage.from(PHOTO_BUCKET).upload(path, photo, { contentType: photo.type, upsert: false });
    if (up.error) {
      failedPhotos++;
      continue;
    }
    const { error: rowError } = await supabase.from("weight_photos").insert({ user_id: user.id, entry_id: entry.id, storage_path: path });
    if (rowError) {
      failedPhotos++;
      await supabase.storage.from(PHOTO_BUCKET).remove([path]);
    }
  }

  const synced = await resyncTarget(supabase, user.id);
  revalidatePath("/", "layout");
  if (failedPhotos > 0) return { status: "error", message: `Se guardó el peso, pero no ${failedPhotos === 1 ? "una foto" : `${failedPhotos} fotos`}. Probá de nuevo.`, fieldErrors: {} };
  if (!synced) return { status: "error", message: "Se guardó el peso, pero no se actualizó el objetivo de hoy.", fieldErrors: {} };
  return { status: "saved", message: "Guardado", fieldErrors: {} };
}

const uuid = z.string().uuid();

export async function deleteWeight(id: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Datos inválidos." };
  const supabase = await createClient();
  const { data: photos } = await supabase.from("weight_photos").select("storage_path").eq("entry_id", id);
  const paths = (photos ?? []).map((p) => p.storage_path as string);
  if (paths.length > 0) {
    const { error } = await supabase.storage.from(PHOTO_BUCKET).remove(paths);
    if (error) return { ok: false, error: "No se pudieron quitar las fotos. Probá de nuevo." };
  }
  const { error } = await supabase.from("weight_entries").delete().eq("id", id);
  if (error) return { ok: false, error: "No se pudo eliminar el registro." };
  await resyncTarget(supabase, user.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deletePhoto(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireUser();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Datos inválidos." };
  const supabase = await createClient();
  const { data: photo } = await supabase.from("weight_photos").select("storage_path").eq("id", id).maybeSingle<{ storage_path: string }>();
  if (!photo) return { ok: false, error: "La foto ya no existe." };
  const { error: sErr } = await supabase.storage.from(PHOTO_BUCKET).remove([photo.storage_path]);
  if (sErr) return { ok: false, error: "No se pudo quitar la foto." };
  await supabase.from("weight_photos").delete().eq("id", id);
  revalidatePath("/peso");
  return { ok: true };
}
