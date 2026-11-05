import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { FoodIcon, SettingsIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";

const MACROS = [
  { label: "Proteínas", color: "bg-protein" },
  { label: "Carbohidratos", color: "bg-carbs" },
  { label: "Grasas", color: "bg-fat" },
] as const;

export default function DashboardPage() {
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

      <section aria-label="Resumen calórico" className="rounded-[28px] bg-surface p-5 shadow-sm">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium text-ink-2">Restantes</p>
          <p className="text-sm text-ink-3">Objetivo sin definir</p>
        </div>
        <p className="tabular mt-1 font-display text-[56px] font-bold leading-none tracking-tight text-ink-3">—</p>
        <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={0}>
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

      <Link
        href="/ajustes"
        className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-accent-soft px-4 py-3.5 text-[15px] font-medium text-accent"
      >
        Configurá tu perfil para calcular el objetivo
        <span aria-hidden>→</span>
      </Link>

      <h2 className="mt-8 mb-3 font-display text-xl font-semibold tracking-tight">Comidas</h2>
      <EmptyState
        icon={<FoodIcon className="size-6" />}
        title="Sin comidas registradas"
        description="Tocá el botón + y dictá lo que comiste."
      />
    </>
  );
}
