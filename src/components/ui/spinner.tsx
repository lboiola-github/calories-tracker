/** Indicador de carga chico, hereda el color del texto. */
export function Spinner({ className = "size-5" }: { className?: string }) {
  return (
    <span
      role="presentation"
      aria-hidden="true"
      className={`inline-block animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
    />
  );
}
