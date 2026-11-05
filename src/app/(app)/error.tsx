"use client";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mt-16 rounded-3xl bg-surface p-6 text-center">
      <p className="font-display text-lg font-semibold">No se pudo cargar esta pantalla</p>
      <p className="mt-1 text-[15px] text-ink-2">Puede ser un problema de conexión. Tus datos no se perdieron.</p>
      <button onClick={reset} className="mt-5 rounded-2xl bg-accent px-5 py-3 font-semibold text-accent-ink">
        Reintentar
      </button>
    </div>
  );
}
