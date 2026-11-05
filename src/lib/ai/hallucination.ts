// Frases que Whisper suele inventar con silencio o ruido (no son lo que dijo el usuario).
const PHRASES = [
  "gracias",
  "muchas gracias",
  "gracias por ver",
  "gracias por ver el video",
  "suscribete",
  "subtitulos realizados por la comunidad de amara.org",
  "subtitulado por la comunidad de amara.org",
  "amara.org",
  "chau",
  "adios",
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[¡!¿?.,…\s]+/g, " ")
    .trim();

/** true si el texto es vacío o solo una de las frases típicas que Whisper alucina. */
export function isLikelyHallucination(text: string): boolean {
  const t = norm(text);
  return (
    t.length === 0 ||
    PHRASES.includes(t) ||
    t.includes("amara org") ||
    t.includes("amara.org")
  );
}
