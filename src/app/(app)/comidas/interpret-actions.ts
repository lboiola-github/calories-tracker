"use server";

import { requireUser } from "@/lib/auth";
import { InterpretError, interpretText, isAiConfigured } from "@/lib/ai/groq";
import { pickMatch, resolveGrams, type ResolvedItem } from "@/lib/ai/resolve";
import { getFoods, searchFoods } from "@/lib/data/foods";
import { addDays, DEFAULT_TIMEZONE, localDate, localHour } from "@/lib/dates";
import { suggestMealType, type MealType } from "@/lib/meals";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./actions";

export type Interpreted = { date: string; today: string; mealType: MealType; mealFromText: boolean; items: ResolvedItem[] };

/**
 * Interpreta un texto libre y lo cruza con el catálogo. No guarda nada: el cliente registra
 * con logItems (directo si todo está completo y validado, o después de revisar).
 */
export async function interpretMeal(text: string): Promise<ActionResult<Interpreted>> {
  const user = await requireUser();
  const input = typeof text === "string" ? text.trim().slice(0, 2000) : "";
  if (!input) return { ok: false, error: "Escribí qué comiste." };
  if (!isAiConfigured()) return { ok: false, error: "La interpretación automática todavía no está activa. Podés cargarlo a mano." };

  let parsed;
  try {
    parsed = await interpretText(input);
  } catch (e) {
    return { ok: false, error: e instanceof InterpretError ? e.message : "No se pudo interpretar. Podés cargarlo a mano." };
  }
  if (parsed.items.length === 0) return { ok: false, error: "No encontré alimentos en el texto. Probá con más detalle o cargalo a mano." };

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("timezone").eq("id", user.id).maybeSingle<{ timezone: string | null }>();
  const tz = profile?.timezone || DEFAULT_TIMEZONE;
  const now = new Date();
  const today = localDate(now, tz);

  const hitsPerItem = await Promise.all(
    parsed.items.map((it) => searchFoods(supabase, it.food).catch(() => [])),
  );
  const matches = parsed.items.map((it, i) => pickMatch(hitsPerItem[i], it.preparation));
  const foods = await getFoods(supabase, [...new Set(matches.flatMap((m) => (m ? [m.id] : [])))]);

  const items: ResolvedItem[] = parsed.items.map((it, i) => {
    const match = matches[i];
    const units = foods.find((f) => f.id === match?.id)?.units.map((u) => ({ name: u.name, grams: u.grams })) ?? [];
    const { unit, grams } = match ? resolveGrams(it.quantity, it.unit, units) : { unit: it.unit ?? "g", grams: null };
    return { ...it, unit, match, units, grams };
  });

  return {
    ok: true,
    data: {
      date: parsed.day === "yesterday" ? addDays(today, -1) : today,
      today,
      mealType: parsed.mealType ?? suggestMealType(localHour(now, tz)),
      mealFromText: parsed.mealType != null,
      items,
    },
  };
}
