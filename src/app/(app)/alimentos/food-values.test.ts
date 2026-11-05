import { describe, expect, it } from "vitest";
import { applyReference, EMPTY_FOOD } from "./food-values";

const usda = {
  source: "usda" as const,
  ref: "171477",
  name: "Chicken, breast, roasted",
  brand: null,
  per100: { kcal: 165, protein: 31.02, carbs: 0, fat: 3.57, fiber: null },
  portions: [{ name: "1 cup, chopped", grams: 140 }],
  energyMismatch: 0.02,
};

describe("applyReference", () => {
  it("carga valores y fuente, conservando lo que escribió el usuario", () => {
    const v = applyReference({ ...EMPTY_FOOD, name: "Pechuga de pollo", preparation: "cooked", aliases: "pechu" }, usda);
    expect(v).toMatchObject({
      name: "Pechuga de pollo",
      preparation: "cooked",
      aliases: "pechu",
      kcal: "165",
      protein: "31,02",
      fat: "3,57",
      fiber: "",
      sourceType: "usda",
      sourceRef: "171477",
      validated: true,
      units: [{ name: "1 cup, chopped", grams: "140" }],
    });
  });

  it("usa el nombre de la referencia si no había y no duplica unidades", () => {
    const v = applyReference({ ...EMPTY_FOOD, units: [{ name: "1 Cup, chopped", grams: "150" }] }, usda);
    expect(v.name).toBe("Chicken, breast, roasted");
    expect(v.units).toEqual([{ name: "1 Cup, chopped", grams: "150" }]);
  });

  it("deja sin validar los datos colaborativos o inconsistentes", () => {
    expect(applyReference(EMPTY_FOOD, { ...usda, source: "off" }).validated).toBe(false);
    expect(applyReference(EMPTY_FOOD, { ...usda, energyMismatch: 0.4 }).validated).toBe(false);
  });
});
