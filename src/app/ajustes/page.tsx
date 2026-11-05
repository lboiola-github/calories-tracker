import { EmptyState } from "@/components/ui/empty-state";
import { SettingsIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Configuración" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Configuración" />
      <EmptyState
        icon={<SettingsIcon className="size-6" />}
        title="Perfil y objetivos"
        description="Datos personales, metabolismo estimado y objetivo calórico diario."
      />
    </>
  );
}
