import { dayProgress, type Nutrients } from "@/lib/nutrition/calc";
import { formatGrams, formatKcal } from "@/lib/format";

const MACROS = [
  { key: "protein", label: "Proteínas", color: "var(--protein)" },
  { key: "carbs", label: "Carbohidratos", color: "var(--carbs)" },
  { key: "fat", label: "Grasas", color: "var(--fat)" },
] as const;

const SIZE = 212;
const STROKE = 12;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

/**
 * Anillo de progreso con las calorías restantes al centro. Si se pasa del objetivo,
 * el anillo se completa en coral y el número muestra cuánto por encima.
 */
export function DaySummary({ target, total, burned = 0 }: { target: number | null; total: Nutrients; burned?: number }) {
  const p = dayProgress(target, total.kcal, burned);
  const over = p.remaining != null && p.remaining < 0;
  const fraction = p.percent == null ? 0 : Math.min(100, p.percent) / 100;
  const ring = over ? "var(--danger)" : "var(--accent)";

  // Barras: parte de las calorías de los macros que aporta cada uno (4/4/9 kcal por gramo).
  const kcalOf = { protein: total.protein * 4, carbs: total.carbs * 4, fat: total.fat * 9 };
  const macroKcal = Math.max(1, kcalOf.protein + kcalOf.carbs + kcalOf.fat);

  return (
    <section aria-label="Resumen calórico" className="rounded-[28px] bg-surface p-5">
      <div className="flex justify-center pt-1">
        <div
          className="relative"
          style={{ width: SIZE, height: SIZE }}
          role="progressbar"
          aria-label="Objetivo consumido"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(p.percent ?? 0)}
        >
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90" aria-hidden="true">
            <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--track)" strokeWidth={STROKE} />
            {fraction > 0 && (
              <circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                fill="none"
                stroke={ring}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - fraction)}
                className="transition-[stroke-dashoffset] duration-700 ease-out"
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <p
              data-testid="remaining"
              className={`tabular font-display text-[52px] font-bold leading-none tracking-tight ${
                p.remaining == null ? "text-ink-3" : over ? "text-danger" : "text-ink"
              }`}
            >
              {p.remaining == null ? "—" : over ? `−${formatKcal(-p.remaining)}` : formatKcal(p.remaining)}
            </p>
            <p className="mt-1.5 text-sm text-ink-2">
              {p.remaining == null ? "Objetivo sin definir" : over ? "kcal por encima" : "kcal restantes"}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <Tile label="Consumido" testId="consumed" value={formatKcal(total.kcal)} />
        <Tile label="Actividad" testId="burned" value={burned > 0 ? `+${formatKcal(burned)}` : "0"} accent={burned > 0} />
        <Tile label="Meta" value={target != null ? formatKcal(target) : "—"} />
      </div>

      <dl className="mt-5 space-y-3">
        {MACROS.map((m) => (
          <div key={m.key}>
            <div className="flex items-baseline justify-between text-sm">
              <dt className="text-ink-2">{m.label}</dt>
              <dd className="tabular font-semibold">
                {formatGrams(total[m.key])} <span className="font-normal text-ink-3">g</span>
              </dd>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-track" aria-hidden="true">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${(kcalOf[m.key] / macroKcal) * 100}%`, background: m.color }}
              />
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Tile({ label, value, testId, accent }: { label: string; value: string; testId?: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-3 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-ink-3">{label}</p>
      <p className={`tabular mt-0.5 text-lg font-semibold ${accent ? "text-accent" : ""}`} data-testid={testId}>
        {value} <span className="text-xs font-normal text-ink-2">kcal</span>
      </p>
    </div>
  );
}
