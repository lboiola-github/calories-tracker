import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { getFood } from "@/lib/data/foods";
import { createClient } from "@/lib/supabase/server";
import { FoodForm } from "../food-form";
import { FoodDangerZone } from "./danger-zone";

export const metadata = { title: "Editar alimento" };

const s = (n: number | null) => (n == null ? "" : String(n).replace(".", ","));

export default async function FoodPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const food = await getFood(await createClient(), id);
  if (!food) notFound();
  // El alimento de una receta se edita desde la receta.
  if (food.recipeId) redirect(`/alimentos/recetas/${food.recipeId}`);

  return (
    <>
      <PageHeader title={food.name} eyebrow="Editar alimento" />
      <p className="mb-5 rounded-2xl bg-surface p-4 text-sm text-ink-2">
        Cambiar estos valores no modifica las comidas ya registradas: cada registro guarda los valores que se usaron.
      </p>
      <FoodForm
        values={{
          id: food.id,
          name: food.name,
          preparation: food.preparation,
          brand: food.brand ?? "",
          kcal: s(food.per100.kcal),
          protein: s(food.per100.protein),
          carbs: s(food.per100.carbs),
          fat: s(food.per100.fat),
          fiber: s(food.per100.fiber),
          sourceType: food.sourceType,
          sourceRef: food.sourceRef ?? "",
          validated: food.validated,
          units: food.units.map((u) => ({ name: u.name, grams: s(u.grams) })),
          aliases: food.aliases.map((a) => a.alias).join(", "),
        }}
      />
      <FoodDangerZone id={food.id} archived={food.archived} />
    </>
  );
}
