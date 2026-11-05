"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { findReferences } from "@/app/(app)/alimentos/reference-actions";
import { addReferenceFood, findFoods, foodUnits, logItems } from "@/app/(app)/comidas/actions";
import type { FoodSearchHit } from "@/lib/data/foods";
import { formatGrams, formatKcal, parseDecimal } from "@/lib/format";
import { MEAL_TYPES, preparationLabel, type MealType } from "@/lib/meals";
import { newOperationId } from "@/lib/op-id";
import type { ReferenceSearchResult } from "@/lib/references/search";
import type { ReferenceCandidate } from "@/lib/references/types";

const SOURCE_LABEL = { usda: "USDA", off: "Open Food Facts" } as const;

type Line = { food: FoodSearchHit; quantity: string; unit: string; units: { name: string; grams: number }[] };

/**
 * Registro manual: buscar en el catálogo, elegir cantidad en gramos y registrar.
 * Funciona siempre, aunque la interpretación por IA no esté disponible.
 */
export function ManualLogger({ date, today, initialMeal, initialQuery }: { date: string; today: string; initialMeal: MealType; initialQuery: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [hits, setHits] = useState<FoodSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [meal, setMeal] = useState<MealType>(initialMeal);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const opId = useRef(newOperationId());
  const seq = useRef(0);
  // Referencias externas (USDA / Open Food Facts) para lo que no está en el catálogo.
  const [refs, setRefs] = useState<{ query: string; result: ReferenceSearchResult | null } | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

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
      } else setError(r.error);
    }, 400);
    return () => clearTimeout(t);
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

  const totalKcal = useMemo(() => lines.reduce((acc, l) => acc + lineKcal(l), 0), [lines]);

  const add = async (food: FoodSearchHit, knownUnits?: { name: string; grams: number }[]) => {
    setQuery("");
    setHits([]);
    setRefs(null);
    opId.current = newOperationId(); // cambió el contenido: es un registro distinto
    if (lines.some((l) => l.food.id === food.id)) return;
    setLines((ls) => [...ls, { food, quantity: "", unit: "g", units: knownUnits ?? [] }]);
    if (knownUnits) return;
    const r = await foodUnits(food.id);
    if (r.ok && r.data.length > 0) {
      setLines((ls) => ls.map((l) => (l.food.id === food.id ? { ...l, units: r.data } : l)));
    }
  };

  const addReference = async (c: ReferenceCandidate) => {
    const key = `${c.source}:${c.ref}`;
    setAdding(key);
    setError(null);
    const r = await addReferenceFood({ source: c.source, ref: c.ref, typedName: query.trim() });
    setAdding(null);
    if (!r.ok) return setError(r.error);
    await add(r.data.hit, r.data.units);
  };

  const submit = () => {
    const items: { foodId: string; quantity: number; unit: string }[] = [];
    for (const l of lines) {
      const g = parseDecimal(l.quantity);
      if (g == null || g <= 0) return setError(`Falta la cantidad de “${l.food.name}”.`);
      items.push({ foodId: l.food.id, quantity: g, unit: l.unit });
    }
    setError(null);
    start(async () => {
      const r = await logItems({ operationId: opId.current, date, mealType: meal, items });
      if (!r.ok) return setError(r.error);
      router.push(date === today ? "/" : `/historial?fecha=${date}`);
      router.refresh();
    });
  };

  const returnTo = `/registrar?fecha=${date}&comida=${meal}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Comida">
        {MEAL_TYPES.map((m) => (
          <button
            key={m.key}
            type="button"
            role="radio"
            aria-checked={meal === m.key}
            onClick={() => setMeal(m.key)}
            className={`rounded-full px-3.5 py-2 text-[15px] ${meal === m.key ? "bg-ink text-bg" : "bg-surface text-ink-2"}`}
          >
            {m.label}
          </button>
        ))}
      </div>
      {date !== today && <p className="text-sm text-ink-2">Se registra en el día {date}.</p>}

      <div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar alimento"
          aria-label="Buscar alimento"
          autoComplete="off"
          className="h-12 w-full rounded-2xl border border-line bg-surface px-4 text-[17px] outline-none focus:border-accent"
        />
        {query.trim() && (
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl bg-surface" aria-label="Resultados">
            {hits.map((h) => (
              <li key={h.id}>
                <button type="button" onClick={() => add(h)} className="flex w-full justify-between gap-3 px-4 py-3 text-left active:bg-surface-2">
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
        {query.trim() && !searching && (
          <ReferenceResults
            state={refs?.query === query.trim() ? refs : null}
            adding={adding}
            onSearch={() => searchRefs(query.trim())}
            onPick={addReference}
            createHref={`/alimentos/nuevo?nombre=${encodeURIComponent(query.trim())}&volver=${encodeURIComponent(returnTo)}`}
            createLabel={`Crear “${query.trim()}” a mano`}
          />
        )}
      </div>

      {lines.length > 0 && (
        <ul className="space-y-2" aria-label="Para registrar">
          {lines.map((l, i) => {
            const g = parseDecimal(l.quantity);
            return (
              <li key={l.food.id} className="rounded-2xl bg-surface p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-medium">{l.food.name}</span>
                  <button
                    type="button"
                    aria-label={`Quitar ${l.food.name}`}
                    onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                    className="text-ink-3"
                  >
                    ×
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    inputMode="decimal"
                    aria-label={`Cantidad de ${l.food.name}`}
                    value={l.quantity}
                    onChange={(e) => {
                      const value = e.target.value;
                      setLines((ls) => ls.map((x, j) => (j === i ? { ...x, quantity: value } : x)));
                    }}
                    placeholder="0"
                    className="tabular h-11 w-28 rounded-xl border border-line bg-bg px-3 text-[17px] outline-none focus:border-accent"
                  />
                  {l.units.length > 0 ? (
                    <select
                      aria-label={`Unidad de ${l.food.name}`}
                      value={l.unit}
                      onChange={(e) => {
                        const unit = e.target.value;
                        setLines((ls) => ls.map((x, j) => (j === i ? { ...x, unit } : x)));
                      }}
                      className="h-11 rounded-xl border border-line bg-bg px-2 text-[17px]"
                    >
                      <option value="g">g</option>
                      {l.units.map((u) => (
                        <option key={u.name} value={u.name}>
                          {u.name} ({formatGrams(u.grams)} g)
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-ink-2">g</span>
                  )}
                  <span className="tabular ml-auto text-sm text-ink-2">{g != null && g > 0 ? `${formatKcal(lineKcal(l))} kcal` : ""}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {lines.length > 0 && (
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="h-13 w-full rounded-2xl bg-accent text-[17px] font-semibold text-accent-ink disabled:opacity-60"
        >
          {pending ? "Registrando…" : `Registrar · ${formatKcal(totalKcal)} kcal`}
        </button>
      )}
    </div>
  );
}

function lineKcal(l: Line): number {
  const q = parseDecimal(l.quantity);
  if (q == null || q <= 0) return 0;
  const grams = l.unit === "g" ? q : q * (l.units.find((u) => u.name === l.unit)?.grams ?? 0);
  return (grams * l.food.kcalPer100g) / 100;
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
  createHref: string;
  createLabel: string;
}) {
  const create = (
    <Link href={createHref} className="block px-4 py-3 text-[15px] font-medium text-accent">
      {createLabel}
    </Link>
  );
  if (!state) {
    return (
      <div className="mt-2 overflow-hidden rounded-2xl bg-surface">
        <button type="button" onClick={onSearch} className="block w-full px-4 py-3 text-left text-[15px] font-medium text-accent">
          Buscar en USDA y Open Food Facts
        </button>
        <div className="border-t border-line">{create}</div>
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
      <div className="border-t border-line">{create}</div>
    </section>
  );
}
