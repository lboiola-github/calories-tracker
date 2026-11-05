import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { RecipeForm } from "../recipe-form";

export const metadata = { title: "Nueva receta" };

export default async function NewRecipePage() {
  await requireUser();
  return (
    <>
      <PageHeader title="Nueva receta" eyebrow="Recetas" />
      <RecipeForm initial={{ recipeId: null, name: "", lines: [], finalWeight: "", portions: "", notes: "" }} />
    </>
  );
}
