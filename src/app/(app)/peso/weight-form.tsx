"use client";

import { useActionState, useState, useTransition } from "react";
import { saveWeight, type WeightFormState } from "./actions";
import { compressPhoto } from "./compress";
import { Spinner } from "@/components/ui/spinner";

const INITIAL: WeightFormState = { status: "idle", message: null, fieldErrors: {} };

export function WeightForm({ today, lastKg }: { today: string; lastKg: number | null }) {
  const [state, action, pending] = useActionState(saveWeight, INITIAL);
  const [photos, setPhotos] = useState<{ blob: Blob; url: string }[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [preparing, startPreparing] = useTransition();
  // Al guardar con éxito se vacían las fotos elegidas (el formulario lo resetea React).
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state.status === "saved") setPhotos([]);
  }

  const onFiles = (files: FileList | null) => {
    if (!files?.length) return;
    setPhotoError(null);
    startPreparing(async () => {
      const next: { blob: Blob; url: string }[] = [];
      for (const f of Array.from(files).slice(0, 4 - photos.length)) {
        try {
          const blob = await compressPhoto(f);
          next.push({ blob, url: URL.createObjectURL(blob) });
        } catch {
          setPhotoError("No se pudo leer una de las fotos.");
        }
      }
      setPhotos((ps) => [...ps, ...next].slice(0, 4));
    });
  };

  const submit = (formData: FormData) => {
    formData.delete("picker");
    photos.forEach((p, i) => formData.append("photos", new File([p.blob], `foto-${i + 1}.jpg`, { type: "image/jpeg" })));
    action(formData);
  };

  const field = "h-12 w-full rounded-2xl border border-line bg-bg px-4 text-[17px] outline-none focus:border-accent";
  return (
    <form action={submit} className="space-y-4 rounded-3xl bg-surface p-5" aria-label="Registrar peso">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-2">Peso (kg)</span>
          <input
            name="kg"
            inputMode="decimal"
            required
            placeholder={lastKg != null ? String(lastKg).replace(".", ",") : "0,0"}
            className={`${field} tabular`}
            aria-invalid={Boolean(state.fieldErrors.kg)}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-2">Fecha</span>
          <input name="date" type="date" defaultValue={today} max={today} required className={field} />
        </label>
      </div>
      {state.fieldErrors.kg && <p className="-mt-2 text-sm text-danger">{state.fieldErrors.kg}</p>}
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-2">Nota</span>
        <input name="notes" maxLength={1000} placeholder="Opcional" className={field} />
      </label>

      <div>
        <span className="mb-1.5 block text-sm font-medium text-ink-2">Fotos (privadas, opcional)</span>
        <div className="flex flex-wrap gap-2">
          {photos.map((p, i) => (
            <div key={p.url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={`Foto ${i + 1} para subir`} className="size-20 rounded-xl object-cover" />
              <button
                type="button"
                aria-label={`Quitar foto ${i + 1}`}
                onClick={() => {
                  URL.revokeObjectURL(p.url);
                  setPhotos((ps) => ps.filter((x) => x !== p));
                }}
                className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-ink text-sm text-bg"
              >
                ×
              </button>
            </div>
          ))}
          {photos.length < 4 && (
            <label className="grid size-20 cursor-pointer place-items-center rounded-xl border border-dashed border-line text-2xl text-ink-3">
              {preparing ? "…" : "+"}
              <input name="picker" type="file" accept="image/*" multiple className="sr-only" aria-label="Agregar fotos" onChange={(e) => onFiles(e.target.files)} />
            </label>
          )}
        </div>
        <p className="mt-1.5 text-sm text-ink-3">Solo vos las ves. Se achican y se les quita la ubicación antes de subirlas.</p>
        {photoError && <p className="mt-1 text-sm text-danger">{photoError}</p>}
      </div>

      {state.message && (
        <p role={state.status === "error" ? "alert" : "status"} className={`text-sm ${state.status === "error" ? "text-danger" : "text-accent"}`}>
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending || preparing}
        className="h-13 w-full rounded-2xl bg-accent text-[17px] font-semibold text-accent-ink disabled:opacity-60"
      >
        {pending && <Spinner className="mr-2 size-4 align-[-2px]" />}
        {pending ? "Guardando…" : "Guardar peso"}
      </button>
      <p className="text-center text-xs text-ink-3">Si ya había un peso ese día, se reemplaza.</p>
    </form>
  );
}
