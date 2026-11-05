"use client";

import { useEffect, type ReactNode } from "react";
import { CloseIcon } from "@/components/ui/icons";
import { useKeyboardInset } from "@/lib/use-keyboard-inset";

/** Hoja inferior reutilizable, sube con el teclado y respeta el área segura. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const inset = useKeyboardInset(open);
  useEffect(() => {
    if (!open) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Cerrar" onClick={onClose} className="animate-fade-in absolute inset-0 bg-black/30" />
      <div
        style={{ bottom: inset }}
        className={`animate-sheet-in absolute inset-x-0 mx-auto max-h-[85dvh] max-w-md overflow-y-auto rounded-t-[28px] bg-surface px-5 pt-4 shadow-2xl ${
          inset > 0 ? "pb-3" : "pb-[calc(env(safe-area-inset-bottom)+16px)]"
        }`}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="grid size-9 place-items-center rounded-full bg-surface-2 text-ink-2">
            <CloseIcon className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
