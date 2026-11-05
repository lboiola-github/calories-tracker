import { getSupabaseEnv } from "@/lib/env";
import { LoginForm } from "./login-form";

export const metadata = { title: "Iniciar sesión" };

export default function LoginPage() {
  const configured = getSupabaseEnv() !== null;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 pt-safe pb-safe">
      <div className="mb-8">
        <div className="mb-5 size-14 rounded-[18px] bg-gradient-to-br from-[#ff7a45] to-[#f2481f] p-2 shadow-lg">
          <svg viewBox="0 0 512 512" aria-hidden className="size-full">
            <circle cx="256" cy="256" r="150" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth="64" />
            <path d="M256 106 A150 150 0 1 1 113.3 302.4" fill="none" stroke="#fff" strokeWidth="64" strokeLinecap="round" />
          </svg>
        </div>
        <h1 className="font-display text-[34px] font-bold leading-tight tracking-tight">Calorías</h1>
        <p className="mt-1 text-[17px] text-ink-2">Registrá lo que comés hablando, sin vueltas.</p>
      </div>
      {configured ? (
        <LoginForm />
      ) : (
        <p role="alert" className="rounded-2xl bg-accent-soft p-4 text-[15px] text-ink">
          Falta configurar Supabase: definí <code>NEXT_PUBLIC_SUPABASE_URL</code> y{" "}
          <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>.
        </p>
      )}
    </main>
  );
}
