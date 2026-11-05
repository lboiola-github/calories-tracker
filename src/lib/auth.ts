import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; email: string | null };

/**
 * Devuelve el usuario verificado (JWT validado) o redirige a /login.
 * Toda Server Action que lea o escriba datos debe llamarla.
 */
export async function requireUser(): Promise<CurrentUser> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || !sub) redirect("/login");
  return { id: sub, email: (data.claims.email as string | undefined) ?? null };
}
