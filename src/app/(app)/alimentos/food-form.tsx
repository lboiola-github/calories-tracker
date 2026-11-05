"use client";

import { useActionState, useState } from "react";
import { formatKcal, parseDecimal } from "@/lib/format";
import { PREPARATIONS } from "@/lib/meals";
import { atwaterKcal, energyMismatch } from "@/lib/nutrition/calc";
import { saveFood, type FoodFormState } from "./actions";
import type { FoodFormValues } from "./food-values";

const SOURCES = [
  ["label", "Etiqueta del producto"],
  ["manual", "Cargado a mano"],
  ["usda", "USDA FoodData Central"],
  ["off", "Open Food Facts"],
  ["other", "Otra fuente"],
] as const;

const initial: FoodFormState = { error: null, fieldErrors: {} };

export function FoodForm({ values, returnTo }: { values: FoodFormValues; returnTo?: string }) {
  const [state, action, pending] = useActionState(saveFood, initial);
  const [v, setV] = useState(values);
  const set = <K extends keyof FoodFormValues>(k: K, value: FoodFormValues[K]) => setV((s) => ({ ...s, [k]: value }));
  const err = state.fieldErrors;

  const per100 = {
    kcal: parseDecimal(v.kcal),
    protein: parseDecimal(v.protein),
    carbs: parseDecimal(v.carbs),
    fat: parseDecimal(v.fat),
  };
  const complete = Object.values(per100).every((x) => x != null);
  const mismatch = complete
    ? energyMismatch({ kcal: per100.kcal!, protein: per100.protein!, carbs: per100.carbs!, fat: per100.fat!, fiber: null })
    : null;

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="id" value={v.id ?? ""} />
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

      <div className="space-y-3">
        <Field label="Nombre" error={err.name}>
          <input name="name" value={v.name} onChange={(e) => set("name", e.target.value)} required placeholder="Pechuga de pollo" className={input} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Preparación (cómo se pesa)">
            <select name="preparation" value={v.preparation} onChange={(e) => set("preparation", e.target.value)} className={input}>
              {PREPARATIONS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Marca (opcional)">
            <input name="brand" value={v.brand} onChange={(e) => set("brand", e.target.value)} className={input} />
          </Field>
        </div>
        <p className="text-xs text-ink-3">
          Un alimento crudo y el mismo cocido son alimentos distintos: cargá los valores del estado en que lo pesás.
        </p>
      </div>

      <fieldset>
        <legend className="mb-2 font-display text-lg font-semibold">Valores por 100 g</legend>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Calorías (kcal)" error={err.kcal}>
            <input name="kcal" inputMode="decimal" value={v.kcal} onChange={(e) => set("kcal", e.target.value)} className={input} />
          </Field>
          <Field label="Proteínas (g)" error={err.protein}>
            <input name="protein" inputMode="decimal" value={v.protein} onChange={(e) => set("protein", e.target.value)} className={input} />
          </Field>
          <Field label="Carbohidratos (g)" error={err.carbs}>
            <input name="carbs" inputMode="decimal" value={v.carbs} onChange={(e) => set("carbs", e.target.value)} className={input} />
          </Field>
          <Field label="Grasas (g)" error={err.fat}>
            <input name="fat" inputMode="decimal" value={v.fat} onChange={(e) => set("fat", e.target.value)} className={input} />
          </Field>
          <Field label="Fibra (g, opcional)" error={err.fiber}>
            <input name="fiber" inputMode="decimal" value={v.fiber} onChange={(e) => set("fiber", e.target.value)} className={input} />
          </Field>
        </div>
        {mismatch != null && mismatch > 0.15 && (
          <p role="alert" className="mt-3 rounded-xl bg-accent-soft px-3 py-2 text-sm">
            Las calorías no coinciden con los macros: estos suman ≈ {formatKcal(atwaterKcal(per100 as never))} kcal. Revisá que
            no sean kJ o valores por porción.
          </p>
        )}
      </fieldset>

      <fieldset>
        <legend className="mb-1 font-display text-lg font-semibold">Unidades</legend>
        <p className="mb-2 text-sm text-ink-3">Para registrar por unidad, tostada, cucharada… Sin esto solo se registra en gramos.</p>
        <div className="space-y-2">
          {v.units.map((u, i) => (
            <div key={i} className="flex gap-2">
              <input
                name="unitName"
                aria-label="Nombre de la unidad"
                value={u.name}
                placeholder="unidad"
                onChange={(e) => set("units", v.units.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                className={`${input} flex-1`}
              />
              <input
                name="unitGrams"
                aria-label="Gramos por unidad"
                inputMode="decimal"
                value={u.grams}
                placeholder="g"
                onChange={(e) => set("units", v.units.map((x, j) => (j === i ? { ...x, grams: e.target.value } : x)))}
                className={`${input} w-24`}
              />
              <button
                type="button"
                aria-label="Quitar unidad"
                onClick={() => set("units", v.units.filter((_, j) => j !== i))}
                className="h-12 w-12 shrink-0 rounded-2xl bg-surface-2 text-ink-2"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => set("units", [...v.units, { name: "", grams: "" }])}
          className="mt-2 text-[15px] font-medium text-accent"
        >
          + Agregar unidad
        </button>
      </fieldset>

      <Field label="Otros nombres (separados por coma)">
        <input
          name="aliases"
          value={v.aliases}
          onChange={(e) => set("aliases", e.target.value)}
          placeholder="pechu, pollo a la plancha"
          className={input}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Fuente">
          <select name="sourceType" value={v.sourceType} onChange={(e) => set("sourceType", e.target.value)} className={input}>
            {SOURCES.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Referencia (opcional)">
          <input name="sourceRef" value={v.sourceRef} onChange={(e) => set("sourceRef", e.target.value)} placeholder="fdcId, código de barras…" className={input} />
        </Field>
      </div>

      <label className="flex items-start gap-3 rounded-2xl bg-surface p-4">
        <input
          type="checkbox"
          name="validated"
          checked={v.validated}
          onChange={(e) => set("validated", e.target.checked)}
          className="mt-0.5 size-5 accent-[var(--accent)]"
        />
        <span>
          <span className="block text-[15px] font-medium">Valores validados</span>
          <span className="block text-sm text-ink-2">Revisé los valores: se pueden usar sin pedir confirmación.</span>
        </span>
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="h-13 w-full rounded-2xl bg-accent text-[17px] font-semibold text-accent-ink disabled:opacity-60">
        {pending ? "Guardando…" : "Guardar alimento"}
      </button>
    </form>
  );
}

const input = "h-12 w-full rounded-2xl border border-line bg-surface px-4 text-[17px] outline-none focus:border-accent";

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-2">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}
