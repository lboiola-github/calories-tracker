"use client";

import { useState, useTransition } from "react";
import { formatKg } from "@/lib/format";
import { deletePhoto, deleteWeight } from "./actions";

type Entry = { id: string; date: string; label: string; kg: number; diff: number | null; notes: string | null; photos: { id: string; url: string | null }[] };

export function WeightHistory({ entries }: { entries: Entry[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      setError(r.ok ? null : (r.error ?? "No se pudo completar."));
      setConfirm(null);
    });

  return (
    <>
      {error && (
        <p role="alert" className="mb-2 text-sm text-danger">
          {error}
        </p>
      )}
      <ul className="divide-y divide-line overflow-hidden rounded-3xl bg-surface" aria-label="Registros de peso">
        {entries.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => setOpen(open === e.id ? null : e.id)}
              aria-expanded={open === e.id}
              className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left active:bg-surface-2"
            >
              <span>
                <span className="block font-medium">{e.label}</span>
                <span className="block text-sm text-ink-3">
                  {[e.photos.length ? `${e.photos.length} ${e.photos.length === 1 ? "foto" : "fotos"}` : null, e.notes].filter(Boolean).join(" · ") || " "}
                </span>
              </span>
              <span className="text-right">
                <span className="tabular block font-semibold">{formatKg(e.kg, 2)} kg</span>
                {e.diff != null && e.diff !== 0 && (
                  <span className={`tabular block text-sm ${e.diff < 0 ? "text-accent" : "text-ink-3"}`}>
                    {e.diff > 0 ? "+" : "−"}
                    {formatKg(Math.abs(e.diff), 2)}
                  </span>
                )}
              </span>
            </button>
            {open === e.id && (
              <div className="space-y-3 px-4 pb-4">
                {e.photos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {e.photos.map((p, i) => (
                      <div key={p.id} className="relative">
                        {p.url ? (
                          <a href={p.url} target="_blank" rel="noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.url} alt={`Foto ${i + 1} del ${e.label}`} className="aspect-[3/4] w-full rounded-xl object-cover" />
                          </a>
                        ) : (
                          <div className="grid aspect-[3/4] place-items-center rounded-xl bg-surface-2 text-xs text-ink-3">Sin vista</div>
                        )}
                        <button
                          type="button"
                          disabled={pending}
                          aria-label={`Quitar foto ${i + 1}`}
                          onClick={() => run(() => deletePhoto(p.id))}
                          className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-bg/80 text-sm"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {confirm === e.id ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setConfirm(null)} className="h-11 rounded-xl bg-surface-2 font-medium">
                      Cancelar
                    </button>
                    <button type="button" disabled={pending} onClick={() => run(() => deleteWeight(e.id))} className="h-11 rounded-xl bg-danger font-semibold text-bg">
                      Eliminar
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirm(e.id)} className="text-sm font-medium text-danger">
                    Eliminar este registro{e.photos.length ? " y sus fotos" : ""}
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
