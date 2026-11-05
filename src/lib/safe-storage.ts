/**
 * localStorage puede fallar (modo privado, almacenamiento lleno o borrado por iOS).
 * Solo se usa para comodidades locales, como borradores: nunca como fuente de verdad.
 */
export function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocal(key: string, value: string | null): void {
  try {
    if (value === null || value === "") window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento local: el borrador vive solo en memoria.
  }
}
