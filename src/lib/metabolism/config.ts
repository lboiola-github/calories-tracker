/**
 * Configuración metabólica centralizada. Cambiar un factor acá lo cambia en toda la app.
 * Los valores son orientativos (estimación poblacional, no medición clínica).
 */

export const ACTIVITY_LEVELS = [
  {
    key: "sedentary",
    label: "Nula / sedentaria",
    factor: 1.2,
    description: "Trabajo sentado y casi sin ejercicio.",
  },
  {
    key: "low",
    label: "Baja",
    factor: 1.375,
    description: "Ejercicio liviano 1 a 3 días por semana, o caminatas frecuentes.",
  },
  {
    key: "moderate",
    label: "Moderada",
    factor: 1.55,
    description: "Ejercicio moderado 3 a 5 días por semana.",
  },
  {
    key: "high",
    label: "Alta",
    factor: 1.725,
    description: "Ejercicio intenso 6 o 7 días por semana, o trabajo físico.",
  },
  {
    key: "very_high",
    label: "Profesional / muy intensa",
    factor: 1.9,
    description: "Entrenamiento de alto rendimiento o dos sesiones intensas por día.",
  },
] as const;

export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number]["key"];

export const DEFICIT_OPTIONS = [300, 500, 650, 800] as const;
export type DeficitOption = (typeof DEFICIT_OPTIONS)[number];
export const DEFAULT_DEFICIT: DeficitOption = 500;

/** Equivalencia aproximada usada para las proyecciones teóricas. */
export const KCAL_PER_KG = 7700;

/**
 * Pisos orientativos de ingesta sin supervisión profesional, usados solo para advertir.
 * Por debajo de estos valores la app muestra una advertencia, no impide guardar.
 */
export const MIN_TARGET_KCAL = { female: 1200, male: 1500 } as const;

/** Un déficit mayor a esta fracción del TDEE se advierte como agresivo. */
export const AGGRESSIVE_DEFICIT_RATIO = 0.25;

export function activityFactor(level: ActivityLevel): number {
  const found = ACTIVITY_LEVELS.find((a) => a.key === level);
  if (!found) throw new Error(`Nivel de actividad desconocido: ${level}`);
  return found.factor;
}
