import { describe, expect, it } from "vitest";
import { formatKcal, formatMass, parseDecimal } from "./format";

describe("parseDecimal", () => {
  it.each([
    ["80,5", 80.5],
    ["80.5", 80.5],
    [" 175 ", 175],
    ["0,25", 0.25],
  ])("%s → %f", (raw, n) => expect(parseDecimal(raw)).toBe(n));
  it.each(["", "abc", "1.000,5", "80,5,1", "1e3"])("rechaza %s", (raw) => expect(parseDecimal(raw)).toBeNull());
});

describe("formatos", () => {
  it("kcal con separador de miles argentino", () => expect(formatKcal(2220.25)).toBe("2.220"));
  it("masa en g redondeada a 5 g o en kg", () => {
    expect(formatMass(454.5)).toBe("455 g");
    expect(formatMass(272.7)).toBe("275 g");
    expect(formatMass(1948.05)).toBe("1,9 kg");
  });
});
