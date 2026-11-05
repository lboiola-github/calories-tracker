"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MealComposer } from "@/components/meal-composer";
import { NAV_ITEMS, isActive } from "./nav-items";

/**
 * Barra inferior pensada para una mano: 4 destinos + acción principal al centro.
 * El botón central abre el campo de registro y enfoca el teclado en el mismo toque,
 * para que el micrófono del teclado de iOS quede a un toque de distancia.
 */
export function BottomNav() {
  const pathname = usePathname();
  const [left, right] = [NAV_ITEMS.slice(0, 2), NAV_ITEMS.slice(2)];

  const renderItem = ({ href, label, Icon }: (typeof NAV_ITEMS)[number]) => {
    const active = isActive(pathname, href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={`flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors ${
          active ? "text-ink" : "text-ink-3"
        }`}
      >
        <Icon className="size-6" strokeWidth={active ? 2.1 : 1.75} />
        {label}
      </Link>
    );
  };

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/85 pb-safe backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-md items-end px-2">
        {left.map(renderItem)}
        <div className="flex flex-1 justify-center">
          <MealComposer />
        </div>
        {right.map(renderItem)}
      </div>
    </nav>
  );
}
