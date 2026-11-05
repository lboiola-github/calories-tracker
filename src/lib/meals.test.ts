import { describe, expect, it } from "vitest";
import { suggestMealType } from "./meals";

describe("comida sugerida por hora", () => {
  it.each([
    [7, "breakfast"],
    [13, "lunch"],
    [17, "snack"],
    [21, "dinner"],
    [2, "other"],
  ] as const)("%i h → %s", (h, t) => expect(suggestMealType(h)).toBe(t));
});
