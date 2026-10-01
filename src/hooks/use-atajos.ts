"use client";

import { useEffect, type RefObject } from "react";

function editando(destino: EventTarget | null): boolean {
  const el = destino as HTMLElement | null;
  if (!el) return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable
  );
}

/** §6: "/" pone el foco en el buscador de la página. */
export function useAtajoBuscador(ref: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    function alTeclear(e: KeyboardEvent) {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      if (editando(e.target)) return;
      e.preventDefault();
      ref.current?.focus();
      ref.current?.select();
    }
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [ref]);
}

/** §6: Ctrl/Cmd + Enter guarda el formulario desde cualquier campo. */
export function alTeclearEnFormulario(e: React.KeyboardEvent<HTMLFormElement>) {
  if (e.key !== "Enter") return;
  const destino = e.target as HTMLElement;
  if (destino.tagName === "TEXTAREA" && !(e.ctrlKey || e.metaKey)) return;
  if (destino.tagName === "BUTTON" && !(e.ctrlKey || e.metaKey)) return;

  e.preventDefault();
  if (e.ctrlKey || e.metaKey) {
    e.currentTarget.requestSubmit();
    return;
  }

  // Enter solo avanza al campo siguiente.
  const campos = Array.from(
    e.currentTarget.querySelectorAll<HTMLElement>(
      "input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button[type=submit]:not([disabled])",
    ),
  ).filter((el) => el.offsetParent !== null);
  const siguiente = campos[campos.indexOf(destino) + 1];
  siguiente?.focus();
  if (siguiente instanceof HTMLInputElement) siguiente.select();
}
