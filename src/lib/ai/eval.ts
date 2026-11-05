import type { Interpretation } from "./parse";

export type EvalCase = {
  text: string;
  meal?: string;
  day?: string;
  items: {
    food: string;
    quantity: number | null;
    unit?: string;
    preparation?: string;
  }[];
};

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Compara una interpretación con lo esperado. Devuelve los problemas (vacío = correcto). */
export function checkCase(c: EvalCase, out: Interpretation): string[] {
  const problems: string[] = [];
  if (c.meal && out.mealType !== c.meal)
    problems.push(`comida ${out.mealType} ≠ ${c.meal}`);
  if (c.day && out.day !== c.day) problems.push(`día ${out.day} ≠ ${c.day}`);
  for (const exp of c.items) {
    const got = out.items.find((i) =>
      norm(i.food).includes(norm(exp.food).slice(0, 5)),
    );
    if (!got) problems.push(`falta ${exp.food}`);
    else {
      if (exp.quantity === null && got.quantity !== null)
        problems.push(`${exp.food}: inventó ${got.quantity}`);
      if (exp.quantity != null && got.quantity !== exp.quantity)
        problems.push(`${exp.food}: ${got.quantity} ≠ ${exp.quantity}`);
      if (exp.preparation && got.preparation !== exp.preparation)
        problems.push(`${exp.food}: ${got.preparation} ≠ ${exp.preparation}`);
    }
  }
  return problems;
}

/** WAV PCM mono de silencio, para comprobar que la transcripción acepta la clave. */
export function silentWav(seconds = 1, rate = 16000): Blob {
  const samples = Math.round(seconds * rate);
  const buf = new ArrayBuffer(44 + samples * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) =>
    [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + samples * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, samples * 2, true);
  return new Blob([buf], { type: "audio/wav" });
}
