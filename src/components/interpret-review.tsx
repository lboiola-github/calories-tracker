"use client";

import { useRef, useState, useTransition } from "react";
import { logItems, setItemDeleted } from "@/app/(app)/comidas/actions";
import type { Interpreted } from "@/app/(app)/comidas/interpret-actions";
import { FoodPicker, type PickedUnits } from "@/components/food-picker";
import type { ResolvedItem } from "@/lib/ai/resolve";
import type { FoodSearchHit } from "@/lib/data/foods";
import { formatGrams, formatKcal, parseDecimal } from "@/lib/format";
import {
  MEAL_TYPES,
  mealLabel,
  preparationLabel,
  type MealType,
} from "@/lib/meals";
import { toGrams } from "@/lib/nutrition/calc";
import { newOperationId } from "@/lib/op-id";

type Row = {
  key: number;
  fragment: string;
  food: string;
  preparation: string | null;
  note: string | null;
  match: FoodSearchHit | null;
  units: PickedUnits;
  quantity: string;
  unit: string;
};

const toRow = (it: ResolvedItem, key: number): Row => ({
  key,
  fragment: it.fragment,
  food: it.food,
  preparation: it.preparation,
  note: it.note,
  match: it.match,
  units: it.units,
  quantity: it.quantity == null ? "" : String(it.quantity).replace(".", ","),
  unit: it.unit,
});

const rowGrams = (r: Row) => {
  const q = parseDecimal(r.quantity);
  return q == null || q <= 0 ? null : toGrams(q, r.unit, r.units);
};

export type LoggedSummary = {
  itemIds: string[];
  date: string;
  meal: MealType;
  lines: { name: string; grams: number; kcal: number }[];
};

/** Lo que se registró directo: Aceptar (por defecto) o Editar / Deshacer. */
export function LoggedCard({
  summary,
  onAccept,
  onUndone,
}: {
  summary: LoggedSummary;
  onAccept: () => void;
  onUndone: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const total = summary.lines.reduce((a, l) => a + l.kcal, 0);
  return (
    <section aria-label="Registrado" className="space-y-3">
      <p className="text-sm text-ink-2">
        Registrado en {mealLabel(summary.meal).toLowerCase()}:
      </p>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface-2">
        {summary.lines.map((l, i) => (
          <li key={i} className="flex justify-between gap-3 px-4 py-3">
            <span className="min-w-0 truncate">
              {l.name}{" "}
              <span className="text-ink-3">· {formatGrams(l.grams)} g</span>
            </span>
            <span className="tabular shrink-0 text-ink-2">
              {formatKcal(l.kcal)} kcal
            </span>
          </li>
        ))}
      </ul>
      <p
        className="tabular text-right font-semibold"
        data-testid="logged-total"
      >
        {formatKcal(total)} kcal
      </p>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              for (const id of summary.itemIds) {
                const r = await setItemDeleted({
                  operationId: newOperationId(),
                  itemId: id,
                  deleted: true,
                });
                if (!r.ok) return setError(r.error);
              }
              onUndone();
            })
          }
          className="h-12 rounded-2xl bg-surface-2 font-medium"
        >
          Editar
        </button>
        <button
          type="button"
          autoFocus
          onClick={onAccept}
          className="h-12 rounded-2xl bg-accent font-semibold text-accent-ink"
        >
          Aceptar
        </button>
      </div>
    </section>
  );
}

/** Revisión antes de registrar: elegir alimento donde no hubo coincidencia y completar cantidades. */
export function InterpretReview({
  result,
  onLogged,
}: {
  result: Interpreted;
  onLogged: (s: LoggedSummary) => void;
}) {
  const [rows, setRows] = useState<Row[]>(() => result.items.map(toRow));
  const [meal, setMeal] = useState<MealType>(result.mealType);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const opId = useRef(newOperationId());

  const update = (key: number, patch: Partial<Row>) => {
    opId.current = newOperationId();
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const submit = () => {
    const items: { foodId: string; quantity: number; unit: string }[] = [];
    for (const r of rows) {
      if (!r.match) return setError(`Elegí el alimento para “${r.food}”.`);
      const q = parseDecimal(r.quantity);
      if (q == null || q <= 0)
        return setError(`Falta la cantidad de “${r.match.name}”.`);
      if (rowGrams(r) == null)
        return setError(
          `“${r.match.name}” no tiene la unidad “${r.unit}”: elegí otra.`,
        );
      items.push({ foodId: r.match.id, quantity: q, unit: r.unit });
    }
    if (items.length === 0) return setError("No hay nada para registrar.");
    setError(null);
    start(async () => {
      const res = await logItems({
        operationId: opId.current,
        date: result.date,
        mealType: meal,
        items,
      });
      if (!res.ok) return setError(res.error);
      onLogged({
        itemIds: res.data.itemIds,
        date: result.date,
        meal,
        lines: rows.map((r) => {
          const g = rowGrams(r)!;
          return {
            name: r.match!.name,
            grams: g,
            kcal: (g * r.match!.kcalPer100g) / 100,
          };
        }),
      });
    });
  };

  return (
    <section aria-label="Revisar" className="space-y-3">
      <div
        className="flex flex-wrap gap-1.5"
        role="radiogroup"
        aria-label="Comida"
      >
        {MEAL_TYPES.map((m) => (
          <button
            key={m.key}
            type="button"
            role="radio"
            aria-checked={meal === m.key}
            onClick={() => setMeal(m.key)}
            className={`rounded-full px-3 py-1.5 text-sm ${meal === m.key ? "bg-ink text-bg" : "bg-surface-2 text-ink-2"}`}
          >
            {m.label}
          </button>
        ))}
      </div>
      {result.date !== result.today && (
        <p className="text-sm text-ink-2">
          Se registra en el día {result.date}.
        </p>
      )}
      <ul className="space-y-2" aria-label="Ítems interpretados">
        {rows.map((r) => {
          const g = rowGrams(r);
          return (
            <li key={r.key} className="rounded-2xl bg-surface-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {r.match ? r.match.name : r.food}
                  </span>
                  <span className="block truncate text-sm text-ink-3">
                    {r.match
                      ? [
                          r.match.preparation !== "na"
                            ? preparationLabel(r.match.preparation)
                            : null,
                          r.match.validated ? null : "sin validar",
                          `“${r.fragment}”`,
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      : `No está en tu catálogo${r.preparation ? ` (${preparationLabel(r.preparation).toLowerCase()})` : ""}`}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={`Quitar ${r.food}`}
                  onClick={() =>
                    setRows((rs) => rs.filter((x) => x.key !== r.key))
                  }
                  className="text-ink-3"
                >
                  ×
                </button>
              </div>
              {!r.match ? (
                <div className="mt-2">
                  <FoodPicker
                    initialQuery={[
                      r.food,
                      r.preparation
                        ? preparationLabel(r.preparation).toLowerCase()
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    label={`Buscar ${r.food}`}
                    onPick={(food, units) =>
                      update(r.key, { match: food, units: units ?? [] })
                    }
                    onError={setError}
                  />
                </div>
              ) : (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    inputMode="decimal"
                    aria-label={`Cantidad de ${r.match.name}`}
                    value={r.quantity}
                    onChange={(e) =>
                      update(r.key, { quantity: e.target.value })
                    }
                    placeholder="0"
                    className="tabular h-11 w-24 rounded-xl border border-line bg-bg px-3 text-[17px] outline-none focus:border-accent"
                  />
                  <select
                    aria-label={`Unidad de ${r.match.name}`}
                    value={r.unit}
                    onChange={(e) => update(r.key, { unit: e.target.value })}
                    className="h-11 rounded-xl border border-line bg-bg px-2 text-[17px]"
                  >
                    <option value="g">g</option>
                    {r.units.map((u) => (
                      <option key={u.name} value={u.name}>
                        {u.name} ({formatGrams(u.grams)} g)
                      </option>
                    ))}
                    {r.unit !== "g" &&
                      !r.units.some((u) => u.name === r.unit) && (
                        <option value={r.unit}>{r.unit} (sin definir)</option>
                      )}
                  </select>
                  <span className="tabular ml-auto text-sm text-ink-2">
                    {g != null
                      ? `${formatKcal((g * r.match.kcalPer100g) / 100)} kcal`
                      : ""}
                  </span>
                </div>
              )}
              {r.note && <p className="mt-1.5 text-sm text-danger">{r.note}</p>}
            </li>
          );
        })}
      </ul>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={pending || rows.length === 0}
        className="h-12 w-full rounded-2xl bg-accent font-semibold text-accent-ink disabled:opacity-60"
      >
        {pending ? "Registrando…" : "Registrar"}
      </button>
    </section>
  );
}
