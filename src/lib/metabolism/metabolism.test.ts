import { describe, expect, it } from "vitest";
import { ACTIVITY_LEVELS, DEFICIT_OPTIONS, activityFactor } from "./config";
import {
  ageOn,
  estimateTdee,
  mifflinStJeor,
  projectedLoss,
  resolveMetabolism,
  targetWarnings,
  type MetabolicInputs,
} from "./metabolism";

const base: MetabolicInputs = {
  birthDate: "1990-06-15",
  sex: "male",
  heightCm: 180,
  weightKg: 80,
  activityLevel: "moderate",
  bmrManual: null,
  tdeeManual: null,
  targetManual: null,
  deficitKcal: 500,
};
const ON = "2025-06-15"; // 35 años cumplidos ese día

describe("edad", () => {
  it("cuenta años cumplidos", () => {
    expect(ageOn("1990-06-15", "2025-06-15")).toBe(35);
    expect(ageOn("1990-06-15", "2025-06-14")).toBe(34);
    expect(ageOn("2000-02-29", "2025-02-28")).toBe(24);
    expect(ageOn("2000-02-29", "2025-03-01")).toBe(25);
  });
});

describe("Mifflin-St Jeor", () => {
  it("hombre de 35 años, 80 kg, 180 cm → 1755 kcal", () => {
    expect(mifflinStJeor({ weightKg: 80, heightCm: 180, ageYears: 35, sex: "male" })).toBe(1755);
  });
  it("mujer de 30 años, 65 kg, 165 cm → 1370,25 kcal", () => {
    expect(mifflinStJeor({ weightKg: 65, heightCm: 165, ageYears: 30, sex: "female" })).toBeCloseTo(1370.25, 6);
  });
  it("la diferencia por sexo es de 166 kcal", () => {
    const m = mifflinStJeor({ weightKg: 70, heightCm: 170, ageYears: 40, sex: "male" });
    const f = mifflinStJeor({ weightKg: 70, heightCm: 170, ageYears: 40, sex: "female" });
    expect(m - f).toBe(166);
  });
  it("rechaza datos inválidos", () => {
    expect(() => mifflinStJeor({ weightKg: 0, heightCm: 180, ageYears: 30, sex: "male" })).toThrow();
  });
});

describe("TDEE y factores", () => {
  it("usa exactamente los factores definidos", () => {
    expect(ACTIVITY_LEVELS.map((a) => a.factor)).toEqual([1.2, 1.375, 1.55, 1.725, 1.9]);
    expect(activityFactor("high")).toBe(1.725);
  });
  it("1755 × 1,55 = 2720,25", () => {
    expect(estimateTdee(1755, "moderate")).toBeCloseTo(2720.25, 6);
  });
});

describe("proyecciones de pérdida", () => {
  it("las opciones de déficit son 300, 500, 650 y 800", () => {
    expect([...DEFICIT_OPTIONS]).toEqual([300, 500, 650, 800]);
  });
  it.each([
    [300, 272.7, 1168.8],
    [500, 454.5, 1948.1],
    [650, 590.9, 2532.5],
    [800, 727.3, 3116.9],
  ])("déficit %i → %f g/semana y %f g/mes", (deficit, weekly, monthly) => {
    const p = projectedLoss(deficit);
    expect(p.weeklyGrams).toBeCloseTo(weekly, 1);
    expect(p.monthlyGrams).toBeCloseTo(monthly, 1);
  });
});

describe("resolución de valores automáticos y manuales", () => {
  it("todo automático", () => {
    const r = resolveMetabolism(base, ON);
    expect(r.missing).toEqual([]);
    expect(r.bmr).toEqual({ value: 1755, auto: 1755, source: "auto" });
    expect(r.tdee.value).toBeCloseTo(2720.25, 6);
    expect(r.target.value).toBeCloseTo(2220.25, 6);
    expect(r.target.source).toBe("auto");
  });

  it("un objetivo manual no cambia al cambiar el peso", () => {
    const manual = { ...base, targetManual: 2000 };
    const before = resolveMetabolism(manual, ON);
    const after = resolveMetabolism({ ...manual, weightKg: 75 }, ON);
    expect(before.target.value).toBe(2000);
    expect(after.target.value).toBe(2000);
    expect(after.target.source).toBe("manual");
    // El automático sí se recalcula y queda disponible para "restablecer".
    expect(after.target.auto).toBeLessThan(before.target.auto!);
  });

  it("un nuevo peso recalcula BMR, TDEE y objetivo automáticos", () => {
    const r = resolveMetabolism({ ...base, weightKg: 78 }, ON);
    expect(r.bmr.value).toBe(1735);
    expect(r.tdee.value).toBeCloseTo(1735 * 1.55, 6);
    expect(r.target.value).toBeCloseTo(1735 * 1.55 - 500, 6);
  });

  it("un BMR manual alimenta el TDEE automático", () => {
    const r = resolveMetabolism({ ...base, bmrManual: 1800 }, ON);
    expect(r.bmr.source).toBe("manual");
    expect(r.bmr.auto).toBe(1755);
    expect(r.tdee.value).toBeCloseTo(1800 * 1.55, 6);
    expect(r.tdee.source).toBe("auto");
  });

  it("un TDEE manual alimenta el objetivo automático", () => {
    const r = resolveMetabolism({ ...base, tdeeManual: 2500, deficitKcal: 650 }, ON);
    expect(r.target.value).toBe(1850);
  });

  it("restablecer (quitar el manual) vuelve al automático", () => {
    const r = resolveMetabolism({ ...base, targetManual: null }, ON);
    expect(r.target.source).toBe("auto");
  });

  it("informa qué datos faltan y no inventa valores", () => {
    const r = resolveMetabolism({ ...base, birthDate: null, weightKg: null }, ON);
    expect(r.missing).toEqual(["birthDate", "weightKg"]);
    expect(r.bmr.value).toBeNull();
    expect(r.target.value).toBeNull();
  });

  it("con datos faltantes, un objetivo manual sigue rigiendo", () => {
    const r = resolveMetabolism({ ...base, weightKg: null, targetManual: 1900 }, ON);
    expect(r.target.value).toBe(1900);
  });

  it("la edad se recalcula según la fecha", () => {
    const before = resolveMetabolism(base, "2025-06-14");
    const after = resolveMetabolism(base, "2025-06-15");
    expect(before.bmr.value! - after.bmr.value!).toBe(5);
  });
});

describe("advertencias", () => {
  it("objetivo debajo del piso orientativo", () => {
    expect(targetWarnings({ target: 1400, tdee: 1900, bmr: 1500, sex: "male" })).toContainEqual({
      kind: "below_floor",
      floor: 1500,
    });
    expect(targetWarnings({ target: 1250, tdee: 1600, bmr: 1200, sex: "female" }).map((w) => w.kind)).not.toContain(
      "below_floor",
    );
  });
  it("objetivo debajo del BMR", () => {
    expect(targetWarnings({ target: 1700, tdee: 2400, bmr: 1755, sex: "male" }).map((w) => w.kind)).toContain(
      "below_bmr",
    );
  });
  it("déficit mayor al 25 % del TDEE", () => {
    const w = targetWarnings({ target: 1900, tdee: 2720, bmr: 1755, sex: "male" });
    expect(w.map((x) => x.kind)).toEqual(["aggressive_deficit"]);
  });
  it("objetivo razonable sin advertencias", () => {
    expect(targetWarnings({ target: 2220, tdee: 2720, bmr: 1755, sex: "male" })).toEqual([]);
  });
});
