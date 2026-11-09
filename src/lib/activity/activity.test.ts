import { describe, expect, it } from "vitest";
import { distanceKcal, isActivityKind } from "./activity";

describe("calorías de actividad", () => {
  it("correr: kg × km", () => {
    expect(distanceKcal("run", 5, 80)).toBe(400);
    expect(distanceKcal("run", 7.5, 82.4)).toBe(618);
  });
  it("caminar: la mitad que correr a igual distancia", () => {
    expect(distanceKcal("walk", 4, 80)).toBe(160);
  });
  it("sin peso o sin distancia válida no inventa", () => {
    expect(distanceKcal("run", 5, null)).toBeNull();
    expect(distanceKcal("walk", 0, 80)).toBeNull();
    expect(distanceKcal("run", Number.NaN, 80)).toBeNull();
  });
  it("gimnasio y fútbol no tienen fórmula", () => {
    expect(distanceKcal("gym", 5, 80)).toBeNull();
    expect(distanceKcal("football", 5, 80)).toBeNull();
  });
  it("solo los cuatro tipos", () => {
    expect(isActivityKind("run")).toBe(true);
    expect(isActivityKind("swim")).toBe(false);
  });
});
