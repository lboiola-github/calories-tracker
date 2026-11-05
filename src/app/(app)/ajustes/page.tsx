import { signOut } from "@/app/login/actions";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { loadMetabolicState } from "@/lib/data/metabolism";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Configuración" };

export default async function SettingsPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const state = await loadMetabolicState(supabase, user.id);

  return (
    <>
      <PageHeader title="Configuración" />
      <SettingsForm initial={state.inputs} today={state.today} />
      <section className="mt-10 rounded-3xl bg-surface p-5">
        <p className="text-sm text-ink-3">Sesión iniciada como</p>
        <p className="mt-0.5 truncate text-[17px] font-medium">{user.email}</p>
        <p className="mt-1 text-sm text-ink-3">Zona horaria: {state.timezone}</p>
        <form action={signOut} className="mt-4">
          <button type="submit" className="h-11 w-full rounded-2xl bg-surface-2 text-[15px] font-medium text-danger">
            Cerrar sesión
          </button>
        </form>
      </section>
    </>
  );
}
