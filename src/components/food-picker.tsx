"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { findReferences } from "@/app/(app)/alimentos/reference-actions";
import { addReferenceFood, findFoods } from "@/app/(app)/comidas/actions";
import type { FoodSearchHit } from "@/lib/data/foods";
import { formatKcal } from "@/lib/format";
import { preparationLabel } from "@/lib/meals";
import type { ReferenceSearchResult } from "@/lib/references/search";
import type { ReferenceCandidate } from "@/lib/references/types";

const SOURCE_LABEL = { usda: "USDA", off: "Open Food Facts" } as const;

export type PickedUnits = { name: string; grams: number }[];

/**
 * Buscador de alimentos: primero el catálogo; si no está, USDA y Open Food Facts.
 * Elegir una referencia la agrega al catálogo (valores pedidos de nuevo en el servidor).
 */
export function FoodPicker({
  initialQuery = "",
  onPick,
  onError,
  createHref,
  label = "Buscar alimento",
}: {
  initialQuery?: string;
  onPick: (food: FoodSearchHit, units?: PickedUnits) => void;
  onError: (message: string | null) => void;
  createHref?: (query: string) => string;
  label?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [hits, setHits] = useState<FoodSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [refs, setRefs] = useState<{ query: string; result: ReferenceSearchResult | null } | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      if (!q) {
        setHits([]);
        return;
      }
      setSearching(true);
      const r = await findFoods(q);
      if (mine !== seq.current) return; // llegó una búsqueda más nueva
      setSearching(false);
      if (r.ok) {
        setHits(r.data);
        // Sin resultados en el catálogo: buscar directamente en las referencias.
        if (r.data.length === 0 && q.length >= 3) searchRefs(q, mine);
      } else onError(r.error);
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function searchRefs(q: string, mine = seq.current) {
    setRefs({ query: q, result: null });
    let result: ReferenceSearchResult;
    try {
      result = await findReferences(q);
    } catch {
      result = { candidates: [], errors: [{ source: "usda", message: "No se pudo buscar. Probá de nuevo." }], usdaQuery: null };
    }
    if (mine !== seq.current) return;
    setRefs({ query: q, result });
  }

  const reset = () => {
    setQuery("");
    setHits([]);
    setRefs(null);
  };

  const pick = (h: FoodSearchHit, units?: PickedUnits) => {
    reset();
    onPick(h, units);
  };

  const addReference = async (c: ReferenceCandidate) => {
    setAdding(`${c.source}:${c.ref}`);
    onError(null);
    const r = await addReferenceFood({ source: c.source, ref: c.ref, typedName: query.trim() });
    setAdding(null);
    if (!r.ok) return onError(r.error);
    pick(r.data.hit, r.data.units);
  };

  const q = query.trim();
  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={label}
        aria-label={label}
        autoComplete="off"
        className="h-12 w-full rounded-2xl border border-line bg-surface px-4 text-[17px] outline-none focus:border-accent"
      />
      {q && (
        <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl bg-surface" aria-label="Resultados">
          {hits.map((h) => (
            <li key={h.id}>
              <button type="button" onClick={() => pick(h)} className="flex w-full justify-between gap-3 px-4 py-3 text-left active:bg-surface-2">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{h.name}</span>
                  <span className="block truncate text-sm text-ink-3">
                    {[h.preparation !== "na" ? preparationLabel(h.preparation) : null, h.brand, h.validated ? null : "sin validar"]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span className="tabular shrink-0 text-sm text-ink-2">{formatKcal(h.kcalPer100g)} kcal/100 g</span>
              </button>
            </li>
          ))}
          {!searching && hits.length === 0 && <li className="px-4 py-3 text-[15px] text-ink-2">No está en tu catálogo.</li>}
        </ul>
      )}
      {q && !searching && (
        <ReferenceResults
          state={refs?.query === q ? refs : null}
          adding={adding}
          onSearch={() => searchRefs(q)}
          onPick={addReference}
          createHref={createHref?.(q)}
          createLabel={`Crear “${q}” a mano`}
        />
      )}
    </div>
  );
}

function ReferenceResults({
  state,
  adding,
  onSearch,
  onPick,
  createHref,
  createLabel,
}: {
  state: { query: string; result: ReferenceSearchResult | null } | null;
  adding: string | null;
  onSearch: () => void;
  onPick: (c: ReferenceCandidate) => void;
  createHref?: string;
  createLabel: string;
}) {
  const create = createHref ? (
    <Link href={createHref} className="block border-t border-line px-4 py-3 text-[15px] font-medium text-accent">
      {createLabel}
    </Link>
  ) : null;
  if (!state) {
    return (
      <div className="mt-2 overflow-hidden rounded-2xl bg-surface">
        <button type="button" onClick={onSearch} className="block w-full px-4 py-3 text-left text-[15px] font-medium text-accent">
          Buscar en USDA y Open Food Facts
        </button>
        {create}
      </div>
    );
  }
  const { result } = state;
  return (
    <section aria-label="Referencias" className="mt-2 overflow-hidden rounded-2xl bg-surface">
      <p className="px-4 pt-3 text-xs font-medium uppercase tracking-wider text-ink-3">De USDA y Open Food Facts</p>
      {!result && <p className="px-4 py-3 text-[15px] text-ink-2">Buscando referencias…</p>}
      {result && (
        <>
          {result.usdaQuery && <p className="px-4 pt-1 text-sm text-ink-3">En USDA se buscó “{result.usdaQuery}”. Elegí la variante que corresponde a cómo lo pesás.</p>}
          <ul className="divide-y divide-line">
            {result.candidates.map((c) => {
              const key = `${c.source}:${c.ref}`;
              return (
                <li key={key}>
                  <button
                    type="button"
                    disabled={adding != null}
                    onClick={() => onPick(c)}
                    aria-label={`Agregar ${c.name}`}
                    className="flex w-full justify-between gap-3 px-4 py-3 text-left active:bg-surface-2 disabled:opacity-60"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium leading-snug">{c.name}</span>
                      <span className="block truncate text-sm text-ink-3">
                        {[SOURCE_LABEL[c.source], c.brand, c.source === "off" ? "colaborativo" : null].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="tabular shrink-0 text-sm text-ink-2">
                      {adding === key ? "Agregando…" : `${formatKcal(c.per100.kcal)} kcal/100 g`}
                    </span>
                  </button>
                </li>
              );
            })}
            {result.candidates.length === 0 && <li className="px-4 py-3 text-[15px] text-ink-2">Sin resultados en las referencias.</li>}
          </ul>
          {result.errors.map((e) => (
            <p key={e.source} className="px-4 pb-2 text-sm text-ink-3">
              {SOURCE_LABEL[e.source]}: {e.message}
            </p>
          ))}
        </>
      )}
      {create}
    </section>
  );
}
