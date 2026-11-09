/**
 * Actividad física: solo cuatro tipos.
 *   - Correr: kcal = kg de peso × km (regla pedida por el usuario).
 *   - Caminar: la misma regla con un factor de 0,5 (a igual distancia, caminar gasta
 *     aproximadamente la mitad que correr).
 *   - Gimnasio y fútbol: sin fórmula, las kcal se cargan a mano.
 */
export const ACTIVITY_KINDS = [
  { key: "walk", label: "Caminar", byDistance: true, factor: 0.5 },
  { key: "run", label: "Correr", byDistance: true, factor: 1 },
  { key: "gym", label: "Gimnasio", byDistance: false, factor: null },
  { key: "football", label: "Fútbol", byDistance: false, factor: null },
] as const;

export type ActivityKind = (typeof ACTIVITY_KINDS)[number]["key"];

export const isActivityKind = (v: unknown): v is ActivityKind => ACTIVITY_KINDS.some((k) => k.key === v);

export const activityKind = (key: ActivityKind) => ACTIVITY_KINDS.find((k) => k.key === key)!;

export const activityLabel = (key: ActivityKind) => activityKind(key).label;

/** kcal por distancia para caminar o correr; null si falta el peso o la distancia no es válida. */
export function distanceKcal(kind: ActivityKind, km: number | null, weightKg: number | null): number | null {
  const k = activityKind(kind);
  if (!k.byDistance || km == null || weightKg == null) return null;
  if (!Number.isFinite(km) || km <= 0 || !Number.isFinite(weightKg) || weightKg <= 0) return null;
  return Math.round(weightKg * km * k.factor * 10) / 10;
}
