import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { FoodIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { listFoods } from "@/lib/data/foods";
import { createClient } from "@/lib/supabase/server";
import { FoodList } from "./food-list";

export const metadata = { title: "Alimentos y recetas" };

export default async function FoodsPage({ searchParams }: { searchParams: Promise<{ archivados?: string }> }) {
  await requireUser();
  const archived = (await searchParams).archivados === "1";
  const foods = await listFoods(await createClient(), { archived });

  return (
    <>
      <PageHeader
        title="Alimentos"
        eyebrow="Alimentos y recetas"
        action={
          <Link href="/alimentos/nuevo" className="mb-1 rounded-full bg-accent px-4 py-2 text-[15px] font-semibold text-accent-ink">
            Nuevo
          </Link>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-surface-2 p-1 text-center text-[15px] font-medium">
        <Link href="/alimentos" className={`rounded-xl py-2 ${!archived ? "bg-surface shadow-sm" : "text-ink-2"}`}>
          Activos
        </Link>
        <Link href="/alimentos?archivados=1" className={`rounded-xl py-2 ${archived ? "bg-surface shadow-sm" : "text-ink-2"}`}>
          Archivados
        </Link>
      </div>
      {foods.length === 0 ? (
        <EmptyState
          icon={<FoodIcon className="size-6" />}
          title={archived ? "No hay alimentos archivados" : "Tu catálogo está vacío"}
          description={
            archived
              ? "Los alimentos que archives aparecen acá."
              : "Agregá los alimentos que comés seguido con los valores de su etiqueta o de una referencia confiable."
          }
        />
      ) : (
        <FoodList
          foods={foods.map((f) => ({
            id: f.id,
            name: f.name,
            brand: f.brand,
            preparation: f.preparation,
            kcal: f.per100.kcal,
            validated: f.validated,
            aliases: f.aliases.map((a) => a.alias),
          }))}
        />
      )}
    </>
  );
}
