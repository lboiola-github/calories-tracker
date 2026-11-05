/**
 * Variables públicas de Supabase. La URL y la publishable key pueden estar en el navegador:
 * la seguridad la dan RLS y la sesión del usuario, no el secreto de estas claves.
 */
// Proyecto de producción. Las variables de entorno lo reemplazan (desarrollo y pruebas).
const DEFAULT_URL = "https://ijkvjcmfvlxpeljhgrar.supabase.co";
const DEFAULT_KEY = "sb_publishable_lXjyuPFw-qdAb6AiLzNetg_bIQQ8uwL";

export function getSupabaseEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || DEFAULT_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export function requireSupabaseEnv(): { url: string; key: string } {
  const env = getSupabaseEnv();
  if (!env) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL y/o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Ver .env.example.",
    );
  }
  return env;
}
