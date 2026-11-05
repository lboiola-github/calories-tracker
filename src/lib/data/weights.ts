import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const PHOTO_BUCKET = "weight-photos";

export type WeightEntry = {
  id: string;
  date: string;
  kg: number;
  notes: string | null;
  photos: { id: string; path: string; url: string | null }[];
};

type Row = {
  id: string;
  entry_date: string;
  weight_kg: number | string;
  notes: string | null;
  weight_photos?: { id: string; storage_path: string; created_at: string }[];
};

/**
 * Registros de peso (más nuevos primero). Las fotos se devuelven con URLs firmadas de 10 minutos,
 * generadas para el usuario actual; el bucket es privado y no hay URLs permanentes.
 */
export async function listWeights(supabase: SupabaseClient, opts: { limit?: number; photosFor?: number } = {}): Promise<WeightEntry[]> {
  const { data, error } = await supabase
    .from("weight_entries")
    .select("id, entry_date, weight_kg, notes, weight_photos(id, storage_path, created_at)")
    .order("entry_date", { ascending: false })
    .limit(opts.limit ?? 400)
    .returns<Row[]>();
  if (error) throw error;
  const rows = data ?? [];

  const withPhotos = rows.slice(0, opts.photosFor ?? 20);
  const paths = withPhotos.flatMap((r) => (r.weight_photos ?? []).map((p) => p.storage_path));
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }

  return rows.map((r, i) => ({
    id: r.id,
    date: r.entry_date,
    kg: Number(r.weight_kg),
    notes: r.notes,
    photos:
      i < withPhotos.length
        ? (r.weight_photos ?? [])
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
            .map((p) => ({ id: p.id, path: p.storage_path, url: urls.get(p.storage_path) ?? null }))
        : [],
  }));
}
