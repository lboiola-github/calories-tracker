/**
 * "Recordar este dispositivo": la app la usa una sola persona, así que después del primer
 * inicio de sesión se guarda en el dispositivo una cookie httpOnly con las credenciales
 * cifradas (AES-256-GCM) con una clave que solo existe en el servidor. Si Supabase revoca
 * o pierde la sesión (por ejemplo, iOS suspende la app justo mientras se renovaba el token),
 * el servidor vuelve a iniciar sesión solo, sin mostrar la pantalla de login.
 *
 * - La cookie no es legible desde JavaScript (httpOnly) y sin la clave del servidor no sirve.
 * - "Cerrar sesión" la borra. Si la contraseña cambia, se borra y se vuelve a pedir una vez.
 * - Usa Web Crypto: funciona igual en el proxy y en las Server Actions.
 */
export const DEVICE_COOKIE = "cal_device";
export const DEVICE_MAX_AGE = 400 * 24 * 60 * 60; // máximo que aceptan los navegadores

export type DeviceCredentials = { email: string; password: string };

const enc = new TextEncoder();
const dec = new TextDecoder();

/** Clave del servidor: DEVICE_SECRET, o derivada de otra clave privada ya configurada. */
function secret(): string | null {
  return process.env.DEVICE_SECRET || process.env.GROQ_API_KEY || null;
}

async function key(usage: KeyUsage): Promise<CryptoKey | null> {
  const s = secret();
  if (!s) return null;
  const base = await crypto.subtle.importKey("raw", enc.encode(s), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: enc.encode("calories-tracker"), info: enc.encode("device-login-v1") },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    [usage],
  );
}

const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64 = (s: string) => {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

export async function sealCredentials(c: DeviceCredentials): Promise<string | null> {
  const k = await key("encrypt");
  if (!k) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, enc.encode(JSON.stringify(c))));
  const out = new Uint8Array(iv.length + data.length);
  out.set(iv);
  out.set(data, iv.length);
  return `v1.${toB64(out)}`;
}

export async function openCredentials(value: string | undefined): Promise<DeviceCredentials | null> {
  if (!value?.startsWith("v1.")) return null;
  try {
    const k = await key("decrypt");
    if (!k) return null;
    const raw = fromB64(value.slice(3));
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.slice(0, 12) }, k, raw.slice(12));
    const c = JSON.parse(dec.decode(plain)) as Partial<DeviceCredentials>;
    return typeof c.email === "string" && typeof c.password === "string" ? { email: c.email, password: c.password } : null;
  } catch {
    return null;
  }
}

export const deviceCookieOptions = {
  httpOnly: true,
  secure: process.env.VERCEL === "1",
  sameSite: "lax" as const,
  path: "/",
  maxAge: DEVICE_MAX_AGE,
};
