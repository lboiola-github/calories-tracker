/** Formato y lectura de números en español (Argentina). */

const nf = (min: number, max: number) =>
  new Intl.NumberFormat("es-AR", { minimumFractionDigits: min, maximumFractionDigits: max });

export const formatKcal = (n: number) => nf(0, 0).format(Math.round(n));
export const formatGrams = (n: number, decimals = 0) => nf(0, decimals).format(n);
export const formatKg = (n: number, decimals = 1) => nf(0, decimals).format(n);

/** Pérdida en gramos → "455 g" o "1,9 kg" según el tamaño. */
export function formatMass(grams: number): string {
  if (Math.abs(grams) >= 1000) return `${nf(1, 1).format(grams / 1000)} kg`;
  return `${nf(0, 0).format(Math.round(grams / 5) * 5)} g`;
}

/** Acepta "80,5", "80.5", " 80 " y devuelve null si no es un número válido. */
export function parseDecimal(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  const s = raw.trim().replace(/\s/g, "");
  if (!s) return null;
  if (!/^-?\d+([.,]\d+)?$/.test(s)) return null;
  return Number(s.replace(",", "."));
}
