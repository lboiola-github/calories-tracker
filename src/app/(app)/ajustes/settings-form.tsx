"use client";

import { useActionState, useMemo, useState, type ReactNode } from "react";
import { formatKcal, formatMass, parseDecimal } from "@/lib/format";
import { ACTIVITY_LEVELS, DEFICIT_OPTIONS, type ActivityLevel } from "@/lib/metabolism/config";
import {
  projectedLoss,
  resolveMetabolism,
  targetWarnings,
  type MetabolicInputs,
  type Resolved,
  type Sex,
  type TargetWarning,
} from "@/lib/metabolism/metabolism";
import { saveSettings, type SettingsState } from "./actions";
import { Spinner } from "@/components/ui/spinner";

const initialState: SettingsState = { status: "idle", message: null, fieldErrors: {} };

type Props = { initial: MetabolicInputs; today: string };

const str = (n: number | null) => (n == null ? "" : String(n).replace(".", ","));

export function SettingsForm({ initial, today }: Props) {
  const [state, action, pending] = useActionState(saveSettings, initialState);

  const [birthDate, setBirthDate] = useState(initial.birthDate ?? "");
  const [sex, setSex] = useState<Sex | null>(initial.sex);
  const [height, setHeight] = useState(str(initial.heightCm));
  const [weight, setWeight] = useState(str(initial.weightKg));
  const [activity, setActivity] = useState<ActivityLevel | null>(initial.activityLevel);
  const [deficit, setDeficit] = useState(initial.deficitKcal);
  const [targetMode, setTargetMode] = useState<"auto" | "manual">(initial.targetManual != null ? "manual" : "auto");
  const [targetManual, setTargetManual] = useState(str(initial.targetManual));
  const [bmrManual, setBmrManual] = useState(str(initial.bmrManual));
  const [tdeeManual, setTdeeManual] = useState(str(initial.tdeeManual));

  // Vista previa con el mismo módulo que usa el servidor: lo que se ve es lo que se guarda.
  const preview = useMemo(() => {
    const inputs: MetabolicInputs = {
      birthDate: birthDate || null,
      sex,
      heightCm: parseDecimal(height),
      weightKg: parseDecimal(weight),
      activityLevel: activity,
      bmrManual: parseDecimal(bmrManual),
      tdeeManual: parseDecimal(tdeeManual),
      targetManual: targetMode === "manual" ? parseDecimal(targetManual) : null,
      deficitKcal: deficit,
    };
    const result = resolveMetabolism(inputs, today);
    const warnings = targetWarnings({ target: result.target.value, tdee: result.tdee.value, bmr: result.bmr.value, sex });
    return { result, warnings };
  }, [birthDate, sex, height, weight, activity, bmrManual, tdeeManual, targetMode, targetManual, deficit, today]);

  const err = state.fieldErrors;

  return (
    <form action={action} className="space-y-8">
      <Section title="Datos personales">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha de nacimiento" error={err.birthDate} className="col-span-2">
            <input
              type="date"
              name="birthDate"
              value={birthDate}
              max={today}
              onChange={(e) => setBirthDate(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Altura (cm)" error={err.heightCm}>
            <input name="heightCm" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="175" className={inputClass} />
          </Field>
          <Field label="Peso actual (kg)" error={err.weightKg}>
            <input name="weightKg" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="80,5" className={inputClass} />
          </Field>
        </div>
        <fieldset className="mt-4">
          <legend className={labelClass}>Sexo para la estimación metabólica</legend>
          <input type="hidden" name="sex" value={sex ?? ""} />
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-surface-2 p-1">
            {(
              [
                ["female", "Femenino"],
                ["male", "Masculino"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={sex === value}
                onClick={() => setSex(value)}
                className={`h-10 rounded-xl text-[15px] font-medium transition-colors ${sex === value ? "bg-track text-ink" : "text-ink-2"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-ink-3">Solo se usa en la fórmula de Mifflin-St Jeor.</p>
        </fieldset>
      </Section>

      <Section title="Actividad física" hint="Elegí la que mejor describe una semana típica.">
        <input type="hidden" name="activityLevel" value={activity ?? ""} />
        <div className="space-y-2" role="radiogroup" aria-label="Nivel de actividad">
          {ACTIVITY_LEVELS.map((a) => (
            <button
              key={a.key}
              type="button"
              role="radio"
              aria-checked={activity === a.key}
              onClick={() => setActivity(a.key)}
              className={`flex w-full items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                activity === a.key ? "border-accent bg-accent-soft" : "border-line bg-surface"
              }`}
            >
              <span>
                <span className="block text-[15px] font-semibold">{a.label}</span>
                <span className="mt-0.5 block text-sm text-ink-2">{a.description}</span>
              </span>
              <span className="tabular shrink-0 text-sm text-ink-3">× {String(a.factor).replace(".", ",")}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-3">El ejercicio ya está incluido en este factor: no se suman calorías de ejercicio aparte.</p>
      </Section>

      <Section title="Tu metabolismo estimado">
        <div className="grid grid-cols-2 gap-3">
          <ValueCard label="Basal (BMR)" resolved={preview.result.bmr} />
          <ValueCard label="Gasto diario (TDEE)" resolved={preview.result.tdee} />
        </div>
        {preview.result.missing.length > 0 && (
          <p className="mt-2 text-sm text-ink-2">Completá {missingLabel(preview.result.missing)} para calcularlo.</p>
        )}
        <details className="mt-3 rounded-2xl border border-line bg-surface px-4 py-3" open={Boolean(bmrManual || tdeeManual)}>
          <summary className="cursor-pointer text-[15px] font-medium">Ajustar manualmente</summary>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <ManualField
              label="BMR manual"
              name="bmrManual"
              value={bmrManual}
              onChange={setBmrManual}
              placeholder={preview.result.bmr.auto != null ? formatKcal(preview.result.bmr.auto) : ""}
              error={err.bmrManual}
            />
            <ManualField
              label="TDEE manual"
              name="tdeeManual"
              value={tdeeManual}
              onChange={setTdeeManual}
              placeholder={preview.result.tdee.auto != null ? formatKcal(preview.result.tdee.auto) : ""}
              error={err.tdeeManual}
            />
          </div>
          <p className="mt-2 text-xs text-ink-3">Vacío = automático. Útil si tenés una medición (por ejemplo, calorimetría).</p>
        </details>
        <p className="mt-3 text-xs leading-relaxed text-ink-3">
          Son estimaciones con la ecuación de Mifflin-St Jeor y un factor de actividad, no una medición clínica.
        </p>
      </Section>

      <Section title="Objetivo diario">
        <input type="hidden" name="targetMode" value={targetMode} />
        <input type="hidden" name="deficitKcal" value={deficit} />
        <div className="mb-3 grid grid-cols-2 gap-2 rounded-2xl bg-surface-2 p-1">
          {(
            [
              ["auto", "Por déficit"],
              ["manual", "Manual"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={targetMode === value}
              onClick={() => setTargetMode(value)}
              className={`h-10 rounded-xl text-[15px] font-medium transition-colors ${targetMode === value ? "bg-track text-ink" : "text-ink-2"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {targetMode === "auto" ? (
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Déficit diario">
            {DEFICIT_OPTIONS.map((d) => {
              const loss = projectedLoss(d);
              const tdee = preview.result.tdee.value;
              return (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={deficit === d}
                  onClick={() => setDeficit(d)}
                  className={`rounded-2xl border p-3 text-left transition-colors ${deficit === d ? "border-accent bg-accent-soft" : "border-line bg-surface"}`}
                >
                  <span className="tabular block text-[17px] font-semibold">−{d} kcal</span>
                  <span className="tabular mt-1 block text-sm text-ink-2">≈ {formatMass(loss.weeklyGrams)}/semana</span>
                  <span className="tabular block text-sm text-ink-2">≈ {formatMass(loss.monthlyGrams)}/mes</span>
                  {tdee != null && <span className="tabular mt-1 block text-xs text-ink-3">Objetivo {formatKcal(tdee - d)} kcal</span>}
                </button>
              );
            })}
          </div>
        ) : (
          <Field label="Objetivo manual (kcal/día)" error={err.targetManual}>
            <input
              name="targetManual"
              inputMode="numeric"
              value={targetManual}
              onChange={(e) => setTargetManual(e.target.value)}
              placeholder={preview.result.target.auto != null ? formatKcal(preview.result.target.auto) : "2000"}
              className={inputClass}
            />
          </Field>
        )}
        {targetMode === "auto" && <input type="hidden" name="targetManual" value="" />}

        <div className="mt-4 rounded-3xl bg-surface p-5">
          <p className="text-sm font-medium text-ink-2">Objetivo resultante</p>
          <p className="tabular mt-1 font-display text-[40px] font-bold leading-none tracking-tight">
            {preview.result.target.value != null ? formatKcal(preview.result.target.value) : "—"}
            <span className="ml-1 text-lg font-semibold text-ink-3">kcal</span>
          </p>
          <SourceBadge source={preview.result.target.source} />
          {preview.warnings.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {preview.warnings.map((w) => (
                <li key={w.kind} className="rounded-xl bg-accent-soft px-3 py-2 text-sm text-ink">
                  {warningText(w)}
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-ink-3">
          Las pérdidas son teóricas (7.700 kcal ≈ 1 kg). La pérdida real varía por adaptación metabólica, cambios en el
          gasto, composición corporal y líquidos. Cambiar el objetivo rige desde hoy y no modifica días anteriores.
        </p>
      </Section>

      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+84px)] z-10">
        <button
          type="submit"
          disabled={pending}
          className="h-13 w-full rounded-2xl bg-accent text-[17px] font-semibold text-accent-ink shadow-lg transition-opacity disabled:opacity-60"
        >
          {pending && <Spinner className="mr-2 size-4 align-[-2px]" />}
        {pending ? "Guardando…" : "Guardar"}
        </button>
        <p aria-live="polite" className={`mt-2 text-center text-sm ${state.status === "error" ? "text-danger" : "text-success"}`}>
          {state.message}
        </p>
      </div>
    </form>
  );
}

const inputClass =
  "h-12 w-full rounded-2xl border border-line bg-surface px-4 text-[17px] outline-none focus:border-accent tabular";
const labelClass = "mb-1.5 block text-sm font-medium text-ink-2";

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
      {hint && <p className="mt-0.5 text-sm text-ink-3">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Field({ label, error, className, children }: { label: string; error?: string; className?: string; children: ReactNode }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className={labelClass}>{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}

function ManualField(props: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  error?: string;
}) {
  return (
    <Field label={props.label} error={props.error}>
      <div className="relative">
        <input
          name={props.name}
          inputMode="decimal"
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={props.placeholder}
          className={inputClass}
        />
        {props.value && (
          <button
            type="button"
            onClick={() => props.onChange("")}
            className="absolute inset-y-0 right-2 my-auto h-8 rounded-lg px-2 text-xs font-medium text-accent"
          >
            Restablecer
          </button>
        )}
      </div>
    </Field>
  );
}

function ValueCard({ label, resolved }: { label: string; resolved: Resolved }) {
  return (
    <div className="rounded-2xl bg-surface p-4">
      <p className="text-sm text-ink-2">{label}</p>
      <p className="tabular mt-1 text-2xl font-semibold">
        {resolved.value != null ? formatKcal(resolved.value) : "—"}
        <span className="ml-1 text-sm font-normal text-ink-3">kcal</span>
      </p>
      <SourceBadge source={resolved.source} />
    </div>
  );
}

function SourceBadge({ source }: { source: "auto" | "manual" }) {
  return (
    <span
      className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
        source === "manual" ? "bg-accent-soft text-accent" : "bg-surface-2 text-ink-2"
      }`}
    >
      {source === "manual" ? "Manual" : "Automático"}
    </span>
  );
}

function warningText(w: TargetWarning): string {
  switch (w.kind) {
    case "below_floor":
      return `Por debajo de ${formatKcal(w.floor)} kcal/día no se recomienda sin seguimiento profesional.`;
    case "below_bmr":
      return `El objetivo queda por debajo de tu metabolismo basal estimado (${formatKcal(w.bmr)} kcal).`;
    case "aggressive_deficit":
      return `El déficit es del ${Math.round(w.ratio * 100)} % de tu gasto diario: es agresivo y difícil de sostener.`;
  }
}

const MISSING_LABELS = {
  birthDate: "la fecha de nacimiento",
  sex: "el sexo",
  heightCm: "la altura",
  weightKg: "el peso",
  activityLevel: "la actividad",
} as const;

function missingLabel(missing: Array<keyof typeof MISSING_LABELS>): string {
  const parts = missing.map((m) => MISSING_LABELS[m]);
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} y ${parts.at(-1)}`;
}
