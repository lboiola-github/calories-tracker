"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { foodUnits, logItems } from "@/app/(app)/comidas/actions";
import { FoodPicker } from "@/components/food-picker";
import type { FoodSearchHit } from "@/lib/data/foods";
import { formatGrams, formatKcal, parseDecimal } from "@/lib/format";
import { MEAL_TYPES, type MealType } from "@/lib/meals";
import { newOperationId } from "@/lib/op-id";

type Line = { food: FoodSearchHit; quantity: string; unit: string; units: { name: string; grams: number }[] };

/**
 * Registro manual: buscar en el catálogo, elegir cantidad en gramos y registrar.
 * Funciona siempre, aunque la interpretación por IA no esté disponible.
 */
export function ManualLogger({ date, today, initialMeal, initialQuery }: { date: string; today: string; initialMeal: MealType; initialQuery: string }) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([]);
  const [meal, setMeal] = useState<MealType>(initialMeal);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const opId = useRef(newOperationId());

  const totalKcal = useMemo(() => lines.reduce((acc, l) => acc + lineKcal(l), 0), [lines]);

  const add = async (food: FoodSearchHit, knownUnits?: { name: string; grams: number }[]) => {
    opId.current = newOperationId(); // cambió el contenido: es un registro distinto
    if (lines.some((l) => l.food.id === food.id)) return;
    setLines((ls) => [...ls, { food, quantity: "", unit: "g", units: knownUnits ?? [] }]);
    if (knownUnits) return;
    const r = await foodUnits(food.id);
    if (r.ok && r.data.length > 0) {
      setLines((ls) => ls.map((l) => (l.food.id === food.id ? { ...l, units: r.data } : l)));
    }
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

      <FoodPicker
        initialQuery={initialQuery}
        onPick={add}
        onError={setError}
        createHref={(q) => `/alimentos/nuevo?nombre=${encodeURIComponent(q)}&volver=${encodeURIComponent(returnTo)}`}
      />

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
