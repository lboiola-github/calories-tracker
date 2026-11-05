import type { Per100g } from "@/lib/nutrition/calc";

export type ReferenceSource = "usda" | "off";

/** Candidato de referencia nutricional. Nunca se guarda sin que el usuario lo acepte o edite. */
export type ReferenceCandidate = {
  source: ReferenceSource;
  ref: string; // fdcId o código de barras
  name: string;
  brand: string | null;
  detail: string; // tipo de dato USDA, o "Open Food Facts"
  per100: Per100g;
  /** Qué valor de energía se usó y por qué (auditoría). */
  energyBasis: string;
  portions: { name: string; grams: number }[];
  /** Diferencia relativa entre kcal y macros (Atwater 4/4/9); > 0,15 se marca para revisar. */
  energyMismatch: number | null;
  warnings: string[];
  url: string;
};

export class ReferenceError extends Error {
  constructor(
    message: string,
    readonly kind:
      | "rate_limited"
      | "unavailable"
      | "not_found"
      | "bad_response",
  ) {
    super(message);
  }
}
