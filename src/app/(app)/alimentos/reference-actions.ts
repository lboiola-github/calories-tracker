"use server";

import { requireUser } from "@/lib/auth";
import { searchReferences, type ReferenceSearchResult } from "@/lib/references/search";

/** Busca valores de referencia. No guarda nada: el usuario revisa y guarda desde el formulario. */
export async function findReferences(query: string): Promise<ReferenceSearchResult> {
  await requireUser();
  if (typeof query !== "string") return { candidates: [], errors: [], usdaQuery: null };
  return searchReferences(query);
}
