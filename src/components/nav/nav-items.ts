import { FoodIcon, HistoryIcon, HomeIcon, WeightIcon } from "@/components/ui/icons";

/** Orden según prioridad de navegación del producto. "Registrar" va al centro. */
export const NAV_ITEMS = [
  { href: "/", label: "Inicio", Icon: HomeIcon },
  { href: "/historial", label: "Historial", Icon: HistoryIcon },
  { href: "/peso", label: "Peso", Icon: WeightIcon },
  { href: "/alimentos", label: "Alimentos", Icon: FoodIcon },
] as const;

export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
