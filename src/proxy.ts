import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Excluye estáticos, íconos y manifest: deben cargarse sin sesión (instalación en iOS).
  matcher: ["/((?!_next/static|_next/image|icons/|manifest.webmanifest|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
