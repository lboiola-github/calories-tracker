"use client";

import { useEffect, useState } from "react";

/**
 * Altura cubierta por el teclado virtual, en px.
 * En iOS el teclado no achica el layout viewport, así que un elemento `fixed; bottom: 0`
 * queda debajo del teclado. visualViewport sí refleja el área visible.
 */
export function useKeyboardInset(enabled: boolean): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!enabled || !vv) return;

    const update = () => {
      const covered = window.innerHeight - vv.height - vv.offsetTop;
      setInset(Math.max(0, Math.round(covered)));
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      setInset(0);
    };
  }, [enabled]);

  return inset;
}
