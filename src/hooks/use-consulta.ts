"use client";

import { useCallback, useEffect, useState } from "react";

export type Consulta<T> =
  | { estado: "cargando" }
  | { estado: "error"; mensaje: string }
  | { estado: "listo"; datos: T };

/**
 * Carga datos desde Supabase y deja los tres estados de §7 del design system:
 * cargando, error y listo. `recargar()` vuelve a pedir.
 */
export function useConsulta<T>(
  pedir: () => Promise<T>,
  deps: unknown[],
  mensajeError: string,
): { consulta: Consulta<T>; recargar: () => void } {
  const [consulta, setConsulta] = useState<Consulta<T>>({ estado: "cargando" });
  const [intento, setIntento] = useState(0);

  // Las dependencias las arma quien llama; el pedido se reconstruye en cada render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pedirEstable = useCallback(pedir, deps);

  useEffect(() => {
    let vigente = true;
    setConsulta({ estado: "cargando" });

    pedirEstable()
      .then((datos) => {
        if (vigente) setConsulta({ estado: "listo", datos });
      })
      .catch(() => {
        if (vigente) setConsulta({ estado: "error", mensaje: mensajeError });
      });

    return () => {
      vigente = false;
    };
  }, [pedirEstable, intento, mensajeError]);

  const recargar = useCallback(() => setIntento((n) => n + 1), []);

  return { consulta, recargar };
}
