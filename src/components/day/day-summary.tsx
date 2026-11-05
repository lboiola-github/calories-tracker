import { dayProgress, type Nutrients } from "@/lib/nutrition/calc";
import { formatGrams, formatKcal } from "@/lib/format";

const MACROS = [
  { key: "protein", label: "Proteínas", color: "bg-protein" },
  { key: "carbs", label: "Carbohidratos", color: "bg-carbs" },
  { key: "fat", label: "Grasas", color: "bg-fat" },
] as const;

export function DaySummary({ target, total }: { target: number | null; total: Nutrients }) {
  const p = dayProgress(target, total.kcal);
  const over = p.remaining != null && p.remaining < 0;
  const width = p.percent == null ? 0 : Math.min(100, p.percent);
  return (
    <section aria-label="Resumen calórico" className="rounded-[28px] bg-surface p-5 shadow-sm">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium text-ink-2">{over ? "Excedido" : "Restantes"}</p>
        <p className="tabular text-sm text-ink-3">{target != null ? `Objetivo ${formatKcal(target)} kcal` : "Objetivo sin definir"}</p>
      </div>
      <p
        data-testid="remaining"
        className={`tabular mt-1 font-display text-[56px] font-bold leading-none tracking-tight ${
          p.remaining == null ? "text-ink-3" : over ? "text-danger" : "text-ink"
        }`}
      >
        {p.remaining != null ? formatKcal(p.remaining) : "—"}
      </p>
      <div
        className="mt-5 h-2.5 overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-label="Objetivo consumido"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(p.percent ?? 0)}
      >
        <div className={`h-full rounded-full transition-[width] duration-500 ${over ? "bg-danger" : "bg-accent"}`} style={{ width: `${width}%` }} />
      </div>
      <div className="tabular mt-2 flex justify-between text-sm text-ink-2">
        <span data-testid="consumed">{formatKcal(total.kcal)} kcal consumidas</span>
        <span>{p.percent != null ? `${Math.round(p.percent)} %` : ""}</span>
      </div>
      <dl className="mt-5 grid grid-cols-3 gap-3">
        {MACROS.map((m) => (
          <div key={m.key}>
            <dt className="flex items-center gap-1.5 text-xs font-medium text-ink-2">
              <span className={`size-2 rounded-full ${m.color}`} />
              {m.label}
            </dt>
            <dd className="tabular mt-1 text-lg font-semibold">
              {formatGrams(total[m.key])} <span className="text-sm font-normal text-ink-3">g</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
