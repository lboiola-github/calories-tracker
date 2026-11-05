import { signOut } from "@/app/login/actions";
import { EmptyState } from "@/components/ui/empty-state";
import { SettingsIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Configuración" };

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="Configuración" />
      <EmptyState
        icon={<SettingsIcon className="size-6" />}
        title="Perfil y objetivos"
        description="Datos personales, metabolismo estimado y objetivo calórico diario."
      />
      <section className="mt-8 rounded-3xl bg-surface p-5">
        <p className="text-sm text-ink-3">Sesión iniciada como</p>
        <p className="mt-0.5 truncate text-[17px] font-medium">{user.email}</p>
        <form action={signOut} className="mt-4">
          <button type="submit" className="h-11 w-full rounded-2xl bg-surface-2 text-[15px] font-medium text-danger">
            Cerrar sesión
          </button>
        </form>
      </section>
    </>
  );
}
