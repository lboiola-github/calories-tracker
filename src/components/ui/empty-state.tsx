import type { ReactNode } from "react";

export function EmptyState({ title, description, icon }: { title: string; description: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-line bg-surface px-6 py-10 text-center">
      {icon && <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-surface-2 text-ink-2">{icon}</div>}
      <p className="font-display text-[17px] font-semibold">{title}</p>
      <p className="mt-1 max-w-[30ch] text-[15px] leading-relaxed text-ink-2">{description}</p>
    </div>
  );
}
