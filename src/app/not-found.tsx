import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-5xl font-bold text-ink-3">404</p>
      <h1 className="mt-3 font-display text-xl font-semibold">Esta pantalla no existe</h1>
      <Link href="/" className="mt-6 rounded-2xl bg-accent px-5 py-3 font-semibold text-accent-ink">
        Volver al inicio
      </Link>
    </main>
  );
}
