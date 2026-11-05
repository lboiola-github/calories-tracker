import { addDays } from "./dates";

export type WeightPoint = { date: string; kg: number };

/**
 * Cambio de peso en los últimos `days` días: último registro menos el registro más reciente
 * que sea anterior o igual a (último − days). Si no hay registros tan viejos, null: no se inventa.
 */
export function weightChange(points: WeightPoint[], days: number): { kg: number; from: string } | null {
  if (points.length < 2) return null;
  const sorted = [...points].sort((a, b) => b.date.localeCompare(a.date));
  const latest = sorted[0];
  const limit = addDays(latest.date, -days);
  const base = sorted.find((p) => p.date <= limit);
  if (!base) return null;
  return { kg: Math.round((latest.kg - base.kg) * 100) / 100, from: base.date };
}

/** Puntos del gráfico escalados a un rectángulo, con el eje X proporcional a los días reales. */
export function chartPath(points: WeightPoint[], width: number, height: number, pad = 8) {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) return null;
  const t = (d: string) => Date.parse(`${d}T00:00:00Z`) / 86_400_000;
  const t0 = t(sorted[0].date);
  const span = Math.max(1, t(sorted[sorted.length - 1].date) - t0);
  const min = Math.min(...sorted.map((p) => p.kg));
  const max = Math.max(...sorted.map((p) => p.kg));
  const range = Math.max(1, max - min);
  const xy = sorted.map((p) => ({
    ...p,
    x: sorted.length === 1 ? width / 2 : pad + ((t(p.date) - t0) / span) * (width - 2 * pad),
    y: pad + (1 - (p.kg - min) / range) * (height - 2 * pad),
  }));
  return { points: xy, d: xy.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" "), min, max };
}
