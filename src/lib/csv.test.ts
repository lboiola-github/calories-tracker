import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("usa ; y coma decimal, con BOM", () => {
    expect(toCsv(["a", "b"], [["Pollo", 165.456]])).toBe("﻿a;b\r\nPollo;165,46\r\n");
  });
  it("escapa comillas, separadores y saltos", () => {
    expect(toCsv(["x"], [['Dulce "de" leche; casero']])).toBe('﻿x\r\n"Dulce ""de"" leche; casero"\r\n');
  });
  it("neutraliza fórmulas de planilla y deja vacíos los nulos", () => {
    expect(toCsv(["x", "y"], [["=HYPERLINK()", null]])).toBe("﻿x;y\r\n\"'=HYPERLINK()\";\r\n");
  });
});
