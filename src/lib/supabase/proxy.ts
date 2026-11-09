import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEVICE_COOKIE, deviceCookieOptions, openCredentials } from "@/lib/device-auth";
import { getSupabaseEnv } from "@/lib/env";

const PUBLIC_PATHS = ["/login", "/api/ia", "/api/referencias"];

/**
 * Refresca la sesión de Supabase en cada solicitud y redirige a /login si no hay usuario.
 * Es un control optimista: cada acción del servidor vuelve a verificar la sesión, y la
 * base de datos aplica RLS de todas formas.
 */
export async function updateSession(request: NextRequest) {
  const env = getSupabaseEnv();
  if (!env) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  // No ejecutar código entre createServerClient y getClaims: puede cerrar sesiones al azar.
  const { data } = await supabase.auth.getClaims();
  let isAuthenticated = Boolean(data?.claims?.sub);
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // Sin sesión pero con el dispositivo recordado: se vuelve a entrar solo, sin pantalla de login.
  let forgetDevice = false;
  const device = request.cookies.get(DEVICE_COOKIE)?.value;
  if (!isAuthenticated && device && (!isPublic || pathname === "/login")) {
    const creds = await openCredentials(device);
    if (creds) {
      const { data: signIn, error } = await supabase.auth.signInWithPassword(creds);
      isAuthenticated = Boolean(signIn.session) && !error;
      forgetDevice = error?.code === "invalid_credentials";
    } else {
      forgetDevice = true;
    }
  }

  if (!isAuthenticated && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    if (forgetDevice) redirect.cookies.delete(DEVICE_COOKIE);
    return redirect;
  }
  if (isAuthenticated && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    // Las cookies de la sesión recién creada deben viajar con la redirección.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }
  if (isAuthenticated && device) {
    // Renueva el vencimiento del dispositivo recordado (400 días desde el último uso).
    response.cookies.set(DEVICE_COOKIE, device, deviceCookieOptions);
  }
  return response;
}
