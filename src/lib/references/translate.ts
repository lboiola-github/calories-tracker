/**
 * Traducción mínima español → inglés para buscar en USDA (que solo está en inglés).
 * Es una ayuda de búsqueda: el usuario siempre elige el resultado. Si no hay traducción,
 * se busca con el texto original.
 */
const WORDS: Record<string, string> = {
  pollo: "chicken",
  pechuga: "breast",
  muslo: "thigh",
  carne: "beef",
  vaca: "beef",
  cerdo: "pork",
  bondiola: "pork shoulder",
  lomo: "tenderloin",
  nalga: "beef round",
  cuadril: "beef sirloin",
  picada: "ground",
  pescado: "fish",
  merluza: "hake",
  salmon: "salmon",
  atun: "tuna",
  huevo: "egg",
  huevos: "egg",
  clara: "egg white",
  yema: "egg yolk",
  leche: "milk",
  queso: "cheese",
  yogur: "yogurt",
  manteca: "butter",
  crema: "cream",
  arroz: "rice",
  fideos: "pasta",
  pasta: "pasta",
  pan: "bread",
  avena: "oats",
  harina: "flour",
  papa: "potato",
  papas: "potato",
  batata: "sweet potato",
  zanahoria: "carrot",
  tomate: "tomato",
  lechuga: "lettuce",
  cebolla: "onion",
  zapallo: "squash",
  zapallito: "zucchini",
  brocoli: "broccoli",
  espinaca: "spinach",
  morron: "bell pepper",
  palta: "avocado",
  banana: "banana",
  manzana: "apple",
  naranja: "orange",
  mandarina: "tangerine",
  pera: "pear",
  frutilla: "strawberry",
  frutillas: "strawberries",
  durazno: "peach",
  uva: "grape",
  uvas: "grapes",
  lentejas: "lentils",
  garbanzos: "chickpeas",
  porotos: "beans",
  mani: "peanut",
  nueces: "walnuts",
  almendras: "almonds",
  aceite: "oil",
  oliva: "olive",
  azucar: "sugar",
  miel: "honey",
  choclo: "corn",
  arvejas: "peas",
  jamon: "ham",
  crudo: "raw",
  cruda: "raw",
  crudos: "raw",
  crudas: "raw",
  cocido: "cooked",
  cocida: "cooked",
  cocidos: "cooked",
  hervido: "boiled",
  hervida: "boiled",
  duro: "hard-boiled",
  asado: "roasted",
  asada: "roasted",
  horno: "baked",
  frito: "fried",
  frita: "fried",
  plancha: "grilled",
  grillado: "grilled",
  integral: "whole wheat",
  entera: "whole",
  descremada: "skim",
  descremado: "nonfat",
  blanco: "white",
  blanca: "white",
  magro: "lean",
};

const STOP = new Set([
  "de",
  "del",
  "la",
  "el",
  "los",
  "las",
  "a",
  "al",
  "con",
  "en",
  "sin",
  "y",
]);

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ\s-]/g, " ")
    .trim();
}

/** Devuelve la consulta en inglés, o null si no se reconoció ninguna palabra. */
export function toUsdaQuery(query: string): string | null {
  const words = normalize(query)
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w));
  let known = 0;
  const out = words.map((w) => {
    const t = WORDS[w];
    if (t) known++;
    return t ?? w;
  });
  return known > 0 ? [...new Set(out)].join(" ") : null;
}
