import type { ReactNode } from "react";

export function PageHeader({ title, eyebrow, action }: { title: string; eyebrow?: string; action?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-4 pb-5 pt-4">
      <div>
        {eyebrow && <p className="text-sm font-medium text-ink-3">{eyebrow}</p>}
        <h1 className="font-display text-[34px] font-bold leading-tight tracking-tight">{title}</h1>
      </div>
      {action}
    </header>
  );
}
