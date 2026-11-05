import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { FoodIcon, SettingsIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { loadMetabolicState, targetFor } from "@/lib/data/metabolism";
import { formatKcal } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

const MACROS = [
  { label: "Proteínas", color: "bg-protein" },
  { label: "Carbohidratos", color: "bg-carbs" },
  { label: "Grasas", color: "bg-fat" },
] as const;

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const state = await loadMetabolicState(supabase, user.id);
  const target = await targetFor(supabase, state.today);
  const consumed = 0; // Etapa 3: suma de los registros del día.
  const remaining = target != null ? target - consumed : null;

  return (
    <>
      <PageHeader
        eyebrow="Hoy"
        title="Inicio"
        action={
          <Link
            href="/ajustes"
            aria-label="Configuración"
            className="mb-1 grid size-10 place-items-center rounded-full bg-surface text-ink-2 shadow-sm"
          >
            <SettingsIcon className="size-5" />
          </Link>
        }
      />

      <section
        aria-label="Resumen calórico"
        className="rounded-[28px] bg-surface p-5 shadow-sm"
      >
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium text-ink-2">Restantes</p>
          <p className="tabular text-sm text-ink-3">
            {target != null
              ? `Objetivo ${formatKcal(target)} kcal`
              : "Objetivo sin definir"}
          </p>
        </div>
        <p
          className={`tabular mt-1 font-display text-[56px] font-bold leading-none tracking-tight ${
            remaining == null
              ? "text-ink-3"
              : remaining < 0
                ? "text-danger"
                : "text-ink"
          }`}
        >
          {remaining != null ? formatKcal(remaining) : "—"}
        </p>
        <div
          className="mt-5 h-2.5 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-valuenow={0}
        >
          <div className="h-full w-0 rounded-full bg-accent" />
        </div>
        <dl className="mt-5 grid grid-cols-3 gap-3">
          {MACROS.map((m) => (
            <div key={m.label}>
              <dt className="flex items-center gap-1.5 text-xs font-medium text-ink-2">
                <span className={`size-2 rounded-full ${m.color}`} />
                {m.label}
              </dt>
              <dd className="tabular mt-1 text-lg font-semibold">
                0 <span className="text-sm font-normal text-ink-3">g</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {target == null && (
        <Link
          href="/ajustes"
          className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-accent-soft px-4 py-3.5 text-[15px] font-medium text-accent"
        >
          Configurá tu perfil para calcular el objetivo
          <span aria-hidden>→</span>
        </Link>
      )}

      <h2 className="mt-8 mb-3 font-display text-xl font-semibold tracking-tight">
        Comidas
      </h2>
      <EmptyState
        icon={<FoodIcon className="size-6" />}
        title="Sin comidas registradas"
        description="Tocá el botón + y dictá lo que comiste."
      />
    </>
  );
}
