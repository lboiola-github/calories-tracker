import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { FoodIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { listRecipes } from "@/lib/data/recipes";
import { formatGrams, formatKcal } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { CatalogTabs } from "../catalog-tabs";

export const metadata = { title: "Recetas" };

export default async function RecipesPage({ searchParams }: { searchParams: Promise<{ archivadas?: string }> }) {
  await requireUser();
  const archived = (await searchParams).archivadas === "1";
  const recipes = await listRecipes(await createClient(), { archived });

  return (
    <>
      <PageHeader
        title="Recetas"
        eyebrow="Alimentos y recetas"
        action={
          <Link href="/alimentos/recetas/nueva" className="mb-1 rounded-full bg-accent px-4 py-2 text-[15px] font-semibold text-accent-ink">
            Nueva
          </Link>
        }
      />
      <CatalogTabs current="recetas" />
      <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-surface-2 p-1 text-center text-[15px] font-medium">
        <Link href="/alimentos/recetas" className={`rounded-xl py-2 ${!archived ? "bg-track text-ink" : "text-ink-2"}`}>
          Activas
        </Link>
        <Link href="/alimentos/recetas?archivadas=1" className={`rounded-xl py-2 ${archived ? "bg-track text-ink" : "text-ink-2"}`}>
          Archivadas
        </Link>
      </div>
      {recipes.length === 0 ? (
        <EmptyState
          icon={<FoodIcon className="size-6" />}
          title={archived ? "No hay recetas archivadas" : "Todavía no tenés recetas"}
          description={
            archived
              ? "Las recetas que archives aparecen acá."
              : "Son opcionales: cargá las preparaciones caseras que repetís para registrarlas como un solo alimento."
          }
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-3xl bg-surface">
          {recipes.map((r) => {
            const v = r.versions[0];
            return (
              <li key={r.id}>
                <Link href={`/alimentos/recetas/${r.id}`} className="flex items-center justify-between gap-3 px-4 py-3.5 active:bg-surface-2">
                  <span className="min-w-0">
                    <span className="block truncate text-[16px] font-medium">{r.name}</span>
                    <span className="block truncate text-sm text-ink-3">
                      {v ? [`${formatGrams(v.finalWeightG)} g`, v.portions ? `${formatGrams(v.portions)} porciones` : null, `v${v.version}`].filter(Boolean).join(" · ") : "—"}
                    </span>
                  </span>
                  <span className="tabular shrink-0 text-sm text-ink-2">{v ? `${formatKcal(v.per100.kcal)} kcal/100 g` : ""}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
