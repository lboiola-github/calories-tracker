import { beforeEach, describe, expect, it } from "vitest";
import {
  getOffProduct,
  isBarcode,
  parseOffProduct,
  pickOffEnergy,
} from "./off";
import { resetOffLimiterForTests, searchReferences } from "./search";
import { toUsdaQuery } from "./translate";
import { ReferenceError } from "./types";
import {
  getUsdaFood,
  parseFdcFood,
  pickEnergy,
  readNutrients,
  searchUsda,
} from "./usda";

// Formato de /foods/search (nutrientes planos).
const searchNutrient = (
  nutrientId: number,
  nutrientNumber: string,
  nutrientName: string,
  unitName: string,
  value: number,
) => ({
  nutrientId,
  nutrientNumber,
  nutrientName,
  unitName,
  value,
});
const SR_CHICKEN = {
  fdcId: 171477,
  description:
    "Chicken, broilers or fryers, breast, meat only, cooked, roasted",
  dataType: "SR Legacy",
  foodNutrients: [
    searchNutrient(1003, "203", "Protein", "G", 31.02),
    searchNutrient(1004, "204", "Total lipid (fat)", "G", 3.57),
    searchNutrient(1005, "205", "Carbohydrate, by difference", "G", 0),
    searchNutrient(1008, "208", "Energy", "KCAL", 165),
    searchNutrient(1062, "268", "Energy", "kJ", 690),
  ],
  foodMeasures: [
    { disseminationText: "1 cup, chopped or diced", gramWeight: 140 },
    { disseminationText: "Quantity not specified", gramWeight: 120 },
  ],
};

// Formato de /food/{id} (nutriente anidado, "amount").
const detailNutrient = (
  id: number,
  number: string,
  name: string,
  unitName: string,
  amount: number,
) => ({
  nutrient: { id, number, name, unitName },
  amount,
});
const FOUNDATION_EGG = {
  fdcId: 748967,
  description: "Eggs, Grade A, Large, egg whole",
  dataType: "Foundation",
  foodNutrients: [
    detailNutrient(1003, "203", "Protein", "g", 12.4),
    detailNutrient(1004, "204", "Total lipid (fat)", "g", 9.96),
    detailNutrient(1005, "205", "Carbohydrate, by difference", "g", 0.96),
    detailNutrient(
      2047,
      "957",
      "Energy (Atwater General Factors)",
      "kcal",
      148,
    ),
    detailNutrient(
      2048,
      "958",
      "Energy (Atwater Specific Factors)",
      "kcal",
      143,
    ),
  ],
  foodPortions: [
    {
      portionDescription: "1 large",
      gramWeight: 50,
      measureUnit: { name: "undetermined" },
    },
  ],
};

const OFF_DULCE = {
  code: "7790580000001",
  product_name: "Dulce de leche clásico",
  brands: "Marca X, Otra",
  nutrition_data_per: "100g",
  serving_quantity: 20,
  nutriments: {
    "energy-kcal_100g": 315,
    "energy-kj_100g": 1318,
    proteins_100g: 6.5,
    carbohydrates_100g: 55,
    fat_100g: 7.5,
    fiber_100g: 0,
  },
};

function mockFetch(
  routes: Record<string, { status?: number; body?: unknown; throws?: boolean }>,
) {
  const calls: {
    url: string;
    headers: Record<string, string>;
    method: string;
    body?: string;
  }[] = [];
  const impl = (async (input: URL | string, init?: RequestInit) => {
    const url = String(input);
    calls.push({
      url,
      headers: (init?.headers ?? {}) as Record<string, string>,
      method: init?.method ?? "GET",
      body: init?.body as string | undefined,
    });
    const key = Object.keys(routes).find((k) => url.includes(k));
    if (!key) return new Response("not found", { status: 404 });
    const r = routes[key];
    if (r.throws) throw new TypeError("network");
    return new Response(JSON.stringify(r.body ?? {}), {
      status: r.status ?? 200,
    });
  }) as typeof fetch;
  return { impl, calls };
}

describe("USDA", () => {
  it("lee los dos formatos de nutrientes", () => {
    expect(readNutrients(SR_CHICKEN.foodNutrients)[0]).toEqual({
      id: 1003,
      number: "203",
      name: "Protein",
      unit: "g",
      amount: 31.02,
    });
    expect(readNutrients(FOUNDATION_EGG.foodNutrients)[3]).toMatchObject({
      id: 2047,
      unit: "kcal",
      amount: 148,
    });
  });

  it("prioriza Energy kcal (1008), después Atwater específico, general y kJ", () => {
    expect(pickEnergy(readNutrients(SR_CHICKEN.foodNutrients))).toEqual({
      kcal: 165,
      basis: "USDA Energy (kcal, 1008)",
    });
    expect(pickEnergy(readNutrients(FOUNDATION_EGG.foodNutrients))?.kcal).toBe(
      143,
    );
    expect(
      pickEnergy(
        readNutrients(
          FOUNDATION_EGG.foodNutrients.filter((n) => n.nutrient.id !== 2048),
        ),
      )?.kcal,
    ).toBe(148);
    expect(
      pickEnergy(
        readNutrients([searchNutrient(1062, "268", "Energy", "kJ", 690)]),
      )?.kcal,
    ).toBe(164.91);
    expect(
      pickEnergy(
        readNutrients([searchNutrient(1003, "203", "Protein", "G", 3)]),
      ),
    ).toBeNull();
  });

  it("arma el candidato con porciones útiles y avisos", () => {
    const c = parseFdcFood(SR_CHICKEN)!;
    expect(c.per100).toEqual({
      kcal: 165,
      protein: 31.02,
      carbs: 0,
      fat: 3.57,
      fiber: null,
    });
    expect(c.portions).toEqual([
      { name: "1 cup, chopped or diced", grams: 140 },
    ]);
    expect(c.ref).toBe("171477");
    expect(c.warnings).toContain(
      "USDA informa carbohidratos totales (incluyen fibra).",
    );
    expect(parseFdcFood(FOUNDATION_EGG)!.portions).toEqual([
      { name: "1 large", grams: 50 },
    ]);
  });

  it("descarta alimentos sin macros completos", () => {
    expect(
      parseFdcFood({
        ...SR_CHICKEN,
        foodNutrients: SR_CHICKEN.foodNutrients.slice(1),
      }),
    ).toBeNull();
  });

  it("marca energía que no coincide con los macros", () => {
    const bad = {
      ...SR_CHICKEN,
      foodNutrients: [
        ...SR_CHICKEN.foodNutrients.slice(0, 3),
        searchNutrient(1008, "208", "Energy", "KCAL", 690),
      ],
    };
    expect(parseFdcFood(bad)!.warnings[0]).toMatch(/no coinciden/);
  });

  it("busca solo tipos genéricos salvo que se pida marca, y usa la clave del servidor", async () => {
    const { impl, calls } = mockFetch({
      "/foods/search": {
        body: {
          foods: [
            SR_CHICKEN,
            { fdcId: 1, description: "vacío", foodNutrients: [] },
          ],
        },
      },
    });
    const r = await searchUsda("chicken breast roasted", { fetchImpl: impl });
    expect(r).toHaveLength(1);
    const url = new URL(calls[0].url);
    expect(calls[0].method).toBe("POST");
    expect(JSON.parse(calls[0].body!)).toMatchObject({
      query: "chicken breast roasted",
      dataType: ["Foundation", "SR Legacy", "Survey (FNDDS)"],
    });
    expect(url.searchParams.get("api_key")).toBeTruthy();
  });

  it("traduce errores HTTP a mensajes claros", async () => {
    await expect(
      searchUsda("x", {
        fetchImpl: mockFetch({ "/foods": { status: 429 } }).impl,
      }),
    ).rejects.toMatchObject({ kind: "rate_limited" });
    await expect(
      searchUsda("x", {
        fetchImpl: mockFetch({ "/foods": { status: 503 } }).impl,
      }),
    ).rejects.toMatchObject({ kind: "unavailable" });
    await expect(
      searchUsda("x", {
        fetchImpl: mockFetch({ "/foods": { throws: true } }).impl,
      }),
    ).rejects.toBeInstanceOf(ReferenceError);
    await expect(getUsdaFood("abc")).rejects.toMatchObject({
      kind: "not_found",
    });
    await expect(
      getUsdaFood(
        "171477",
        mockFetch({ "/food/171477": { body: FOUNDATION_EGG } }).impl,
      ),
    ).resolves.toMatchObject({ per100: { kcal: 143 } });
  });
});

describe("Open Food Facts", () => {
  it("reconoce códigos de barras", () => {
    expect(isBarcode("7790580000001")).toBe(true);
    expect(isBarcode("12345678")).toBe(true);
    expect(isBarcode("779058")).toBe(false);
    expect(isBarcode("pollo")).toBe(false);
  });

  it("usa kcal publicadas y convierte kJ solo si faltan", () => {
    expect(
      pickOffEnergy({ "energy-kcal_100g": 315, energy_100g: 1318 })?.kcal,
    ).toBe(315);
    expect(pickOffEnergy({ energy_100g: 1318 })).toEqual({
      kcal: 315.01,
      basis: "Open Food Facts kJ ÷ 4,184",
    });
    expect(pickOffEnergy({ "energy-kcal_100g": "315,5" })?.kcal).toBe(315.5);
    expect(pickOffEnergy({ proteins_100g: 3 })).toBeNull();
  });

  it("arma el candidato con la primera marca y la porción declarada", () => {
    const c = parseOffProduct(OFF_DULCE)!;
    expect(c).toMatchObject({
      source: "off",
      ref: "7790580000001",
      brand: "Marca X",
      detail: "Open Food Facts",
    });
    expect(c.per100).toEqual({
      kcal: 315,
      protein: 6.5,
      carbs: 55,
      fat: 7.5,
      fiber: 0,
    });
    expect(c.portions).toEqual([{ name: "porción", grams: 20 }]);
    expect(c.warnings).toEqual([
      "Datos colaborativos: compará con la etiqueta.",
    ]);
  });

  it("prefiere el nombre en español", () => {
    expect(
      parseOffProduct({
        ...OFF_DULCE,
        product_name: "Milk caramel",
        product_name_es: "Dulce de leche",
      })!.name,
    ).toBe("Dulce de leche");
  });

  it("descarta productos incompletos o imposibles y avisa si la tabla es por porción", () => {
    expect(
      parseOffProduct({
        ...OFF_DULCE,
        nutriments: { "energy-kcal_100g": 315, proteins_100g: 6.5 },
      }),
    ).toBeNull();
    expect(
      parseOffProduct({
        ...OFF_DULCE,
        nutriments: { ...OFF_DULCE.nutriments, carbohydrates_100g: 99 },
      }),
    ).toBeNull();
    expect(
      parseOffProduct({
        ...OFF_DULCE,
        nutriments: { ...OFF_DULCE.nutriments, "energy-kcal_100g": 1318 },
      }),
    ).toBeNull();
    expect(
      parseOffProduct({ ...OFF_DULCE, nutrition_data_per: "serving" })!
        .warnings[0],
    ).toMatch(/por porción/);
  });

  it("lee un producto por código y manda User-Agent propio", async () => {
    const { impl, calls } = mockFetch({
      "/api/v2/product/7790580000001": {
        body: { status: 1, product: OFF_DULCE },
      },
    });
    await expect(getOffProduct("7790580000001", impl)).resolves.toMatchObject({
      name: "Dulce de leche clásico",
    });
    expect(calls[0].headers["user-agent"]).toMatch(/^Calorias\/1\.0/);
    await expect(
      getOffProduct(
        "7790580000002",
        mockFetch({ "/api/v2": { body: { status: 0 } } }).impl,
      ),
    ).rejects.toMatchObject({ kind: "not_found" });
  });
});

describe("búsqueda combinada", () => {
  beforeEach(() => resetOffLimiterForTests());

  it("traduce la consulta para USDA", () => {
    expect(toUsdaQuery("Pechuga de pollo a la plancha")).toBe(
      "breast chicken grilled",
    );
    expect(toUsdaQuery("Huevo duro")).toBe("egg hard-boiled");
    expect(toUsdaQuery("Alfajor")).toBeNull();
  });

  it("junta las dos fuentes y sigue si una falla", async () => {
    const { impl, calls } = mockFetch({
      "/foods/search": { status: 503 },
      "openfoodfacts.org/search": {
        body: {
          hits: [
            { ...OFF_DULCE, code: "1", countries_tags: ["en:uruguay"] },
            { ...OFF_DULCE, countries_tags: ["en:argentina"] },
          ],
        },
      },
    });
    const r = await searchReferences("dulce de leche", { fetchImpl: impl });
    expect(r.candidates.map((c) => c.source)).toEqual(["off", "off"]);
    expect(r.candidates[0].ref).toBe("7790580000001"); // primero lo vendido en Argentina
    expect(r.errors).toEqual([
      { source: "usda", message: "USDA no está disponible ahora." },
    ]);
    expect(
      new URL(
        calls.find((c) => c.url.includes("openfoodfacts.org/search"))!.url,
      ).searchParams.get("q"),
    ).toBe("dulce de leche");
  });

  it("un código de barras va directo a Open Food Facts y un fdcId a USDA", async () => {
    const { impl, calls } = mockFetch({
      "/api/v2/product/": { body: { status: 1, product: OFF_DULCE } },
      "/food/171477": { body: SR_CHICKEN },
    });
    expect(
      (await searchReferences("7790580000001", { fetchImpl: impl })).candidates,
    ).toHaveLength(1);
    expect(
      (await searchReferences("fdc 171477", { fetchImpl: impl })).candidates[0]
        .source,
    ).toBe("usda");
    expect(calls).toHaveLength(2);
  });

  it("limita las búsquedas a Open Food Facts por minuto", async () => {
    const { impl } = mockFetch({
      "/foods/search": { body: { foods: [] } },
      "openfoodfacts.org/search": { body: { hits: [] } },
    });
    for (let i = 0; i < 8; i++)
      await searchReferences("queso " + i, { fetchImpl: impl });
    const r = await searchReferences("queso", { fetchImpl: impl });
    expect(r.errors[0]).toMatchObject({ source: "off" });
  });

  it("ignora consultas muy cortas", async () => {
    expect(await searchReferences(" a ")).toEqual({
      candidates: [],
      errors: [],
      usdaQuery: null,
    });
  });
});

import { foodFromReference, preparationFromText } from "./to-food";

describe("alimento desde una referencia", () => {
  it("deduce la preparación de lo escrito o de la fuente", () => {
    expect(
      preparationFromText(
        "pechuga de pollo a la plancha",
        "Chicken breast, raw",
      ),
    ).toBe("grilled");
    expect(
      preparationFromText(
        "pechuga de pollo",
        "Chicken, breast, meat only, cooked, roasted",
      ),
    ).toBe("roasted");
    expect(preparationFromText("arroz", "Rice, white, long-grain, raw")).toBe(
      "raw",
    );
    expect(preparationFromText("banana", "Bananas")).toBe("na");
  });

  it("usa el nombre en español, guarda el de la fuente como alias y conserva la fuente", () => {
    const f = foodFromReference(
      parseFdcFood(SR_CHICKEN)!,
      "  pechuga de pollo ",
    );
    expect(f).toMatchObject({
      name: "Pechuga de pollo",
      preparation: "roasted",
      source_type: "usda",
      source_ref: "171477",
      validated: true,
      kcal_per_100g: 165,
      units: [{ name: "1 cup, chopped or diced", grams: 140 }],
      aliases: [
        "Chicken, broilers or fryers, breast, meat only, cooked, roasted",
      ],
    });
    expect(
      foodFromReference(parseOffProduct(OFF_DULCE)!, "dulce de leche")
        .validated,
    ).toBe(false);
  });
});
