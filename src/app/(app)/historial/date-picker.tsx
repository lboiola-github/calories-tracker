"use client";

import { useRouter } from "next/navigation";
import { formatLongDate } from "@/lib/dates";

export function DatePicker({ date, max }: { date: string; max: string }) {
  const router = useRouter();
  return (
    <label className="relative flex flex-col items-center px-2">
      <span className="text-[15px] font-semibold first-letter:uppercase">{formatLongDate(date)}</span>
      <span className="text-xs text-accent">Elegir fecha</span>
      <input
        type="date"
        value={date}
        max={max}
        aria-label="Elegir fecha"
        onChange={(e) => e.target.value && router.push(`/historial?fecha=${e.target.value}`)}
        className="absolute inset-0 opacity-0"
      />
    </label>
  );
}
