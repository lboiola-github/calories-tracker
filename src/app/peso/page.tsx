import { EmptyState } from "@/components/ui/empty-state";
import { WeightIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Peso" };

export default function WeightPage() {
  return (
    <>
      <PageHeader title="Peso" />
      <EmptyState
        icon={<WeightIcon className="size-6" />}
        title="Sin registros de peso"
        description="Cargá tu peso cuando quieras. No hace falta hacerlo todos los días."
      />
    </>
  );
}
