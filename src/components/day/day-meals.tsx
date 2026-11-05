"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { setItemDeleted, updateItem } from "@/app/(app)/comidas/actions";
import { Sheet } from "@/components/ui/sheet";
import { formatGrams, formatKcal, parseDecimal } from "@/lib/format";
import { MEAL_TYPES, mealLabel, preparationLabel, type MealType } from "@/lib/meals";
import { nutrientsFor } from "@/lib/nutrition/calc";
import { newOperationId } from "@/lib/op-id";

export type ClientItem = {
  id: string;
  name: string;
  preparation: string;
  quantity: number;
  unit: string;
  grams: number;
  kcal: number;
  per100: { kcal: number; protein: number; carbs: number; fat: number; fiber: number | null };
};
export type ClientMeal = { type: MealType; items: ClientItem[]; subtotalKcal: number };

export function DayMeals({ date, meals }: { date: string; meals: ClientMeal[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ item: ClientItem; meal: MealType } | null>(null);
  const [undo, setUndo] = useState<{ itemId: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const undoTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(undoTimer.current), []);

  const visible = meals.filter((m) => m.type !== "other" || m.items.length > 0);

  const onDeleted = (item: ClientItem) => {
    setEditing(null);
    setUndo({ itemId: item.id, name: item.name });
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 6000);
  };

  const doUndo = () => {
    if (!undo) return;
    const { itemId } = undo;
    setUndo(null);
    startTransition(async () => {
      const r = await setItemDeleted({ operationId: newOperationId(), itemId, deleted: false });
      if (!r.ok) setError(r.error);
      router.refresh();
    });
  };

  return (
    <>
      <div className="space-y-4">
        {visible.map((meal) => (
          <section key={meal.type} aria-label={mealLabel(meal.type)} className="rounded-3xl bg-surface p-4">
            <header className="mb-1 flex items-baseline justify-between">
              <h3 className="font-display text-[17px] font-semibold">{mealLabel(meal.type)}</h3>
              <span className="tabular text-sm text-ink-2">{meal.items.length > 0 ? `${formatKcal(meal.subtotalKcal)} kcal` : ""}</span>
            </header>
            {meal.items.length > 0 && (
              <ul className="divide-y divide-line">
                {meal.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setEditing({ item, meal: meal.type })}
                      className="flex w-full items-center justify-between gap-3 py-3 text-left active:opacity-60"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-medium">{item.name}</span>
                        <span className="tabular block text-sm text-ink-3">
                          {quantityLabel(item)}
                          {item.preparation !== "na" ? ` · ${preparationLabel(item.preparation).toLowerCase()}` : ""}
                        </span>
                      </span>
                      <span className="tabular shrink-0 text-[15px] text-ink-2">{formatKcal(item.kcal)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href={`/registrar?fecha=${date}&comida=${meal.type}`}
              className="mt-1 inline-block py-2 text-[15px] font-medium text-accent"
            >
              + Agregar
            </Link>
          </section>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}

      {editing && (
        <EditItemSheet
          key={editing.item.id}
          item={editing.item}
          meal={editing.meal}
          onClose={() => setEditing(null)}
          onDeleted={onDeleted}
        />
      )}

      {undo && (
        <div
          role="status"
          className="animate-sheet-in fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+92px)] z-30 mx-auto flex max-w-md items-center justify-between rounded-2xl bg-ink px-4 py-3 text-[15px] text-bg shadow-xl"
        >
          <span className="truncate">Eliminado: {undo.name}</span>
          <button type="button" onClick={doUndo} className="ml-3 shrink-0 font-semibold text-accent">
            Deshacer
          </button>
        </div>
      )}
    </>
  );
}

function quantityLabel(item: ClientItem): string {
  if (item.unit === "g") return `${formatGrams(item.grams)} g`;
  return `${formatGrams(item.quantity, 2)} ${item.unit} · ${formatGrams(item.grams)} g`;
}

function EditItemSheet({
  item,
  meal,
  onClose,
  onDeleted,
}: {
  item: ClientItem;
  meal: MealType;
  onClose: () => void;
  onDeleted: (item: ClientItem) => void;
}) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(String(item.unit === "g" ? item.grams : item.quantity).replace(".", ","));
  const [unit, setUnit] = useState(item.unit);
  const [mealType, setMealType] = useState<MealType>(meal);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Un id por intento: si el usuario toca dos veces o la red reintenta, no se aplica dos veces.
  const opId = useRef(newOperationId());

  const q = parseDecimal(quantity);
  const gramsPerUnit = item.unit === "g" ? 1 : item.grams / item.quantity;
  const grams = q == null ? null : unit === "g" ? q : q * gramsPerUnit;
  const preview = grams != null && grams > 0 ? nutrientsFor(item.per100, grams) : null;

  const save = () => {
    if (q == null || q <= 0) return setError("Ingresá una cantidad válida.");
    setError(null);
    start(async () => {
      const changedQty = q !== (item.unit === "g" ? item.grams : item.quantity) || unit !== item.unit;
      const r = await updateItem({
        operationId: opId.current,
        itemId: item.id,
        ...(changedQty ? { quantity: q, unit } : {}),
        ...(mealType !== meal ? { mealType } : {}),
      });
      if (!r.ok) return setError(r.error);
      onClose();
      router.refresh();
    });
  };

  const remove = () => {
    start(async () => {
      const r = await setItemDeleted({ operationId: newOperationId(), itemId: item.id, deleted: true });
      if (!r.ok) return setError(r.error);
      onDeleted(item);
      router.refresh();
    });
  };

  return (
    <Sheet open onClose={onClose} title={item.name}>
      <div className="flex gap-2">
        <label className="flex-1">
          <span className="mb-1.5 block text-sm font-medium text-ink-2">Cantidad</span>
          <input
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="tabular h-12 w-full rounded-2xl border border-line bg-surface px-4 text-[17px] outline-none focus:border-accent"
          />
        </label>
        <label className="w-36">
          <span className="mb-1.5 block text-sm font-medium text-ink-2">Unidad</span>
          <select
            value={unit}
            onChange={(e) => {
              const next = e.target.value;
              if (q != null && next !== unit) {
                const g = unit === "g" ? q : q * gramsPerUnit;
                setQuantity(String(Math.round((next === "g" ? g : g / gramsPerUnit) * 100) / 100).replace(".", ","));
              }
              setUnit(next);
            }}
            className="h-12 w-full rounded-2xl border border-line bg-surface px-3 text-[17px]"
          >
            <option value="g">g</option>
            {item.unit !== "g" && <option value={item.unit}>{item.unit}</option>}
          </select>
        </label>
      </div>
      <p className="tabular mt-2 text-sm text-ink-2">
        {preview ? `${formatKcal(preview.kcal)} kcal · P ${formatGrams(preview.protein, 1)} · C ${formatGrams(preview.carbs, 1)} · G ${formatGrams(preview.fat, 1)}` : "—"}
      </p>

      <p className="mb-1.5 mt-4 text-sm font-medium text-ink-2">Comida</p>
      <div className="flex flex-wrap gap-2">
        {MEAL_TYPES.map((m) => (
          <button
            key={m.key}
            type="button"
            aria-pressed={mealType === m.key}
            onClick={() => setMealType(m.key)}
            className={`rounded-full px-3.5 py-2 text-[15px] ${mealType === m.key ? "bg-ink text-bg" : "bg-surface-2 text-ink-2"}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="mt-5 grid grid-cols-[auto_1fr] gap-2">
        <button type="button" onClick={remove} disabled={pending} className="h-12 rounded-2xl bg-surface-2 px-4 font-medium text-danger">
          Eliminar
        </button>
        <button type="button" onClick={save} disabled={pending} className="h-12 rounded-2xl bg-accent font-semibold text-accent-ink disabled:opacity-60">
          {pending ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </Sheet>
  );
}
