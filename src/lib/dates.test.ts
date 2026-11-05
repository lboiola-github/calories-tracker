import { describe, expect, it } from "vitest";
import { addDays, isIsoDate, localDate } from "./dates";

describe("fecha local del usuario", () => {
  it("23:30 en Córdoba sigue siendo ese día aunque en UTC ya sea el siguiente", () => {
    // 2025-03-10 23:30 en Córdoba (UTC−3) = 2025-03-11 02:30 UTC
    expect(localDate(new Date("2025-03-11T02:30:00Z"), "America/Argentina/Cordoba")).toBe("2025-03-10");
  });
  it("00:15 en Córdoba ya es el día siguiente", () => {
    expect(localDate(new Date("2025-03-11T03:15:00Z"), "America/Argentina/Cordoba")).toBe("2025-03-11");
  });
  it("respeta otra zona horaria del perfil", () => {
    expect(localDate(new Date("2025-03-11T02:30:00Z"), "Europe/Madrid")).toBe("2025-03-11");
  });
  it("suma días cruzando meses y años bisiestos", () => {
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2024-12-31", 1)).toBe("2025-01-01");
    expect(addDays("2025-03-01", -1)).toBe("2025-02-28");
  });
  it("valida fechas ISO reales", () => {
    expect(isIsoDate("2025-02-29")).toBe(false);
    expect(isIsoDate("2024-02-29")).toBe(true);
    expect(isIsoDate("2024-2-9")).toBe(false);
  });
});

import { formatLongDate, localHour } from "./dates";

describe("hora y formato", () => {
  it("hora local en Córdoba", () => expect(localHour(new Date("2025-03-11T02:30:00Z"))).toBe(23));
  it("fecha larga en español", () => expect(formatLongDate("2025-03-10")).toBe("lunes, 10 de marzo"));
});
