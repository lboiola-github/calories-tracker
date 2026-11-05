import { EmptyState } from "@/components/ui/empty-state";
import { HistoryIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Historial" };

export default function HistoryPage() {
  return (
    <>
      <PageHeader title="Historial" />
      <EmptyState
        icon={<HistoryIcon className="size-6" />}
        title="Todavía no hay días registrados"
        description="Acá vas a poder recorrer los días anteriores y editar cada comida."
      />
    </>
  );
}
