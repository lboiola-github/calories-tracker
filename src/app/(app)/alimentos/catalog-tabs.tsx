import Link from "next/link";

/** Pestañas entre el catálogo de alimentos y las recetas. */
export function CatalogTabs({ current }: { current: "alimentos" | "recetas" }) {
  const tab = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`border-b-2 pb-2 text-[17px] font-semibold ${active ? "border-accent text-ink" : "border-transparent text-ink-3"}`}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Catálogo" className="mb-4 flex gap-6">
      {tab("/alimentos", "Alimentos", current === "alimentos")}
      {tab("/alimentos/recetas", "Recetas", current === "recetas")}
    </nav>
  );
}
