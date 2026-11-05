import { describe, expect, it } from "vitest";
import { checkCase, silentWav } from "./eval";

describe("checkCase", () => {
  const c = {
    text: "x",
    meal: "lunch",
    items: [
      { food: "pollo", quantity: 230 },
      { food: "tostada", quantity: null },
    ],
  };
  it("acepta lo esperado", () => {
    expect(
      checkCase(c, {
        mealType: "lunch",
        day: null,
        items: [
          {
            fragment: "",
            food: "pollo cocido",
            quantity: 230,
            unit: "g",
            preparation: "cooked",
          },
          {
            fragment: "",
            food: "tostadas",
            quantity: null,
            unit: null,
            preparation: null,
          },
        ],
      } as never),
    ).toEqual([]);
  });
  it("marca cantidades inventadas, faltantes y comida equivocada", () => {
    const p = checkCase(c, {
      mealType: "dinner",
      day: null,
      items: [
        {
          fragment: "",
          food: "tostada",
          quantity: 2,
          unit: null,
          preparation: null,
        },
      ],
    } as never);
    expect(p).toEqual([
      "comida dinner ≠ lunch",
      "falta pollo",
      "tostada: inventó 2",
    ]);
  });
});

it("silentWav arma un WAV válido", async () => {
  const b = silentWav(0.5, 8000);
  const bytes = new Uint8Array(await b.arrayBuffer());
  expect(b.size).toBe(44 + 8000);
  expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("RIFF");
});
