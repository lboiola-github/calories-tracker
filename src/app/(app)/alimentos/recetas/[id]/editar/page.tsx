import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { getFoods } from "@/lib/data/foods";
import { getRecipe } from "@/lib/data/recipes";
import { createClient } from "@/lib/supabase/server";
import { RecipeForm, type IngredientLine } from "../../recipe-form";

export const metadata = { title: "Editar receta" };

const s = (n: number | null) => (n == null ? "" : String(n).replace(".", ","));

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const recipe = await getRecipe(supabase, id);
  if (!recipe || recipe.archived || !recipe.versions[0]) notFound();
  const v = recipe.versions[0];

  // Los ingredientes se editan con los valores actuales del catálogo; los que se borraron no se pueden reusar.
  const foods = await getFoods(supabase, v.ingredients.flatMap((i) => (i.foodId ? [i.foodId] : [])));
  const lines: IngredientLine[] = [];
  const missing: string[] = [];
  for (const i of v.ingredients) {
    const f = foods.find((x) => x.id === i.foodId);
    if (!f || f.archived) {
      missing.push(i.foodName);
      continue;
    }
    const units = f.units.map((u) => ({ name: u.name, grams: u.grams }));
    const unit = i.unit === "g" || units.some((u) => u.name === i.unit) ? i.unit : "g";
    lines.push({
      food: { id: f.id, name: f.name, preparation: f.preparation, brand: f.brand, kcalPer100g: f.per100.kcal, validated: f.validated, score: 1 },
      quantity: s(unit === i.unit ? i.quantity : i.grams),
      unit,
      units,
    });
  }

  return (
    <>
      <PageHeader title={recipe.name} eyebrow={`Editar · se guarda como versión ${recipe.currentVersion + 1}`} />
      {missing.length > 0 && (
        <p role="status" className="mb-4 rounded-2xl bg-surface p-4 text-sm text-danger">
          Estos ingredientes ya no están en tu catálogo y se quitaron: {missing.join(", ")}.
        </p>
      )}
      <RecipeForm
        initial={{
          recipeId: recipe.id,
          name: recipe.name,
          lines,
          finalWeight: v.finalWeightMeasured ? s(v.finalWeightG) : "",
          portions: s(v.portions),
          notes: v.notes ?? "",
        }}
      />
    </>
  );
}
