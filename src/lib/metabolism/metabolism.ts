import {
  AGGRESSIVE_DEFICIT_RATIO,
  KCAL_PER_KG,
  MIN_TARGET_KCAL,
  activityFactor,
  type ActivityLevel,
} from "./config";

export type Sex = "female" | "male";

/** Edad cumplida en una fecha (ambas en formato YYYY-MM-DD, sin zona horaria). */
export function ageOn(birthDate: string, onDate: string): number {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [y, m, d] = onDate.split("-").map(Number);
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age -= 1;
  return age;
}

/**
 * Metabolismo basal estimado con Mifflin-St Jeor (kcal/día).
 * Hombres: 10·kg + 6,25·cm − 5·edad + 5. Mujeres: 10·kg + 6,25·cm − 5·edad − 161.
 */
export function mifflinStJeor(input: { weightKg: number; heightCm: number; ageYears: number; sex: Sex }): number {
  const { weightKg, heightCm, ageYears, sex } = input;
  if (!(weightKg > 0 && heightCm > 0 && ageYears >= 0)) throw new Error("Datos inválidos para el BMR");
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return base + (sex === "male" ? 5 : -161);
}

export function estimateTdee(bmr: number, level: ActivityLevel): number {
  return bmr * activityFactor(level);
}

/** Pérdida teórica por déficit diario, en gramos. Ver advertencias de la interfaz. */
export function projectedLoss(deficitKcal: number): { weeklyGrams: number; monthlyGrams: number } {
  return {
    weeklyGrams: ((deficitKcal * 7) / KCAL_PER_KG) * 1000,
    monthlyGrams: ((deficitKcal * 30) / KCAL_PER_KG) * 1000,
  };
}

export type ValueSource = "auto" | "manual";
export type Resolved = { value: number | null; auto: number | null; source: ValueSource };

export type MetabolicInputs = {
  birthDate: string | null;
  sex: Sex | null;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: ActivityLevel | null;
  bmrManual: number | null;
  tdeeManual: number | null;
  targetManual: number | null;
  deficitKcal: number;
};

export type MetabolicResult = {
  bmr: Resolved;
  tdee: Resolved;
  target: Resolved;
  /** Datos que faltan para el cálculo automático. */
  missing: Array<"birthDate" | "sex" | "heightCm" | "weightKg" | "activityLevel">;
};

const resolve = (auto: number | null, manual: number | null): Resolved =>
  manual != null ? { value: manual, auto, source: "manual" } : { value: auto, auto, source: "auto" };

/**
 * Resuelve BMR → TDEE → objetivo. Un valor manual reemplaza al automático y se propaga:
 * un BMR manual alimenta el TDEE automático; un TDEE manual alimenta el objetivo automático.
 */
export function resolveMetabolism(input: MetabolicInputs, onDate: string): MetabolicResult {
  const missing: MetabolicResult["missing"] = [];
  if (!input.birthDate) missing.push("birthDate");
  if (!input.sex) missing.push("sex");
  if (input.heightCm == null) missing.push("heightCm");
  if (input.weightKg == null) missing.push("weightKg");
  if (!input.activityLevel) missing.push("activityLevel");

  const bmrAuto =
    input.birthDate && input.sex && input.heightCm != null && input.weightKg != null
      ? mifflinStJeor({
          weightKg: input.weightKg,
          heightCm: input.heightCm,
          ageYears: ageOn(input.birthDate, onDate),
          sex: input.sex,
        })
      : null;
  const bmr = resolve(bmrAuto, input.bmrManual);

  const tdeeAuto = bmr.value != null && input.activityLevel ? estimateTdee(bmr.value, input.activityLevel) : null;
  const tdee = resolve(tdeeAuto, input.tdeeManual);

  const targetAuto = tdee.value != null ? tdee.value - input.deficitKcal : null;
  const target = resolve(targetAuto, input.targetManual);

  return { bmr, tdee, target, missing };
}

export type TargetWarning =
  | { kind: "below_floor"; floor: number }
  | { kind: "below_bmr"; bmr: number }
  | { kind: "aggressive_deficit"; ratio: number };

/** Advertencias sobre un objetivo: no bloquean, informan. */
export function targetWarnings(input: {
  target: number | null;
  tdee: number | null;
  bmr: number | null;
  sex: Sex | null;
}): TargetWarning[] {
  const { target, tdee, bmr, sex } = input;
  if (target == null) return [];
  const warnings: TargetWarning[] = [];
  const floor = sex ? MIN_TARGET_KCAL[sex] : Math.min(MIN_TARGET_KCAL.female, MIN_TARGET_KCAL.male);
  if (target < floor) warnings.push({ kind: "below_floor", floor });
  if (bmr != null && target < bmr) warnings.push({ kind: "below_bmr", bmr });
  if (tdee != null && tdee > 0) {
    const ratio = (tdee - target) / tdee;
    if (ratio > AGGRESSIVE_DEFICIT_RATIO) warnings.push({ kind: "aggressive_deficit", ratio });
  }
  return warnings;
}

/** Redondeo para mostrar y guardar objetivos diarios (kcal enteras). */
export const roundKcal = (n: number) => Math.round(n);
