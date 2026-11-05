"use client";

import { useActionState, useState } from "react";
import { authenticate, type AuthState } from "./actions";

const initial: AuthState = { error: null, info: null, email: "" };

export function LoginForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [state, action, pending] = useActionState(authenticate, initial);
  const isSignup = mode === "signup";

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="mode" value={mode} />
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-2">Email</span>
        <input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          defaultValue={state.email}
          className="h-13 w-full rounded-2xl border border-line bg-surface px-4 text-[17px] outline-none focus:border-accent"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-2">Contraseña</span>
        <input
          name="password"
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          minLength={8}
          required
          className="h-13 w-full rounded-2xl border border-line bg-surface px-4 text-[17px] outline-none focus:border-accent"
        />
      </label>

      <div aria-live="polite" className="min-h-6 text-sm">
        {state.error && <p className="text-danger">{state.error}</p>}
        {state.info && <p className="text-success">{state.info}</p>}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="h-13 w-full rounded-2xl bg-accent text-[17px] font-semibold text-accent-ink transition-opacity disabled:opacity-60"
      >
        {pending ? "Un momento…" : isSignup ? "Crear cuenta" : "Iniciar sesión"}
      </button>

      <button
        type="button"
        onClick={() => setMode(isSignup ? "signin" : "signup")}
        className="w-full py-2 text-[15px] text-ink-2"
      >
        {isSignup ? "Ya tengo cuenta" : "Crear una cuenta"}
      </button>
    </form>
  );
}
