import Link from "next/link";
import { DayView } from "@/components/day/day-view";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { loadDay } from "@/lib/data/day";
import { loadMetabolicState, targetFor } from "@/lib/data/metabolism";
import { addDays, isIsoDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { DatePicker } from "./date-picker";

export const metadata = { title: "Historial" };

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  const user = await requireUser();
  const supabase = await createClient();
  const state = await loadMetabolicState(supabase, user.id);
  const requested = (await searchParams).fecha;
  const date = requested && isIsoDate(requested) && requested <= state.today ? requested : addDays(state.today, -1);
  const [target, day] = await Promise.all([targetFor(supabase, date), loadDay(supabase, date)]);
  const isToday = date === state.today;

  return (
    <>
      <PageHeader title="Historial" eyebrow={isToday ? "Hoy" : undefined} />
      <nav aria-label="Cambiar de día" className="mb-4 flex items-center justify-between rounded-2xl bg-surface p-1.5">
        <Link href={`/historial?fecha=${addDays(date, -1)}`} aria-label="Día anterior" className="grid size-10 place-items-center rounded-xl text-xl text-ink-2 active:bg-surface-2">
          ‹
        </Link>
        <DatePicker date={date} max={state.today} />
        {isToday ? (
          <span className="size-10" />
        ) : (
          <Link href={`/historial?fecha=${addDays(date, 1)}`} aria-label="Día siguiente" className="grid size-10 place-items-center rounded-xl text-xl text-ink-2 active:bg-surface-2">
            ›
          </Link>
        )}
      </nav>
      <DayView day={day} target={target} />
    </>
  );
}
