import Link from "next/link";
import { DayView } from "@/components/day/day-view";
import { SettingsIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { loadDay } from "@/lib/data/day";
import { loadMetabolicState, targetFor } from "@/lib/data/metabolism";
import { formatLongDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const state = await loadMetabolicState(supabase, user.id);
  const [target, day] = await Promise.all([targetFor(supabase, state.today), loadDay(supabase, state.today)]);

  return (
    <>
      <PageHeader
        eyebrow={`Hoy, ${formatLongDate(state.today)}`}
        title="Inicio"
        action={
          <Link href="/ajustes" aria-label="Configuración" className="mb-1 grid size-10 place-items-center rounded-full bg-surface text-ink-2 shadow-sm">
            <SettingsIcon className="size-5" />
          </Link>
        }
      />
      <DayView day={day} target={target} />
      {target == null && (
        <Link
          href="/ajustes"
          className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-accent-soft px-4 py-3.5 text-[15px] font-medium text-accent"
        >
          Configurá tu perfil para calcular el objetivo
          <span aria-hidden>→</span>
        </Link>
      )}
    </>
  );
}
