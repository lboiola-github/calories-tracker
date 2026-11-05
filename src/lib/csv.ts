/**
 * CSV para Excel/Sheets en español: separador ";", decimales con coma y BOM UTF-8
 * (así Excel en es-AR abre acentos y números sin configurar nada).
 */
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    if (v == null) return "";
    const s = typeof v === "number" ? String(Math.round(v * 100) / 100).replace(".", ",") : v;
    return /[";\n\r]/.test(s) || /^[=+\-@\t]/.test(s) ? `"${(/^[=+\-@\t]/.test(s) ? "'" : "") + s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
}
