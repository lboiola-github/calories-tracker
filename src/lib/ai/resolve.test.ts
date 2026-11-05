import { describe, expect, it } from "vitest";
import { canAutoLog, pickMatch, resolveGrams, type ResolvedItem } from "./resolve";

const hit = (id: string, preparation: string, score: number, validated = true) => ({ id, name: id, preparation, brand: null, kcalPer100g: 100, validated, score });

describe("pickMatch", () => {
  it("prefiere la misma preparación", () => {
    expect(pickMatch([hit("crudo", "raw", 0.9), hit("cocido", "cooked", 0.8)], "cooked")?.id).toBe("cocido");
  });
  it("no elige otra preparación si el usuario dijo una", () => {
    expect(pickMatch([hit("crudo", "raw", 0.9)], "cooked")).toBeNull();
  });
  it("descarta coincidencias débiles", () => {
    expect(pickMatch([hit("x", "na", 0.3)], null)).toBeNull();
  });
});

describe("resolveGrams", () => {
  it("convierte con las unidades del alimento", () => {
    expect(resolveGrams(2, "unidad", [{ name: "unidad", grams: 50 }])).toEqual({ unit: "unidad", grams: 100 });
    expect(resolveGrams(230, "g", [])).toEqual({ unit: "g", grams: 230 });
  });
  it("sin unidad conocida no inventa gramos", () => {
    expect(resolveGrams(1, "taza", [])).toEqual({ unit: "taza", grams: null });
    expect(resolveGrams(null, null, [])).toEqual({ unit: "g", grams: null });
  });
});

describe("canAutoLog", () => {
  const base: ResolvedItem = { fragment: "", food: "", quantity: 1, unit: "g", preparation: null, note: null, match: hit("a", "na", 1), units: [], grams: 100 };
  it("solo con todo completo y validado", () => {
    expect(canAutoLog([base])).toBe(true);
    expect(canAutoLog([{ ...base, match: hit("a", "na", 1, false) }])).toBe(false);
    expect(canAutoLog([{ ...base, grams: null }])).toBe(false);
    expect(canAutoLog([])).toBe(false);
  });
});
