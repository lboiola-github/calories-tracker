import { z } from "zod";
import { isMealType, PREPARATIONS, type MealType } from "@/lib/meals";

/**
 * La IA solo separa el texto en ítems: alimento mencionado, cantidad, unidad y preparación.
 * Nunca da calorías ni nutrientes, y cada cantidad se verifica contra el texto original:
 * si no aparece escrita, se descarta y se le pide al usuario.
 */
export const INTERPRET_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["meal_type", "day", "items"],
  properties: {
    meal_type: { type: ["string", "null"], enum: ["breakfast", "lunch", "snack", "dinner", "other", null] },
    day: { type: ["string", "null"], enum: ["today", "yesterday", null] },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["fragment", "food", "quantity", "unit", "preparation"],
        properties: {
          fragment: { type: "string" },
          food: { type: "string" },
          quantity: { type: ["number", "null"] },
          unit: { type: ["string", "null"] },
          preparation: { type: ["string", "null"], enum: [...PREPARATIONS.map((p) => p.key).filter((k) => k !== "na"), null] },
        },
      },
    },
  },
} as const;

export const SYSTEM_PROMPT = `Sos un extractor de datos para una app de registro de comidas en español rioplatense.
Del mensaje del usuario extraé SOLO lo que dice explícitamente. Respondé con JSON según el esquema.
- items: un elemento por alimento o bebida mencionada.
  - fragment: la parte exacta del mensaje que habla de ese alimento, copiada textual.
  - food: el nombre del alimento en español, en singular y sin cantidad (ej. "pechuga de pollo", "tostada", "ensalada de lechuga y tomate").
  - quantity: el número que el usuario dijo (ej. "230 g" → 230, "dos huevos" → 2, "media taza" → 0.5). Si no dijo cantidad, null. NUNCA estimes ni completes cantidades.
  - unit: la unidad tal como la dijo ("g", "kg", "ml", "taza", "cucharada", "rebanada", "unidad"...). Para cosas contadas sin unidad ("dos huevos"), "unidad". Si no hay cantidad, null.
  - preparation: raw (crudo), cooked (cocido), boiled (hervido), grilled (plancha/grill), baked (al horno), roasted (asado), fried (frito), steamed (al vapor), o null si no lo dice.
- meal_type: breakfast (desayuno), lunch (almuerzo), snack (merienda), dinner (cena), other (colación/snack), o null si no lo dice.
- day: "yesterday" si dice ayer, "today" si dice hoy, o null.
No agregues alimentos que no estén en el mensaje. No incluyas calorías ni nutrientes.`;

const rawSchema = z.object({
  meal_type: z.string().nullable(),
  day: z.enum(["today", "yesterday"]).nullable(),
  items: z
    .array(
      z.object({
        fragment: z.string(),
        food: z.string(),
        quantity: z.number().nullable(),
        unit: z.string().nullable(),
        preparation: z.string().nullable(),
      }),
    )
    .max(30),
});

export type InterpretedItem = {
  fragment: string;
  food: string;
  quantity: number | null;
  unit: string | null;
  preparation: string | null;
  /** Por qué se descartó la cantidad, si se descartó. */
  note: string | null;
};
export type Interpretation = { mealType: MealType | null; day: "today" | "yesterday" | null; items: InterpretedItem[] };

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const WORDS: Record<string, number> = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, quince: 15, veinte: 20, medio: 0.5, media: 0.5, docena: 12, cuarto: 0.25,
};

/** Números escritos en el texto (dígitos con coma o punto, palabras y "y medio"). */
export function numbersIn(text: string): number[] {
  const t = norm(text);
  const out: number[] = [];
  for (const m of t.matchAll(/\d+(?:[.,]\d+)?/g)) out.push(Number(m[0].replace(",", ".")));
  for (const m of t.matchAll(/\b[a-z]+\b/g)) if (m[0] in WORDS) out.push(WORDS[m[0]]);
  // "uno y medio", "dos y media", "1 y medio"
  for (const m of t.matchAll(/\b(\d+|[a-z]+) y (medio|media)\b/g)) {
    const base = /\d/.test(m[1]) ? Number(m[1]) : WORDS[m[1]];
    if (base != null) out.push(base + 0.5);
  }
  if (/\bun cuarto\b/.test(t)) out.push(0.25);
  return out;
}

/** Valida y limpia la respuesta del modelo. Lanza si no cumple el esquema. */
export function sanitizeInterpretation(raw: unknown, input: string): Interpretation {
  const r = rawSchema.parse(raw);
  const source = norm(input);
  const items: InterpretedItem[] = [];
  for (const it of r.items) {
    const food = it.food.trim().slice(0, 120);
    if (!food) continue;
    let fragment = it.fragment.trim().slice(0, 300);
    // El fragmento tiene que salir del mensaje; si no, se usa el mensaje entero para verificar cantidades.
    if (!fragment || !source.includes(norm(fragment))) fragment = input;
    let quantity = it.quantity;
    let unit = it.unit?.trim().slice(0, 40) || null;
    let note: string | null = null;
    if (quantity != null) {
      const ok = quantity > 0 && quantity <= 10000 && numbersIn(fragment).some((n) => Math.abs(n - quantity!) < 1e-9);
      if (!ok) {
        note = "La cantidad no figura en el texto: indicála.";
        quantity = null;
        unit = null;
      }
    } else unit = null;
    const prep = it.preparation && PREPARATIONS.some((p) => p.key === it.preparation) ? it.preparation : null;
    items.push({ fragment, food, quantity, unit, preparation: prep, note });
  }
  return { mealType: isMealType(r.meal_type) ? r.meal_type : null, day: r.day, items };
}

export const GROQ_MODEL = "openai/gpt-oss-20b";

/** Cuerpo de la solicitud a Groq (compatible con OpenAI), con salida JSON estricta. */
export function groqRequestBody(text: string) {
  return {
    model: GROQ_MODEL,
    temperature: 0,
    max_completion_tokens: 1500,
    reasoning_effort: "low",
    response_format: { type: "json_schema", json_schema: { name: "comida", strict: true, schema: INTERPRET_SCHEMA } },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: text },
    ],
  };
}
