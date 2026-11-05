import { requireUser } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { MEAL_TYPES } from "@/lib/meals";
import { createClient } from "@/lib/supabase/server";

const mealLabel = (t: string) => MEAL_TYPES.find((m) => m.key === t)?.label ?? t;
const PAGE = 1000;

/** Descarga tus datos en CSV. Solo los del usuario actual (RLS); las fotos no se incluyen. */
export async function GET(_req: Request, { params }: { params: Promise<{ tipo: string }> }) {
  await requireUser();
  const { tipo } = await params;
  const supabase = await createClient();
  let csv: string;

  if (tipo === "comidas") {
    const rows: Record<string, unknown>[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("meal_items")
        .select("quantity, unit, grams, food_name, preparation, kcal, protein_g, carbs_g, fat_g, fiber_g, source_type, input_text, created_at, meals!inner(meal_date, meal_type)")
        .is("deleted_at", null)
        .order("created_at")
        .range(from, from + PAGE - 1);
      if (error) return new Response("No se pudo exportar.", { status: 500 });
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    const meal = (r: Record<string, unknown>) => r.meals as { meal_date: string; meal_type: string };
    rows.sort((a, b) => meal(a).meal_date.localeCompare(meal(b).meal_date));
    csv = toCsv(
      ["Fecha", "Comida", "Alimento", "Preparación", "Cantidad", "Unidad", "Gramos", "kcal", "Proteínas (g)", "Carbohidratos (g)", "Grasas (g)", "Fibra (g)", "Fuente", "Texto"],
      rows.map((r) => [
        meal(r).meal_date,
        mealLabel(meal(r).meal_type),
        r.food_name as string,
        r.preparation as string,
        Number(r.quantity),
        r.unit as string,
        Number(r.grams),
        Number(r.kcal),
        Number(r.protein_g),
        Number(r.carbs_g),
        Number(r.fat_g),
        r.fiber_g == null ? null : Number(r.fiber_g),
        r.source_type as string,
        (r.input_text as string | null) ?? null,
      ]),
    );
  } else if (tipo === "peso") {
    const { data, error } = await supabase.from("weight_entries").select("entry_date, weight_kg, notes").order("entry_date");
    if (error) return new Response("No se pudo exportar.", { status: 500 });
    csv = toCsv(["Fecha", "Peso (kg)", "Nota"], (data ?? []).map((r) => [r.entry_date, Number(r.weight_kg), r.notes]));
  } else {
    return new Response("No encontrado", { status: 404 });
  }

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="calorias-${tipo}.csv"`,
      "cache-control": "no-store",
    },
  });
}
