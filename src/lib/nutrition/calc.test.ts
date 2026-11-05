import { describe, expect, it } from "vitest";
import { dayProgress, energyMismatch, nutrientsFor, sumNutrients, toGrams, type Per100g } from "./calc";

const polloCocido: Per100g = { kcal: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0 };
const polloCrudo: Per100g = { kcal: 120, protein: 22.5, carbs: 0, fat: 2.6, fiber: 0 };
const arrozCocido: Per100g = { kcal: 130, protein: 2.7, carbs: 28.2, fat: 0.3, fiber: 0.4 };

describe("conversión a gramos", () => {
  it("gramos y kilos", () => {
    expect(toGrams(230, "g")).toBe(230);
    expect(toGrams(230, "gramos")).toBe(230);
    expect(toGrams(0.5, "kg")).toBe(500);
  });
  it("unidades definidas en el alimento, con plural y acentos", () => {
    const units = [{ name: "unidad", grams: 50 }, { name: "tostada", grams: 25 }, { name: "porción", grams: 150 }];
    expect(toGrams(2, "unidades", units)).toBe(100);
    expect(toGrams(2, "tostadas", units)).toBe(50);
    expect(toGrams(1, "porcion", units)).toBe(150);
  });
  it("no asume pesos desconocidos", () => {
    expect(toGrams(2, "unidades")).toBeNull();
    expect(toGrams(1, "taza", [{ name: "unidad", grams: 50 }])).toBeNull();
  });
  it("rechaza cantidades no positivas", () => {
    expect(toGrams(0, "g")).toBeNull();
    expect(toGrams(-5, "g")).toBeNull();
    expect(toGrams(Number.NaN, "g")).toBeNull();
  });
});

describe("cálculo de nutrientes", () => {
  it("230 g de pechuga cocida = 379,5 kcal", () => {
    expect(nutrientsFor(polloCocido, 230)).toEqual({ kcal: 379.5, protein: 71.3, carbs: 0, fat: 8.28, fiber: 0 });
  });
  it("crudo y cocido dan resultados distintos para el mismo peso", () => {
    const cocido = nutrientsFor(polloCocido, 200).kcal;
    const crudo = nutrientsFor(polloCrudo, 200).kcal;
    expect(cocido).toBe(330);
    expect(crudo).toBe(240);
    expect((cocido - crudo) / cocido).toBeGreaterThan(0.25);
  });
  it("suma de comidas sin errores de punto flotante", () => {
    const total = sumNutrients([nutrientsFor(polloCocido, 230), nutrientsFor(arrozCocido, 150)]);
    expect(total.kcal).toBe(574.5);
    expect(total.carbs).toBe(42.3);
    expect(total.protein).toBe(75.35);
  });
  it("0,1 + 0,2 en gramos se guarda exacto a 2 decimales", () => {
    expect(nutrientsFor({ kcal: 100, protein: 0.1, carbs: 0.2, fat: 0, fiber: null }, 300)).toEqual({
      kcal: 300,
      protein: 0.3,
      carbs: 0.6,
      fat: 0,
      fiber: null,
    });
  });
});

describe("consistencia energética", () => {
  it("pollo cocido es consistente", () => expect(energyMismatch(polloCocido)!).toBeLessThan(0.1));
  it("detecta un valor cargado mal (kJ en lugar de kcal)", () => {
    expect(energyMismatch({ kcal: 690, protein: 31, carbs: 0, fat: 3.6, fiber: 0 })!).toBeGreaterThan(0.5);
  });
  it("ignora alimentos casi sin energía", () => {
    expect(energyMismatch({ kcal: 15, protein: 1, carbs: 2, fat: 0.1, fiber: 1 })).toBeNull();
  });
});

describe("progreso del día", () => {
  it("restante y porcentaje", () => {
    expect(dayProgress(2000, 1500)).toEqual({ target: 2000, consumed: 1500, remaining: 500, percent: 75 });
  });
  it("permite restante negativo al superar el objetivo", () => {
    expect(dayProgress(2000, 2300).remaining).toBe(-300);
    expect(dayProgress(2000, 2300).percent).toBe(115);
  });
  it("sin objetivo no inventa restante", () => {
    expect(dayProgress(null, 800)).toEqual({ target: null, consumed: 800, remaining: null, percent: null });
  });
});
