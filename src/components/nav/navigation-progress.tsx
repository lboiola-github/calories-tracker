"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Barra fina arriba mientras se carga otra pantalla: aparece en el mismo toque de un enlace
 * interno y desaparece cuando cambia la URL. Así un tap nunca parece ignorado.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const here = `${pathname}?${search}`;
  // Guarda desde qué URL se navegó: al cambiar la URL, la barra se oculta sola.
  const [from, setFrom] = useState<string | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname.startsWith("/exportar")) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      setFrom(`${location.pathname}?${location.search.replace(/^\?/, "")}`);
    };
    // iOS solo aplica :active si hay un listener de toque.
    const noop = () => {};
    document.addEventListener("click", onClick, true);
    document.addEventListener("touchstart", noop, { passive: true });
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("touchstart", noop);
    };
  }, []);

  // Si la navegación falla o se cancela, no queda la barra para siempre.
  useEffect(() => {
    if (from == null) return;
    const t = setTimeout(() => setFrom(null), 15000);
    return () => clearTimeout(t);
  }, [from]);

  if (from == null || from !== here) return null;
  return (
    <div
      role="progressbar"
      aria-label="Cargando"
      className="pointer-events-none fixed inset-x-0 z-50 h-[3px] overflow-hidden"
      style={{ top: "env(safe-area-inset-top)" }}
    >
      <div className="animate-nav-progress h-full rounded-r-full bg-accent shadow-[0_0_8px_var(--accent)]" />
    </div>
  );
}
