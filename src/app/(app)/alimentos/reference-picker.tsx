"use client";

import { useState, useTransition } from "react";
import { formatGrams, formatKcal } from "@/lib/format";
import type { ReferenceSearchResult } from "@/lib/references/search";
import type { ReferenceCandidate } from "@/lib/references/types";
import { findReferences } from "./reference-actions";

const SOURCE_LABEL = { usda: "USDA", off: "Open Food Facts" } as const;

export function ReferencePicker({ initialQuery, onPick }: { initialQuery: string; onPick: (c: ReferenceCandidate) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [result, setResult] = useState<ReferenceSearchResult | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const search = () => {
    if (query.trim().length < 2) return;
    start(async () => {
      try {
        setResult(await findReferences(query));
      } catch {
        setResult({ candidates: [], errors: [{ source: "usda", message: "No se pudo buscar. Probá de nuevo." }], usdaQuery: null });
      }
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          if (initialQuery.trim().length >= 2 && !result) search();
        }}
        className="w-full rounded-2xl bg-surface p-4 text-left"
      >
        <span className="block text-[15px] font-medium text-accent">Buscar valores en USDA u Open Food Facts</span>
        <span className="block text-sm text-ink-2">Por nombre o código de barras. Revisás antes de guardar.</span>
      </button>
    );
  }

  return (
    <section aria-label="Buscar referencias" className="rounded-2xl bg-surface p-4">
      <div className="flex gap-2">
        <input
          type="search"
          aria-label="Buscar referencia"
          value={query}
          enterKeyHint="search"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              search();
            }
          }}
          placeholder="pechuga de pollo, 7790…"
          className="h-12 min-w-0 flex-1 rounded-2xl border border-line bg-bg px-4 text-[17px] outline-none focus:border-accent"
        />
        <button type="button" onClick={search} disabled={pending} className="h-12 shrink-0 rounded-2xl bg-ink px-4 font-medium text-bg disabled:opacity-60">
          {pending ? "Buscando…" : "Buscar"}
        </button>
      </div>
      {result?.usdaQuery && result.usdaQuery !== query.trim() && (
        <p className="mt-2 text-xs text-ink-3">En USDA se buscó: “{result.usdaQuery}”.</p>
      )}
      {result?.errors.map((e) => (
        <p key={e.source} className="mt-2 text-sm text-danger">
          {SOURCE_LABEL[e.source]}: {e.message}
        </p>
      ))}
      {result && !pending && result.candidates.length === 0 && result.errors.length === 0 && (
        <p className="mt-3 text-sm text-ink-2">Sin resultados. Probá con otras palabras o cargá los valores de la etiqueta.</p>
      )}
      {result && result.candidates.length > 0 && (
        <ul className="mt-3 divide-y divide-line">
          {result.candidates.map((c) => {
            const key = `${c.source}:${c.ref}`;
            return (
              <li key={key} className="py-3">
                <p className="text-[15px] font-medium leading-snug">{c.name}</p>
                <p className="text-xs text-ink-3">
                  {SOURCE_LABEL[c.source]}
                  {c.source === "usda" ? ` · ${c.detail}` : ""}
                  {c.brand ? ` · ${c.brand}` : ""}
                </p>
                <p className="tabular mt-1 text-sm text-ink-2">
                  100 g: {formatKcal(c.per100.kcal)} kcal · P {formatGrams(c.per100.protein, 1)} · C {formatGrams(c.per100.carbs, 1)} · G{" "}
                  {formatGrams(c.per100.fat, 1)}
                </p>
                {c.warnings
                  .filter((w) => /no coinciden|por porción/.test(w))
                  .map((w) => (
                    <p key={w} className="mt-1 text-xs text-danger">
                      {w}
                    </p>
                  ))}
                <div className="mt-2 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      onPick(c);
                      setPicked(key);
                    }}
                    className="text-[15px] font-medium text-accent"
                  >
                    {picked === key ? "✓ Valores cargados" : "Usar estos valores"}
                  </button>
                  <a href={c.url} target="_blank" rel="noreferrer" className="text-sm text-ink-3 underline">
                    Ver fuente
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-xs text-ink-3">
        Datos de USDA FoodData Central (dominio público) y de Open Food Facts (licencia ODbL, colaborativos).
      </p>
    </section>
  );
}
