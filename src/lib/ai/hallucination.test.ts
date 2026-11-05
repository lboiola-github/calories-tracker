import { describe, expect, it } from "vitest";
import { isLikelyHallucination } from "./hallucination";

describe("isLikelyHallucination", () => {
  it.each([
    "",
    "  ",
    "Gracias.",
    "¡Gracias!",
    "Subtítulos realizados por la comunidad de Amara.org",
    "Suscríbete",
  ])("descarta %j", (t) => expect(isLikelyHallucination(t)).toBe(true));
  it.each(["Almorcé 200 g de arroz", "dos tostadas, gracias"])(
    "acepta %j",
    (t) => expect(isLikelyHallucination(t)).toBe(false),
  );
});
