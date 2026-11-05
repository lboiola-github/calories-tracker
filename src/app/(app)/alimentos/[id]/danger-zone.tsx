"use client";

import { useState, useTransition } from "react";
import { archiveFood, deleteFood } from "../actions";

export function FoodDangerZone({ id, archived }: { id: string; archived: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  return (
    <section className="mt-10 space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => archiveFood(id, !archived))}
        className="h-12 w-full rounded-2xl bg-surface text-[15px] font-medium text-ink"
      >
        {archived ? "Restaurar del archivo" : "Archivar (ocultar sin borrar)"}
      </button>
      {confirming ? (
        <div className="rounded-2xl bg-surface p-4">
          <p className="text-[15px]">¿Eliminar definitivamente? Las comidas ya registradas conservan sus valores.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setConfirming(false)} className="h-11 rounded-xl bg-surface-2 font-medium">
              Cancelar
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => start(() => deleteFood(id))}
              className="h-11 rounded-xl bg-danger font-semibold text-white"
            >
              Eliminar
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="h-12 w-full rounded-2xl text-[15px] font-medium text-danger">
          Eliminar alimento
        </button>
      )}
    </section>
  );
}
