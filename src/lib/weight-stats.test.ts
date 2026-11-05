import { describe, expect, it } from "vitest";
import { chartPath, weightChange } from "./weight-stats";

const pts = [
  { date: "2025-03-01", kg: 85 },
  { date: "2025-03-05", kg: 84.2 },
  { date: "2025-03-20", kg: 83 },
  { date: "2025-03-31", kg: 82.4 },
];

describe("weightChange", () => {
  it("compara con el registro más reciente que tenga al menos N días", () => {
    expect(weightChange(pts, 7)).toEqual({ kg: -0.6, from: "2025-03-20" });
    expect(weightChange(pts, 30)).toEqual({ kg: -2.6, from: "2025-03-01" });
  });
  it("sin registros tan viejos no inventa un cambio", () => {
    expect(weightChange(pts, 60)).toBeNull();
    expect(weightChange([pts[0]], 7)).toBeNull();
  });
});

describe("chartPath", () => {
  it("escala el eje X por días reales y el Y por el rango", () => {
    const c = chartPath(pts, 308, 100, 8)!;
    expect(c.points[0]).toMatchObject({ x: 8, y: 8 });
    expect(c.points[3]).toMatchObject({ x: 300, y: 92 });
    expect(c.d.startsWith("M8.0,8.0")).toBe(true);
  });
  it("un solo punto queda centrado", () => {
    expect(chartPath([pts[0]], 100, 50)!.points[0].x).toBe(50);
  });
});
