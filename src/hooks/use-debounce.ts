"use client";

import { useEffect, useState } from "react";

/** Evita una consulta por tecla mientras se escribe en un filtro. */
export function useDebounce<T>(valor: T, ms = 250): T {
  const [demorado, setDemorado] = useState(valor);

  useEffect(() => {
    const id = setTimeout(() => setDemorado(valor), ms);
    return () => clearTimeout(id);
  }, [valor, ms]);

  return demorado;
}
