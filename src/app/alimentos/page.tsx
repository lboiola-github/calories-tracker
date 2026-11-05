import { EmptyState } from "@/components/ui/empty-state";
import { FoodIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Alimentos y recetas" };

export default function FoodsPage() {
  return (
    <>
      <PageHeader title="Alimentos" eyebrow="Alimentos y recetas" />
      <EmptyState
        icon={<FoodIcon className="size-6" />}
        title="Tu catálogo está vacío"
        description="Los alimentos que valides y tus recetas aparecen acá, listos para volver a usarlos."
      />
    </>
  );
}
