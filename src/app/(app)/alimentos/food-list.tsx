"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatKcal } from "@/lib/format";
import { preparationLabel } from "@/lib/meals";

type Row = { id: string; name: string; brand: string | null; preparation: string; kcal: number; validated: boolean; aliases: string[] };

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function FoodList({ foods }: { foods: Row[] }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const t = norm(q.trim());
    if (!t) return foods;
    return foods.filter((f) => [f.name, f.brand ?? "", ...f.aliases].some((s) => norm(s).includes(t)));
  }, [q, foods]);

  return (
    <>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar en tu catálogo"
        aria-label="Buscar alimento"
        className="mb-3 h-12 w-full rounded-2xl border border-line bg-surface px-4 text-[17px] outline-none focus:border-accent"
      />
      <ul className="divide-y divide-line overflow-hidden rounded-3xl bg-surface">
        {shown.map((f) => (
          <li key={f.id}>
            <Link href={`/alimentos/${f.id}`} className="flex items-center justify-between gap-3 px-4 py-3.5 active:bg-surface-2">
              <span className="min-w-0">
                <span className="block truncate text-[16px] font-medium">{f.name}</span>
                <span className="block truncate text-sm text-ink-3">
                  {[f.preparation !== "na" ? preparationLabel(f.preparation) : null, f.brand, f.validated ? null : "Sin validar"]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </span>
              </span>
              <span className="tabular shrink-0 text-sm text-ink-2">{formatKcal(f.kcal)} kcal/100 g</span>
            </Link>
          </li>
        ))}
        {shown.length === 0 && <li className="px-4 py-6 text-center text-[15px] text-ink-3">Sin resultados</li>}
      </ul>
    </>
  );
}
