import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { getRecipe } from "@/lib/data/recipes";
import { formatGrams, formatKcal } from "@/lib/format";
import { preparationLabel } from "@/lib/meals";
import { createClient } from "@/lib/supabase/server";
import { ArchiveRecipeButton } from "./archive-button";

export const metadata = { title: "Receta" };

const dateFmt = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Argentina/Cordoba" });

export default async function RecipePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ version?: string }> }) {
  await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const recipe = await getRecipe(await createClient(), id);
  if (!recipe || recipe.versions.length === 0) notFound();
  const wanted = Number((await searchParams).version);
  const v = recipe.versions.find((x) => x.version === wanted) ?? recipe.versions[0];
  const isCurrent = v.version === recipe.currentVersion;

  return (
    <>
      <PageHeader
        title={v.name}
        eyebrow={`Receta · versión ${v.version}${isCurrent ? "" : " (anterior)"}${recipe.archived ? " · archivada" : ""}`}
        action={
          isCurrent && !recipe.archived ? (
            <Link href={`/alimentos/recetas/${recipe.id}/editar`} className="mb-1 rounded-full bg-surface-2 px-4 py-2 text-[15px] font-semibold">
              Editar
            </Link>
          ) : undefined
        }
      />

      <section aria-label="Valores" className="rounded-3xl bg-surface p-5">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-surface-2 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Por 100 g</p>
            <p className="tabular mt-0.5 text-xl font-semibold" data-testid="per100">
              {formatKcal(v.per100.kcal)} <span className="text-sm font-normal text-ink-2">kcal</span>
            </p>
          </div>
          <div className="rounded-2xl bg-surface-2 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-3">{v.portions ? "Por porción" : "Receta entera"}</p>
            <p className="tabular mt-0.5 text-xl font-semibold">
              {formatKcal(v.portions ? v.total.kcal / v.portions : v.total.kcal)} <span className="text-sm font-normal text-ink-2">kcal</span>
            </p>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
          {(
            [
              ["Proteínas", v.per100.protein],
              ["Carbohidratos", v.per100.carbs],
              ["Grasas", v.per100.fat],
            ] as const
          ).map(([label, g]) => (
            <div key={label}>
              <dt className="text-ink-3">{label}</dt>
              <dd className="tabular font-semibold">{formatGrams(g)} g</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm text-ink-2">
          Peso final {formatGrams(v.finalWeightG)} g {v.finalWeightMeasured ? "(pesado)" : "(suma de ingredientes)"}
          {v.portions ? ` · ${formatGrams(v.portions)} porciones de ${formatGrams(v.finalWeightG / v.portions)} g` : ""}. Total {formatKcal(v.total.kcal)} kcal.
        </p>
        {v.notes && <p className="mt-2 whitespace-pre-line text-sm text-ink-2">{v.notes}</p>}
      </section>

      <h2 className="mb-2 mt-6 text-sm font-medium text-ink-2">Ingredientes</h2>
      <ul className="divide-y divide-line overflow-hidden rounded-3xl bg-surface">
        {v.ingredients.map((i) => (
          <li key={i.position} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="min-w-0">
              <span className="block truncate font-medium">{i.foodName}</span>
              <span className="block truncate text-sm text-ink-3">
                {[i.unit === "g" ? `${formatGrams(i.grams)} g` : `${formatGrams(i.quantity)} ${i.unit} (${formatGrams(i.grams)} g)`, i.preparation !== "na" ? preparationLabel(i.preparation) : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
            <span className="tabular shrink-0 text-sm text-ink-2">{formatKcal(i.kcal)} kcal</span>
          </li>
        ))}
      </ul>

      <h2 className="mb-2 mt-6 text-sm font-medium text-ink-2">Versiones</h2>
      <p className="mb-2 text-sm text-ink-3">Editar crea una versión nueva. Las comidas ya registradas conservan los valores con que se registraron.</p>
      <ul className="divide-y divide-line overflow-hidden rounded-3xl bg-surface" aria-label="Versiones">
        {recipe.versions.map((x) => (
          <li key={x.id}>
            <Link
              href={`/alimentos/recetas/${recipe.id}?version=${x.version}`}
              aria-current={x.version === v.version ? "true" : undefined}
              className={`flex justify-between gap-3 px-4 py-3 active:bg-surface-2 ${x.version === v.version ? "text-accent" : ""}`}
            >
              <span>
                Versión {x.version}
                {x.version === recipe.currentVersion ? " · actual" : ""}
                <span className="block text-sm text-ink-3">{dateFmt.format(new Date(x.createdAt))}</span>
              </span>
              <span className="tabular text-sm text-ink-2">{formatKcal(x.per100.kcal)} kcal/100 g</span>
            </Link>
          </li>
        ))}
      </ul>

      <ArchiveRecipeButton id={recipe.id} archived={recipe.archived} />
    </>
  );
}
