"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { logItems } from "@/app/(app)/comidas/actions";
import {
  interpretMeal,
  transcribeMeal,
  type Interpreted,
} from "@/app/(app)/comidas/interpret-actions";
import {
  InterpretReview,
  LoggedCard,
  type LoggedSummary,
} from "@/components/interpret-review";
import { canAutoLog } from "@/lib/ai/resolve";
import { newOperationId } from "@/lib/op-id";
import { flushSync } from "react-dom";
import { CloseIcon, MicIcon, PlusIcon, SendIcon } from "@/components/ui/icons";
import { readLocal, writeLocal } from "@/lib/safe-storage";
import { useKeyboardInset } from "@/lib/use-keyboard-inset";
import { useRecorder } from "@/lib/use-recorder";

const DRAFT_KEY = "meal-composer-draft";

const EXAMPLES = [
  "Almorcé 230 g de pechuga de pollo cocida y 180 g de ensalada sin aceite",
  "Desayuné dos huevos revueltos y dos tostadas",
  "Agregame 150 g de arroz blanco cocido al almuerzo",
];

/**
 * Registro en lenguaje natural, por voz primero:
 * - Tocar + empieza a grabar en el mismo toque. Al dejar de hablar se corta solo, se transcribe,
 *   se interpreta y se registra (o se pide revisar lo que falte).
 * - Si el micrófono no está disponible, queda el campo de texto (y el dictado del teclado).
 * - El borrador se guarda localmente para no perder un texto largo.
 */
export function MealComposer() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [review, setReview] = useState<Interpreted | null>(null);
  const [logged, setLogged] = useState<LoggedSummary | null>(null);
  // Última interpretación: "Editar" deshace lo registrado y vuelve a abrirla para corregir.
  const [last, setLast] = useState<Interpreted | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const keyboardInset = useKeyboardInset(open);
  const [mode, setMode] = useState<"voice" | "text">("voice");
  const [transcribing, setTranscribing] = useState(false);

  const reset = () => {
    setNotice(null);
    setReview(null);
    setLogged(null);
    setOpen(true);
  };

  /** Toque en +: abre y empieza a grabar en el mismo gesto (iOS lo exige para el micrófono). */
  const openComposer = () => {
    reset();
    setText("");
    setMode("voice");
    void recorder.start().then((ok) => {
      if (!ok) {
        setMode("text");
        setText(readLocal(DRAFT_KEY) ?? "");
        setNotice(
          "No se pudo usar el micrófono: escribí o usá el dictado del teclado.",
        );
      }
    });
  };

  /** Pasar a escribir (dentro de un toque, así iOS muestra el teclado). */
  const switchToText = () => {
    recorder.cancel();
    flushSync(() => {
      setMode("text");
      setText(readLocal(DRAFT_KEY) ?? "");
    });
    textareaRef.current?.focus();
  };

  const close = () => {
    recorder.cancel();
    textareaRef.current?.blur();
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const previous = html.style.overflow;
    html.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      html.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onChange = (value: string) => {
    setText(value);
    writeLocal(DRAFT_KEY, value);
  };

  const finish = (summary: LoggedSummary) => {
    writeLocal(DRAFT_KEY, "");
    setText("");
    setReview(null);
    setLogged(summary);
    router.refresh();
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || pending || review || logged) return;
    textareaRef.current?.blur();
    run(text);
  };

  const run = (input: string) => {
    setNotice(null);
    start(async () => {
      const text = input;
      const r = await interpretMeal(text);
      if (!r.ok) return setNotice(r.error);
      const res = r.data;
      setLast(res);
      // Todo completo y con alimentos validados: se registra directo y se muestra qué se registró.
      if (canAutoLog(res.items)) {
        const items = res.items.map((i) => ({
          foodId: i.match!.id,
          quantity: i.quantity!,
          unit: i.unit,
        }));
        const logRes = await logItems({
          operationId: newOperationId(),
          date: res.date,
          mealType: res.mealType,
          inputText: text,
          items,
        });
        if (logRes.ok) {
          return finish({
            itemIds: logRes.data.itemIds,
            date: res.date,
            meal: res.mealType,
            lines: res.items.map((i) => ({
              name: i.match!.name,
              grams: i.grams!,
              kcal: (i.grams! * i.match!.kcalPer100g) / 100,
            })),
          });
        }
      }
      setReview(res);
    });
  };

  const recorder = useRecorder((blob) => {
    setTranscribing(true);
    const fd = new FormData();
    fd.append(
      "audio",
      new File([blob], "dictado", { type: blob.type || "audio/mp4" }),
    );
    transcribeMeal(fd)
      .then((r) => {
        if (!r.ok) {
          setMode("text");
          return setNotice(r.error);
        }
        onChange(r.data.text);
        setMode("text");
        run(r.data.text);
      })
      .catch(() => {
        setMode("text");
        setNotice("No se pudo transcribir. Escribilo.");
      })
      .finally(() => setTranscribing(false));
  });

  return (
    <>
      <button
        type="button"
        onClick={openComposer}
        aria-label="Registrar comida"
        className="-mt-8 mb-1 grid size-16 place-items-center rounded-full bg-accent text-accent-ink shadow-[0_10px_30px_-8px_var(--accent)] ring-4 ring-bg transition-transform active:scale-95"
      >
        <PlusIcon className="size-8" strokeWidth={2.4} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="composer-title"
        >
          <button
            type="button"
            aria-label="Cerrar"
            onClick={close}
            className="animate-fade-in absolute inset-0 bg-black/60 backdrop-blur-[2px]"
          />
          <form
            onSubmit={onSubmit}
            style={{ bottom: keyboardInset }}
            className={`animate-sheet-in absolute inset-x-0 mx-auto max-w-md rounded-t-[28px] bg-surface px-5 pt-4 shadow-2xl transition-[bottom] duration-150 ${
              keyboardInset > 0
                ? "pb-3"
                : "pb-[calc(env(safe-area-inset-bottom)+16px)]"
            }`}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-surface-2" />
            <div className="mb-3 flex items-center justify-between">
              <h2
                id="composer-title"
                className="font-display text-lg font-semibold tracking-tight"
              >
                ¿Qué comiste?
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Cerrar"
                className="grid size-9 place-items-center rounded-full bg-surface-2 text-ink-2"
              >
                <CloseIcon className="size-5" />
              </button>
            </div>

            {mode === "voice" && !logged && !review ? (
              <section
                aria-label="Grabando"
                className="flex flex-col items-center pb-2 pt-2"
              >
                <button
                  type="button"
                  onClick={recorder.stop}
                  disabled={recorder.state !== "recording"}
                  aria-label="Listo, terminar de grabar"
                  className="relative grid size-28 place-items-center rounded-full bg-accent text-accent-ink"
                >
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full bg-accent/30 transition-transform duration-100"
                    style={{ transform: `scale(${1 + recorder.level * 0.6})` }}
                  />
                  <MicIcon className="relative size-10" strokeWidth={2} />
                </button>
                <p role="status" className="mt-4 text-[17px] font-medium">
                  {transcribing
                    ? "Transcribiendo…"
                    : recorder.state === "starting"
                      ? "Activando micrófono…"
                      : "Te escucho. Contá qué comiste."}
                </p>
                <p className="mt-1 text-sm text-ink-3">
                  {transcribing
                    ? "Un segundo."
                    : "Se corta solo cuando dejás de hablar, o tocá el micrófono."}
                </p>
                <button
                  type="button"
                  onClick={switchToText}
                  className="mt-5 text-sm font-medium text-accent"
                >
                  Prefiero escribir
                </button>
              </section>
            ) : logged ? (
              <LoggedCard
                summary={logged}
                onAccept={close}
                onUndone={() => {
                  setLogged(null);
                  setReview(
                    last
                      ? { ...last, mealType: logged.meal, date: logged.date }
                      : null,
                  );
                  router.refresh();
                }}
              />
            ) : review ? (
              <div className="max-h-[60vh] overflow-y-auto pb-2">
                <InterpretReview result={review} onLogged={finish} />
                <button
                  type="button"
                  onClick={() => setReview(null)}
                  className="mt-2 text-sm font-medium text-ink-2"
                >
                  Volver al texto
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-end gap-2 rounded-3xl bg-surface-2 p-2 pl-4">
                  <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        !e.shiftKey &&
                        !e.nativeEvent.isComposing
                      ) {
                        e.preventDefault();
                        e.currentTarget.form?.requestSubmit();
                      }
                    }}
                    rows={3}
                    lang="es-AR"
                    enterKeyHint="send"
                    autoCapitalize="sentences"
                    autoCorrect="on"
                    spellCheck
                    aria-label="Describí la comida"
                    placeholder="Ej.: almorcé 230 g de pollo cocido y una ensalada"
                    className="max-h-48 min-h-[4.5rem] flex-1 resize-none bg-transparent py-2 text-[17px] leading-snug text-ink outline-none placeholder:text-ink-3"
                  />
                  <button
                    type="submit"
                    disabled={!text.trim() || pending}
                    aria-label="Registrar"
                    className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-accent-ink transition-opacity disabled:opacity-30"
                  >
                    <SendIcon className="size-5" strokeWidth={2.2} />
                  </button>
                </div>

                {pending ? (
                  <p role="status" className="mt-3 text-sm text-ink-2">
                    Interpretando…
                  </p>
                ) : notice ? (
                  <p role="status" className="mt-3 text-sm text-ink-2">
                    {notice}
                  </p>
                ) : (
                  <p className="mt-3 flex items-center gap-1.5 text-sm text-ink-3">
                    <MicIcon className="size-4" /> Tocá el micrófono del teclado
                    para dictar.
                  </p>
                )}

                <Link
                  href="/registrar"
                  onClick={close}
                  className="mt-2 inline-block text-sm font-medium text-accent"
                >
                  Cargar a mano
                </Link>

                {!text && keyboardInset === 0 && (
                  <ul className="mt-4 space-y-2">
                    {EXAMPLES.map((example) => (
                      <li key={example}>
                        <button
                          type="button"
                          onClick={() => {
                            onChange(example);
                            textareaRef.current?.focus();
                          }}
                          className="w-full rounded-2xl border border-line px-4 py-3 text-left text-[15px] text-ink-2 active:bg-surface-2"
                        >
                          {example}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </form>
        </div>
      )}
    </>
  );
}
