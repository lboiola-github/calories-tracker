"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { foodUnits } from "@/app/(app)/comidas/actions";
import { FoodPicker, type PickedUnits } from "@/components/food-picker";
import type { FoodSearchHit } from "@/lib/data/foods";
import { formatGrams, formatKcal, parseDecimal } from "@/lib/format";
import { newOperationId } from "@/lib/op-id";
import { saveRecipe } from "./actions";

export type IngredientLine = { food: FoodSearchHit; quantity: string; unit: string; units: PickedUnits };
export type RecipeFormValues = {
  recipeId: string | null;
  name: string;
  lines: IngredientLine[];
  finalWeight: string;
  portions: string;
  notes: string;
};

const lineGrams = (l: IngredientLine) => {
  const q = parseDecimal(l.quantity);
  if (q == null || q <= 0) return 0;
  return l.unit === "g" ? q : q * (l.units.find((u) => u.name === l.unit)?.grams ?? 0);
};

/**
 * Formulario de receta. Muestra una vista previa de calorías; los valores que se guardan los
 * calcula la base con el catálogo. Guardar crea siempre una versión nueva.
 */
export function RecipeForm({ initial }: { initial: RecipeFormValues }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [lines, setLines] = useState<IngredientLine[]>(initial.lines);
  const [finalWeight, setFinalWeight] = useState(initial.finalWeight);
  const [portions, setPortions] = useState(initial.portions);
  const [notes, setNotes] = useState(initial.notes);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const opId = useRef(newOperationId());

  const preview = useMemo(() => {
    const grams = lines.reduce((a, l) => a + lineGrams(l), 0);
    const kcal = lines.reduce((a, l) => a + (lineGrams(l) * l.food.kcalPer100g) / 100, 0);
    const fw = parseDecimal(finalWeight);
    const weight = fw != null && fw > 0 ? fw : grams;
    const p = parseDecimal(portions);
    return {
      grams,
      kcal,
      weight,
      per100: weight > 0 ? (kcal * 100) / weight : null,
      perPortion: p != null && p > 0 ? kcal / p : null,
      portionGrams: p != null && p > 0 && weight > 0 ? weight / p : null,
    };
  }, [lines, finalWeight, portions]);

  const update = (i: number, patch: Partial<IngredientLine>) => {
    opId.current = newOperationId();
    setLines((ls) => ls.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  };

  const add = async (food: FoodSearchHit, units?: PickedUnits) => {
    opId.current = newOperationId();
    setLines((ls) => [...ls, { food, quantity: "", unit: "g", units: units ?? [] }]);
    if (units) return;
    const r = await foodUnits(food.id);
    if (r.ok && r.data.length > 0) setLines((ls) => ls.map((l) => (l.food.id === food.id ? { ...l, units: r.data } : l)));
  };

  const submit = () => {
    const ingredients: { foodId: string; quantity: number; unit: string }[] = [];
    for (const l of lines) {
      const q = parseDecimal(l.quantity);
      if (q == null || q <= 0) return setError(`Falta la cantidad de “${l.food.name}”.`);
      ingredients.push({ foodId: l.food.id, quantity: q, unit: l.unit });
    }
    if (!name.trim()) return setError("Ingresá un nombre.");
    if (ingredients.length === 0) return setError("Agregá al menos un ingrediente.");
    const fw = finalWeight.trim() ? parseDecimal(finalWeight) : null;
    if (finalWeight.trim() && (fw == null || fw <= 0)) return setError("Revisá el peso final.");
    const p = portions.trim() ? parseDecimal(portions) : null;
    if (portions.trim() && (p == null || p <= 0 || p > 100)) return setError("Las porciones van de 1 a 100.");
    setError(null);
    start(async () => {
      const r = await saveRecipe({
        operationId: opId.current,
        recipeId: initial.recipeId,
        name: name.trim(),
        ingredients,
        finalWeightG: fw,
        portions: p,
        notes: notes.trim() || null,
      });
      if (!r.ok) return setError(r.error);
      router.push(`/alimentos/recetas/${r.data.recipeId}`);
      router.refresh();
    });
  };

  const field = "h-12 w-full rounded-2xl border border-line bg-surface px-4 text-[17px] outline-none focus:border-accent";

  return (
    <div className="space-y-5">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-2">Nombre</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className={field} maxLength={120} placeholder="Ej.: Tarta de verdura" />
      </label>

      <section aria-label="Ingredientes" className="space-y-2">
        <h2 className="text-sm font-medium text-ink-2">Ingredientes (como se pesan: crudo, seco…)</h2>
        {lines.length > 0 && (
          <ul className="space-y-2" aria-label="Lista de ingredientes">
            {lines.map((l, i) => (
              <li key={`${l.food.id}-${i}`} className="rounded-2xl bg-surface p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-medium">{l.food.name}</span>
                  <button
                    type="button"
                    aria-label={`Quitar ${l.food.name}`}
                    onClick={() => {
                      opId.current = newOperationId();
                      setLines((ls) => ls.filter((_, j) => j !== i));
                    }}
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
                    onChange={(e) => update(i, { quantity: e.target.value })}
                    placeholder="0"
                    className="tabular h-11 w-28 rounded-xl border border-line bg-bg px-3 text-[17px] outline-none focus:border-accent"
                  />
                  {l.units.length > 0 ? (
                    <select
                      aria-label={`Unidad de ${l.food.name}`}
                      value={l.unit}
                      onChange={(e) => update(i, { unit: e.target.value })}
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
                  <span className="tabular ml-auto text-sm text-ink-2">
                    {lineGrams(l) > 0 ? `${formatKcal((lineGrams(l) * l.food.kcalPer100g) / 100)} kcal` : ""}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        <FoodPicker label="Agregar ingrediente" onPick={add} onError={setError} />
      </section>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-2">Peso final (g)</span>
          <input
            inputMode="decimal"
            value={finalWeight}
            onChange={(e) => setFinalWeight(e.target.value)}
            className={`${field} tabular`}
            placeholder={preview.grams > 0 ? formatGrams(preview.grams) : "Opcional"}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-2">Porciones</span>
          <input inputMode="decimal" value={portions} onChange={(e) => setPortions(e.target.value)} className={`${field} tabular`} placeholder="Opcional" />
        </label>
      </div>
      <p className="-mt-2 text-sm text-ink-3">
        Pesá la preparación terminada para que las calorías por 100 g sean exactas (el agua se evapora o se absorbe). Si lo dejás vacío se usa la suma de
        los ingredientes.
      </p>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-2">Notas</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={1000}
          rows={2}
          className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-[17px] outline-none focus:border-accent"
          placeholder="Opcional"
        />
      </label>

      {lines.length > 0 && (
        <dl className="grid grid-cols-3 gap-2 text-center" aria-label="Vista previa">
          <div className="rounded-2xl bg-surface-2 px-2 py-3">
            <dt className="text-xs uppercase tracking-wider text-ink-3">Total</dt>
            <dd className="tabular mt-0.5 font-semibold" data-testid="recipe-total">
              {formatKcal(preview.kcal)} kcal
            </dd>
          </div>
          <div className="rounded-2xl bg-surface-2 px-2 py-3">
            <dt className="text-xs uppercase tracking-wider text-ink-3">100 g</dt>
            <dd className="tabular mt-0.5 font-semibold" data-testid="recipe-per100">
              {preview.per100 == null ? "—" : `${formatKcal(preview.per100)} kcal`}
            </dd>
          </div>
          <div className="rounded-2xl bg-surface-2 px-2 py-3">
            <dt className="text-xs uppercase tracking-wider text-ink-3">Porción</dt>
            <dd className="tabular mt-0.5 font-semibold" data-testid="recipe-portion">
              {preview.perPortion == null ? "—" : `${formatKcal(preview.perPortion)} kcal`}
            </dd>
          </div>
        </dl>
      )}

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="h-13 w-full rounded-2xl bg-accent text-[17px] font-semibold text-accent-ink disabled:opacity-60"
      >
        {pending ? "Guardando…" : initial.recipeId ? "Guardar nueva versión" : "Guardar receta"}
      </button>
    </div>
  );
}
