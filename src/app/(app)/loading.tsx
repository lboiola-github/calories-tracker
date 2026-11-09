/** Esqueleto inmediato mientras el servidor arma la pantalla (se ve en el mismo toque). */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Cargando" className="animate-pulse pt-4">
      <div className="h-4 w-28 rounded-full bg-surface" />
      <div className="mt-3 h-8 w-40 rounded-full bg-surface" />
      <div className="mt-6 h-[360px] rounded-[28px] bg-surface" />
      <div className="mt-6 h-32 rounded-3xl bg-surface" />
    </div>
  );
}
