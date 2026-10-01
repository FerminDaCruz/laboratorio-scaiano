"use client";

import { useEffect, type RefObject } from "react";
import { PREFIJO_OT } from "./impresion";

export const PREFIJO_COMANDO = "CMD-";

export type Escaneo =
  | { tipo: "ot"; numero: number }
  | { tipo: "comando"; comando: string }
  | { tipo: "desconocido"; texto: string };

/**
 * Interpreta lo que llega del lector de códigos de barras, que se comporta como
 * un teclado: teclea el contenido y manda Enter.
 *
 * TODO(E13): confirmar si la lectora agrega algún prefijo o sufijo propio.
 * Mientras tanto se prueba tipeando los códigos a mano.
 */
export function interpretarEscaneo(texto: string): Escaneo {
  const limpio = texto.trim().toUpperCase();
  if (limpio === "") return { tipo: "desconocido", texto };

  if (limpio.startsWith(PREFIJO_OT)) {
    const numero = Number(limpio.slice(PREFIJO_OT.length));
    return Number.isInteger(numero) && numero > 0
      ? { tipo: "ot", numero }
      : { tipo: "desconocido", texto };
  }

  if (limpio.startsWith(PREFIJO_COMANDO)) {
    return { tipo: "comando", comando: limpio.slice(PREFIJO_COMANDO.length) };
  }

  // Un número suelto se toma como OT: así se puede tipear sin el prefijo.
  if (/^\d+$/.test(limpio)) return { tipo: "ot", numero: Number(limpio) };

  return { tipo: "desconocido", texto };
}

/**
 * Mantiene el foco en el campo de escaneo: el lector "tipea" donde esté el foco,
 * así que cualquier tecla suelta en la página lo devuelve al campo.
 */
export function useFocoDeEscaneo(campo: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    campo.current?.focus();

    function alTeclear(e: KeyboardEvent) {
      const destino = e.target as HTMLElement | null;
      const editando =
        destino &&
        (destino.tagName === "INPUT" ||
          destino.tagName === "TEXTAREA" ||
          destino.isContentEditable);
      if (editando || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length !== 1 && e.key !== "Enter") return;
      campo.current?.focus();
    }

    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [campo]);
}
