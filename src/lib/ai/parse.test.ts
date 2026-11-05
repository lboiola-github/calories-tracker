import { describe, expect, it } from "vitest";
import { numbersIn, sanitizeInterpretation, wordBefore } from "./parse";

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
          {
            fragment: "230 g de pechuga de pollo cocida",
            food: "pechuga de pollo",
            quantity: 230,
            unit: "g",
            preparation: "cooked",
          },
          {
            fragment: "una ensalada",
            food: "ensalada",
            quantity: 1,
            unit: "unidad",
            preparation: null,
          },
        ],
      },
      input,
    );
    expect(r.mealType).toBe("lunch");
    expect(r.items[0]).toMatchObject({
      quantity: 230,
      unit: "g",
      preparation: "cooked",
      note: null,
    });
    expect(r.items[1]).toMatchObject({ quantity: 1, unit: "unidad" });
  });
  it("descarta cantidades inventadas por el modelo", () => {
    const r = sanitizeInterpretation(
      {
        meal_type: null,
        day: null,
        items: [
          {
            fragment: "una ensalada",
            food: "ensalada",
            quantity: 150,
            unit: "g",
            preparation: null,
          },
        ],
      },
      input,
    );
    expect(r.items[0]).toMatchObject({ quantity: null, unit: null });
    expect(r.items[0].note).toMatch(/no figura/);
  });
  it("acepta el artículo justo antes del fragmento, pero no números más lejanos", () => {
    const one = sanitizeInterpretation(
      {
        meal_type: null,
        day: null,
        items: [
          {
            fragment: "vaso de leche descremada",
            food: "leche descremada",
            quantity: 1,
            unit: "vaso",
            preparation: null,
          },
        ],
      },
      "un vaso de leche descremada",
    );
    expect(one.items[0].quantity).toBe(1);
    const far = sanitizeInterpretation(
      {
        meal_type: null,
        day: null,
        items: [
          {
            fragment: "banana",
            food: "banana",
            quantity: 2,
            unit: null,
            preparation: null,
          },
        ],
      },
      "2 huevos y banana",
    );
    expect(far.items[0].quantity).toBeNull();
  });

  it("el artículo un/una cuenta como 1 si el modelo no dio cantidad", () => {
    const item = (fragment: string, food: string) => ({
      fragment,
      food,
      quantity: null,
      unit: null,
      preparation: null,
    });
    const out = sanitizeInterpretation(
      {
        meal_type: null,
        day: null,
        items: [
          item("una manzana verde", "manzana"),
          item("té", "té"),
          item("café con leche", "café con leche"),
          item("vaso de jugo", "jugo"),
          item("un poco de queso", "queso"),
          item("medialunas", "medialuna"),
        ],
      },
      "una manzana verde, un té, un café con leche, un vaso de jugo, un poco de queso y medialunas",
    );
    expect(out.items.map((i) => [i.quantity, i.unit])).toEqual([
      [1, "unidad"],
      [1, "unidad"],
      [1, "unidad"],
      [1, "vaso"],
      [null, null],
      [null, null],
    ]);
  });

  it("wordBefore busca palabras completas", () => {
    expect(wordBefore("un te y una tostada", "te")).toBe("un");
    expect(wordBefore("verde te", "te")).toBe("verde");
    expect(wordBefore("comi tostadas", "te")).toBe("");
    expect(wordBefore("te", "te")).toBe("");
  });

  it("si el fragmento no es del mensaje, verifica contra el mensaje entero", () => {
    const r = sanitizeInterpretation(
      {
        meal_type: null,
        day: null,
        items: [
          {
            fragment: "300 g de pollo",
            food: "pollo",
            quantity: 300,
            unit: "g",
            preparation: null,
          },
        ],
      },
      input,
    );
    expect(r.items[0].quantity).toBeNull();
  });
  it("ignora valores fuera del esquema", () => {
    const r = sanitizeInterpretation(
      {
        meal_type: "brunch",
        day: null,
        items: [
          {
            fragment: "x",
            food: "x",
            quantity: null,
            unit: "g",
            preparation: "smoked",
          },
        ],
      },
      "x",
    );
    expect(r.mealType).toBeNull();
    expect(r.items[0]).toMatchObject({ unit: null, preparation: null });
  });
  it("rechaza respuestas que no cumplen el esquema", () => {
    expect(() => sanitizeInterpretation({ items: "nada" }, "x")).toThrow();
  });
});
