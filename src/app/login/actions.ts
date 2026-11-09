"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEVICE_COOKIE, deviceCookieOptions, sealCredentials } from "@/lib/device-auth";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error: string | null; info: string | null; email: string };

const MIN_PASSWORD = 8;

function readForm(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
    mode: formData.get("mode") === "signup" ? "signup" : "signin",
  } as const;
}

/** Traduce los errores de Supabase Auth a mensajes claros, sin filtrar detalles internos. */
function authMessage(code: string | undefined, fallback: string): string {
  switch (code) {
    case "invalid_credentials":
      return "Email o contraseña incorrectos.";
    case "email_not_confirmed":
      return "Confirmá tu email con el enlace que te enviamos y volvé a intentar.";
    case "user_already_exists":
    case "email_exists":
      return "Ya existe una cuenta con ese email. Iniciá sesión.";
    case "weak_password":
      return `La contraseña es demasiado débil. Usá al menos ${MIN_PASSWORD} caracteres.`;
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Demasiados intentos seguidos. Esperá unos minutos.";
    case "signup_disabled":
      return "El registro de cuentas nuevas está desactivado.";
    default:
      return fallback;
  }
}

export async function authenticate(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password, mode } = readForm(formData);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Ingresá un email válido.", info: null, email };
  }
  if (password.length < MIN_PASSWORD) {
    return { error: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`, info: null, email };
  }

  const supabase = await createClient();

  if (mode === "signup") {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: authMessage(error.code, "No se pudo crear la cuenta."), info: null, email };
    if (!data.session) {
      return {
        error: null,
        info: "Te enviamos un email para confirmar la cuenta. Después iniciá sesión acá.",
        email,
      };
    }
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: authMessage(error.code, "No se pudo iniciar sesión."), info: null, email };
  }

  await rememberDevice(email, password);
  redirect("/");
}

/** Recuerda el dispositivo para no volver a pedir login (ver lib/device-auth). */
async function rememberDevice(email: string, password: string) {
  const sealed = await sealCredentials({ email, password });
  if (sealed) (await cookies()).set(DEVICE_COOKIE, sealed, deviceCookieOptions);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete(DEVICE_COOKIE);
  redirect("/login");
}
