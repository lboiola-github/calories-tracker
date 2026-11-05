// Evaluación con el modelo real de Groq sobre evals/interpretacion.json.
// Uso: GROQ_API_KEY=... npm run eval:ai   (sin clave se omite; consume cuota gratuita)
// Mide: alimentos encontrados, cantidades exactas, ninguna cantidad inventada, comida y día.
import { describe, expect, it } from "vitest";
import { groqRequestBody, sanitizeInterpretation } from "@/lib/ai/parse";
import cases from "./interpretacion.json";

type Case = { text: string; meal?: string; day?: string; items: { food: string; quantity: number | null; unit?: string; preparation?: string }[] };
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

describe.skipIf(!process.env.GROQ_API_KEY)("interpretación (Groq real)", () => {
  it(
    `${cases.length} mensajes argentinos`,
    async () => {
      const failures: string[] = [];
      for (const c of cases as Case[]) {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { authorization: `Bearer ${process.env.GROQ_API_KEY}`, "content-type": "application/json" },
          body: JSON.stringify(groqRequestBody(c.text)),
        });
        if (!res.ok) {
          failures.push(`${c.text}: HTTP ${res.status}`);
          continue;
        }
        const data = (await res.json()) as { choices: { message: { content: string } }[] };
        const out = sanitizeInterpretation(JSON.parse(data.choices[0].message.content), c.text);
        const problems: string[] = [];
        if (c.meal && out.mealType !== c.meal) problems.push(`comida ${out.mealType} ≠ ${c.meal}`);
        if (c.day && out.day !== c.day) problems.push(`día ${out.day} ≠ ${c.day}`);
        for (const exp of c.items) {
          const got = out.items.find((i) => norm(i.food).includes(norm(exp.food).slice(0, 5)));
          if (!got) problems.push(`falta ${exp.food}`);
          else {
            if (exp.quantity === null && got.quantity !== null) problems.push(`${exp.food}: inventó ${got.quantity}`);
            if (exp.quantity != null && got.quantity !== exp.quantity) problems.push(`${exp.food}: ${got.quantity} ≠ ${exp.quantity}`);
            if (exp.preparation && got.preparation !== exp.preparation) problems.push(`${exp.food}: ${got.preparation} ≠ ${exp.preparation}`);
          }
        }
        if (problems.length) failures.push(`${c.text}: ${problems.join("; ")}`);
        await new Promise((r) => setTimeout(r, 2500)); // límite gratuito por minuto
      }
      console.log(`${cases.length - failures.length}/${cases.length} correctos\n${failures.join("\n")}`);
      expect(failures).toEqual([]);
    },
    180_000,
  );
});
