import { EmptyState } from "@/components/ui/empty-state";
import { WeightIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { loadMetabolicState } from "@/lib/data/metabolism";
import { listWeights } from "@/lib/data/weights";
import { formatKg } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { chartPath, weightChange } from "@/lib/weight-stats";
import { WeightForm } from "./weight-form";
import { WeightHistory } from "./weight-history";

export const metadata = { title: "Peso" };
export const dynamic = "force-dynamic";

const shortDate = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, day)));
};

const W = 320;
const H = 120;

export default async function WeightPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [state, entries] = await Promise.all([loadMetabolicState(supabase, user.id), listWeights(supabase)]);
  const points = entries.map((e) => ({ date: e.date, kg: e.kg }));
  const latest = entries[0] ?? null;
  const changes = [7, 30, 90].map((d) => ({ days: d, c: weightChange(points, d) }));
  const chart = chartPath(points.slice(0, 120), W, H);

  return (
    <>
      <PageHeader title="Peso" />
      {latest ? (
        <section aria-label="Resumen de peso" className="mb-4 rounded-3xl bg-surface p-5">
          <p className="text-sm text-ink-2">Último · {shortDate(latest.date)}</p>
          <p className="tabular font-display text-[44px] font-bold leading-tight" data-testid="latest-weight">
            {formatKg(latest.kg, 2)} <span className="text-lg font-normal text-ink-2">kg</span>
          </p>
          <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
            {changes.map(({ days, c }) => (
              <div key={days} className="rounded-2xl bg-surface-2 py-2">
                <dt className="text-xs uppercase tracking-wider text-ink-3">{days} días</dt>
                <dd className={`tabular font-semibold ${c && c.kg < 0 ? "text-accent" : ""}`}>
                  {c == null ? "—" : `${c.kg > 0 ? "+" : c.kg < 0 ? "−" : ""}${formatKg(Math.abs(c.kg), 1)} kg`}
                </dd>
              </div>
            ))}
          </dl>
          {chart && chart.points.length > 1 && (
            <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full" role="img" aria-label={`Evolución del peso: de ${formatKg(chart.min, 1)} a ${formatKg(chart.max, 1)} kg`}>
              <path d={chart.d} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              {chart.points.length <= 40 && chart.points.map((p) => <circle key={p.date} cx={p.x} cy={p.y} r={3} fill="var(--accent)" />)}
            </svg>
          )}
        </section>
      ) : (
        <div className="mb-4">
          <EmptyState
            icon={<WeightIcon className="size-6" />}
            title="Sin registros de peso"
            description="Cargá tu peso cuando quieras. No hace falta hacerlo todos los días."
          />
        </div>
      )}

      <WeightForm today={state.today} lastKg={latest?.kg ?? null} />

      {entries.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 text-sm font-medium text-ink-2">Registros</h2>
          <WeightHistory
            entries={entries.map((e, i) => ({
              id: e.id,
              date: e.date,
              label: shortDate(e.date),
              kg: e.kg,
              diff: entries[i + 1] ? Math.round((e.kg - entries[i + 1].kg) * 100) / 100 : null,
              notes: e.notes,
              photos: e.photos.map((p) => ({ id: p.id, url: p.url })),
            }))}
          />
        </>
      )}
    </>
  );
}
