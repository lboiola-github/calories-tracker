import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { FoodForm } from "../food-form";
import { EMPTY_FOOD } from "../food-values";

export const metadata = { title: "Nuevo alimento" };

export default async function NewFoodPage({ searchParams }: { searchParams: Promise<{ nombre?: string; volver?: string }> }) {
  await requireUser();
  const { nombre, volver } = await searchParams;
  return (
    <>
      <PageHeader title="Nuevo alimento" />
      <FoodForm values={{ ...EMPTY_FOOD, name: nombre?.slice(0, 120) ?? "" }} returnTo={volver} />
    </>
  );
}
