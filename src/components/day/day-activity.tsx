"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addActivity, setActivityDeleted } from "@/app/(app)/actividad/actions";
import { CloseIcon, PlusIcon } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { ACTIVITY_KINDS, activityKind, activityLabel, distanceKcal, type ActivityKind } from "@/lib/activity/activity";
import { formatKcal, formatKg, parseDecimal } from "@/lib/format";
import { newOperationId } from "@/lib/op-id";

export type ClientActivity = { id: string; kind: ActivityKind; km: number | null; kcal: number };

/** Actividad física del día: suma calorías al margen. Caminar/correr por km; gimnasio/fútbol a mano. */
export function DayActivity({ date, entries, weightKg }: { date: string; entries: ClientActivity[]; weightKg: number | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  const remove = (id: string) => {
    setRemoving(id);
    setError(null);
    start(async () => {
      const r = await setActivityDeleted(id, true);
      if (!r.ok) setError(r.error);
      router.refresh();
      setRemoving(null);
    });
  };

  return (
    <section aria-label="Actividad física" className="rounded-3xl bg-surface p-4">
      <header className="mb-1 flex items-center justify-between">
        <h3 className="font-display text-[17px] font-semibold">Actividad</h3>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent transition-transform active:scale-95"
        >
          <PlusIcon className="size-4" strokeWidth={2.4} /> Agregar
        </button>
      </header>
      {entries.length === 0 ? (
        <p className="py-2 text-sm text-ink-3">Sin actividad registrada.</p>
      ) : (
        <ul className="divide-y divide-line">
          {entries.map((e) => (
            <li key={e.id} className={`flex items-center justify-between gap-3 py-3 ${removing === e.id ? "opacity-40" : ""}`}>
              <span className="min-w-0">
                <span className="block text-[15px] font-medium">{activityLabel(e.kind)}</span>
                {e.km != null && <span className="tabular block text-sm text-ink-3">{formatKg(e.km, 2)} km</span>}
              </span>
              <span className="flex items-center gap-2">
                <span className="tabular text-[15px] text-accent">+{formatKcal(e.kcal)}</span>
                <button
                  type="button"
                  onClick={() => remove(e.id)}
                  disabled={removing != null}
                  aria-label={`Quitar ${activityLabel(e.kind)}`}
                  className="grid size-8 place-items-center rounded-full bg-surface-2 text-ink-3 active:scale-90"
                >
                  {removing === e.id ? <Spinner className="size-4" /> : <CloseIcon className="size-4" />}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title="Agregar actividad">
        <ActivityForm
          date={date}
          weightKg={weightKg}
          onSaved={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      </Sheet>
    </section>
  );
}

function ActivityForm({ date, weightKg, onSaved }: { date: string; weightKg: number | null; onSaved: () => void }) {
  const [kind, setKind] = useState<ActivityKind>("walk");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Un id por intento: si se reintenta el mismo envío, no se duplica.
  const [opId, setOpId] = useState(newOperationId);
  const byDistance = activityKind(kind).byDistance;
  const n = parseDecimal(value);
  const preview = byDistance ? distanceKcal(kind, n, weightKg) : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    if (n == null || n <= 0) return setError(byDistance ? "Ingresá los km." : "Ingresá las kcal.");
    setError(null);
    start(async () => {
      const r = await addActivity({ operationId: opId, date, kind, km: byDistance ? n : null, kcal: byDistance ? null : n });
      if (!r.ok) return setError(r.error);
      setOpId(newOperationId());
      onSaved();
    });
  };

  return (
    <form onSubmit={submit} aria-label="Agregar actividad" className="space-y-4 pb-1">
      <div role="radiogroup" aria-label="Tipo de actividad" className="grid grid-cols-2 gap-2">
        {ACTIVITY_KINDS.map((k) => (
          <button
            key={k.key}
            type="button"
            role="radio"
            aria-checked={kind === k.key}
            onClick={() => {
              setKind(k.key);
              setValue("");
              setError(null);
            }}
            className={`rounded-2xl px-4 py-3 text-[15px] font-medium transition-transform active:scale-95 ${
              kind === k.key ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink-2"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      <label className="block">
        <span className="text-sm text-ink-2">{byDistance ? "Distancia (km)" : "Calorías quemadas (kcal)"}</span>
        <input
          key={byDistance ? "km" : "kcal"}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={byDistance ? "Ej.: 5" : "Ej.: 350"}
          className="tabular mt-1 w-full rounded-2xl bg-surface-2 px-4 py-3 text-[17px] text-ink outline-none placeholder:text-ink-3"
        />
      </label>

      {byDistance && (
        <p className="text-sm text-ink-3" data-testid="activity-preview">
          {weightKg == null
            ? "Para calcular hace falta un peso registrado (pantalla Peso)."
            : preview != null
              ? `≈ ${formatKcal(preview)} kcal (${formatKg(weightKg)} kg × ${formatKg(n!, 2)} km${kind === "walk" ? " × 0,5" : ""})`
              : kind === "walk"
                ? `Caminar: peso × km × 0,5 (con ${formatKg(weightKg)} kg).`
                : `Correr: peso × km (con ${formatKg(weightKg)} kg).`}
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || (byDistance && weightKg == null)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-3.5 text-[16px] font-semibold text-accent-ink transition-transform active:scale-[0.98] disabled:opacity-40"
      >
        {pending && <Spinner className="size-4" />}
        {pending ? "Guardando…" : "Guardar actividad"}
      </button>
    </form>
  );
}
