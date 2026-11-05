"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { archiveRecipe } from "../actions";

export function ArchiveRecipeButton({ id, archived }: { id: string; archived: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="mt-10">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await archiveRecipe(id, !archived);
            if (!r.ok) return setError(r.error);
            router.refresh();
          })
        }
        className="h-12 w-full rounded-2xl bg-surface text-[15px] font-medium text-ink"
      >
        {archived ? "Restaurar del archivo" : "Archivar (ocultar sin borrar)"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
