import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { loadMetabolicState } from "@/lib/data/metabolism";
import { isIsoDate, localHour } from "@/lib/dates";
import { isMealType, suggestMealType } from "@/lib/meals";
import { createClient } from "@/lib/supabase/server";
import { ManualLogger } from "./manual-logger";

export const metadata = { title: "Registrar" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ fecha?: string; comida?: string; q?: string }> }) {
  const user = await requireUser();
  const state = await loadMetabolicState(await createClient(), user.id);
  const sp = await searchParams;
  const date = sp.fecha && isIsoDate(sp.fecha) && sp.fecha <= state.today ? sp.fecha : state.today;
  const meal = isMealType(sp.comida) ? sp.comida : suggestMealType(localHour(new Date(), state.timezone));
  return (
    <>
      <PageHeader title="Registrar" eyebrow="Carga manual" />
      <ManualLogger date={date} today={state.today} initialMeal={meal} initialQuery={sp.q?.slice(0, 120) ?? ""} />
    </>
  );
}
