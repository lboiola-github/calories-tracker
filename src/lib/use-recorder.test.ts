import { describe, expect, it } from "vitest";
import { levelFromRms } from "./use-recorder";

describe("nivel de la animación al escuchar", () => {
  it("el ruido ambiente no la mueve", () => {
    expect(levelFromRms(0)).toBe(0);
    expect(levelFromRms(0.02)).toBe(0);
    expect(levelFromRms(0.035)).toBe(0);
  });
  it("crece con la voz y el máximo queda igual", () => {
    expect(levelFromRms(0.1)).toBeGreaterThan(0);
    expect(levelFromRms(0.1)).toBeLessThan(1);
    expect(levelFromRms(1 / 6)).toBe(1);
    expect(levelFromRms(0.5)).toBe(1);
  });
});
