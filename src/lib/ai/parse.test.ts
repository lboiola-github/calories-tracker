import { describe, expect, it } from "vitest";
import { numbersIn, sanitizeInterpretation } from "./parse";

describe("numbersIn", () => {
  it("lee dígitos, palabras y fracciones", () => {
    expect(numbersIn("230 g de pollo")).toContain(230);
    expect(numbersIn("1,5 kg")).toContain(1.5);
    expect(numbersIn("dos huevos")).toContain(2);
    expect(numbersIn("media taza de arroz")).toContain(0.5);
    expect(numbersIn("uno y medio alfajores")).toContain(1.5);
  });
});

describe("sanitizeInterpretation", () => {
  const input = "Almorcé 230 g de pechuga de pollo cocida y una ensalada";
  it("acepta cantidades que figuran en el texto", () => {
    const r = sanitizeInterpretation(
      {
        meal_type: "lunch",
        day: null,
        items: [
          { fragment: "230 g de pechuga de pollo cocida", food: "pechuga de pollo", quantity: 230, unit: "g", preparation: "cooked" },
          { fragment: "una ensalada", food: "ensalada", quantity: 1, unit: "unidad", preparation: null },
        ],
      },
      input,
    );
    expect(r.mealType).toBe("lunch");
    expect(r.items[0]).toMatchObject({ quantity: 230, unit: "g", preparation: "cooked", note: null });
    expect(r.items[1]).toMatchObject({ quantity: 1, unit: "unidad" });
  });
  it("descarta cantidades inventadas por el modelo", () => {
    const r = sanitizeInterpretation(
      { meal_type: null, day: null, items: [{ fragment: "una ensalada", food: "ensalada", quantity: 150, unit: "g", preparation: null }] },
      input,
    );
    expect(r.items[0]).toMatchObject({ quantity: null, unit: null });
    expect(r.items[0].note).toMatch(/no figura/);
  });
  it("si el fragmento no es del mensaje, verifica contra el mensaje entero", () => {
    const r = sanitizeInterpretation(
      { meal_type: null, day: null, items: [{ fragment: "300 g de pollo", food: "pollo", quantity: 300, unit: "g", preparation: null }] },
      input,
    );
    expect(r.items[0].quantity).toBeNull();
  });
  it("ignora valores fuera del esquema", () => {
    const r = sanitizeInterpretation(
      { meal_type: "brunch", day: null, items: [{ fragment: "x", food: "x", quantity: null, unit: "g", preparation: "smoked" }] },
      "x",
    );
    expect(r.mealType).toBeNull();
    expect(r.items[0]).toMatchObject({ unit: null, preparation: null });
  });
  it("rechaza respuestas que no cumplen el esquema", () => {
    expect(() => sanitizeInterpretation({ items: "nada" }, "x")).toThrow();
  });
});
