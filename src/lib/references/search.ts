import { getOffProduct, isBarcode, searchOff } from "./off";
import { toUsdaQuery } from "./translate";
import { ReferenceError, type ReferenceCandidate, type ReferenceSource } from "./types";
import { getUsdaFood, searchUsda } from "./usda";

export type ReferenceSearchResult = {
  candidates: ReferenceCandidate[];
  /** Fuentes que fallaron, con un mensaje para mostrar. Las demás siguen sirviendo. */
  errors: { source: ReferenceSource; message: string }[];
  usdaQuery: string | null;
};

/** Límite propio para no superar las 10 búsquedas/min de OFF desde esta instancia. */
const offSearches: number[] = [];
function takeOffSearchSlot(now = Date.now()): boolean {
  while (offSearches.length && now - offSearches[0] > 60_000) offSearches.shift();
  if (offSearches.length >= 8) return false;
  offSearches.push(now);
  return true;
}

const message = (e: unknown) => (e instanceof ReferenceError ? e.message : "No se pudo consultar la fuente.");

export async function searchReferences(
  rawQuery: string,
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<ReferenceSearchResult> {
  const query = rawQuery.trim().slice(0, 100);
  const fetchImpl = opts.fetchImpl ?? fetch;
  const result: ReferenceSearchResult = { candidates: [], errors: [], usdaQuery: null };
  if (query.length < 2) return result;

  // Código de barras: solo Open Food Facts.
  if (isBarcode(query)) {
    try {
      result.candidates.push(await getOffProduct(query, fetchImpl));
    } catch (e) {
      result.errors.push({ source: "off", message: message(e) });
    }
    return result;
  }

  // fdcId explícito ("fdc 171477").
  const fdc = /^fdc[:\s#]*(\d{1,10})$/i.exec(query);
  if (fdc) {
    try {
      result.candidates.push(await getUsdaFood(fdc[1], fetchImpl));
    } catch (e) {
      result.errors.push({ source: "usda", message: message(e) });
    }
    return result;
  }

  result.usdaQuery = toUsdaQuery(query) ?? query;
  const [usda, off] = await Promise.allSettled([
    searchUsda(result.usdaQuery, { fetchImpl }),
    takeOffSearchSlot()
      ? searchOff(query, fetchImpl)
      : Promise.reject(new ReferenceError("Demasiadas búsquedas en Open Food Facts. Esperá un minuto.", "rate_limited")),
  ]);
  if (usda.status === "fulfilled") result.candidates.push(...usda.value.slice(0, 10));
  else result.errors.push({ source: "usda", message: message(usda.reason) });
  if (off.status === "fulfilled") result.candidates.push(...off.value.slice(0, 10));
  else result.errors.push({ source: "off", message: message(off.reason) });
  return result;
}

export function resetOffLimiterForTests() {
  offSearches.length = 0;
}
