// Notación dental FDI.
//
// Cuadrantes permanentes, desde el punto de vista del paciente:
//   1 = superior derecho (1.8 → 1.1)   2 = superior izquierdo (2.1 → 2.8)
//   4 = inferior derecho (4.8 → 4.1)   3 = inferior izquierdo (3.1 → 3.8)
// Temporales: 5 y 6 arriba, 8 y 7 abajo, con cinco piezas por cuadrante.
//
// El valor se guarda serializado en un solo campo (orden_items.piezas):
//   null          → sin pieza
//   "1.8,2.4"     → piezas sueltas
//   "2.4-2.6"     → tramo (un puente)
//   "arcada:sup"  → arcada completa (sup | inf | ambas)

export type Arcada = "sup" | "inf" | "ambas";

export type Piezas =
  | { modo: "ninguna" }
  | { modo: "sueltas"; piezas: string[] }
  | { modo: "tramo"; desde: string; hasta: string }
  | { modo: "arcada"; arcada: Arcada };

export const SIN_PIEZAS: Piezas = { modo: "ninguna" };

export const ETIQUETA_ARCADA: Record<Arcada, string> = {
  sup: "arcada sup.",
  inf: "arcada inf.",
  ambas: "ambas arcadas",
};

const PIEZAS_POR_CUADRANTE: Record<number, number> = {
  1: 8, 2: 8, 3: 8, 4: 8,
  5: 5, 6: 5, 7: 5, 8: 5,
};

/** Piezas de un cuadrante, de la 1 a la última: ["1.1", …, "1.8"]. */
export function piezasDeCuadrante(cuadrante: number): string[] {
  const cantidad = PIEZAS_POR_CUADRANTE[cuadrante];
  if (!cantidad) return [];
  return Array.from({ length: cantidad }, (_, i) => `${cuadrante}.${i + 1}`);
}

/**
 * Orden anatómico de una arcada, de derecha a izquierda del paciente,
 * que es como se ve y como se dibuja: 1.8 … 1.1 | 2.1 … 2.8.
 */
export function secuenciaArcada(arcada: "sup" | "inf", temporales = false): string[] {
  const [derecha, izquierda] = temporales
    ? arcada === "sup"
      ? [5, 6]
      : [8, 7]
    : arcada === "sup"
      ? [1, 2]
      : [4, 3];
  return [...piezasDeCuadrante(derecha).reverse(), ...piezasDeCuadrante(izquierda)];
}

export function arcadaDePieza(pieza: string): "sup" | "inf" | null {
  const cuadrante = Number(pieza[0]);
  if ([1, 2, 5, 6].includes(cuadrante)) return "sup";
  if ([3, 4, 7, 8].includes(cuadrante)) return "inf";
  return null;
}

export function esTemporal(pieza: string): boolean {
  return Number(pieza[0]) >= 5;
}

export function esPieza(texto: string): boolean {
  const partes = /^([1-8])\.([1-8])$/.exec(texto);
  if (!partes) return false;
  return Number(partes[2]) <= PIEZAS_POR_CUADRANTE[Number(partes[1])];
}

/** Acepta "1.8", "18" y "1,8". Devuelve null si no es una pieza válida. */
export function normalizarPieza(texto: string): string | null {
  const limpio = texto.trim().replace(",", ".");
  const candidato = /^[1-8][1-8]$/.test(limpio) ? `${limpio[0]}.${limpio[1]}` : limpio;
  return esPieza(candidato) ? candidato : null;
}

/** Piezas que abarca un tramo, incluidos los extremos. Vacío si no son de la misma arcada. */
export function piezasDelTramo(desde: string, hasta: string): string[] {
  const arcada = arcadaDePieza(desde);
  if (!arcada || arcada !== arcadaDePieza(hasta)) return [];
  if (esTemporal(desde) !== esTemporal(hasta)) return [];

  const secuencia = secuenciaArcada(arcada, esTemporal(desde));
  const a = secuencia.indexOf(desde);
  const b = secuencia.indexOf(hasta);
  if (a === -1 || b === -1) return [];
  return secuencia.slice(Math.min(a, b), Math.max(a, b) + 1);
}

/** Ordena piezas sueltas como se ven en la boca: primero la arcada superior. */
export function ordenarPiezas(piezas: string[]): string[] {
  const orden = [
    ...secuenciaArcada("sup"),
    ...secuenciaArcada("sup", true),
    ...secuenciaArcada("inf"),
    ...secuenciaArcada("inf", true),
  ];
  return [...piezas].sort((a, b) => orden.indexOf(a) - orden.indexOf(b));
}

export function serializarPiezas(valor: Piezas): string | null {
  switch (valor.modo) {
    case "ninguna":
      return null;
    case "sueltas":
      return valor.piezas.length === 0 ? null : ordenarPiezas(valor.piezas).join(",");
    case "tramo":
      return `${valor.desde}-${valor.hasta}`;
    case "arcada":
      return `arcada:${valor.arcada}`;
  }
}

export function parsearPiezas(texto: string | null | undefined): Piezas {
  if (!texto) return SIN_PIEZAS;
  const limpio = texto.trim();

  if (limpio.startsWith("arcada:")) {
    const arcada = limpio.slice("arcada:".length) as Arcada;
    return arcada in ETIQUETA_ARCADA ? { modo: "arcada", arcada } : SIN_PIEZAS;
  }

  if (limpio.includes("-")) {
    const [desde, hasta] = limpio.split("-").map((p) => normalizarPieza(p) ?? "");
    return desde && hasta && piezasDelTramo(desde, hasta).length > 0
      ? { modo: "tramo", desde, hasta }
      : SIN_PIEZAS;
  }

  const piezas = limpio
    .split(/[,\s]+/)
    .map(normalizarPieza)
    .filter((p): p is string => p !== null);
  return piezas.length > 0 ? { modo: "sueltas", piezas: ordenarPiezas(piezas) } : SIN_PIEZAS;
}

/**
 * Lo que se tipea en el campo: "2.4-2.6", "18 24", "arcada sup", "ambas".
 * Devuelve null cuando no se entiende, para poder mostrar el error.
 */
export function parsearEntradaPiezas(texto: string): Piezas | null {
  const limpio = texto.trim().toLowerCase();
  if (limpio === "") return SIN_PIEZAS;

  if (limpio.startsWith("arcada") || ["sup", "superior", "inf", "inferior", "ambas"].includes(limpio)) {
    const resto = limpio.replace(/^arcada/, "").trim();
    const palabra = resto === "" ? "ambas" : resto;
    if (palabra.startsWith("sup")) return { modo: "arcada", arcada: "sup" };
    if (palabra.startsWith("inf")) return { modo: "arcada", arcada: "inf" };
    if (palabra.startsWith("amb")) return { modo: "arcada", arcada: "ambas" };
    return null;
  }

  if (limpio.includes("-")) {
    const partes = limpio.split("-");
    if (partes.length !== 2) return null;
    const desde = normalizarPieza(partes[0]);
    const hasta = normalizarPieza(partes[1]);
    if (!desde || !hasta || piezasDelTramo(desde, hasta).length === 0) return null;
    return { modo: "tramo", desde, hasta };
  }

  const crudas = limpio.split(/[,\s]+/).filter(Boolean);
  const piezas = crudas.map(normalizarPieza);
  if (piezas.some((p) => p === null)) return null;
  return { modo: "sueltas", piezas: ordenarPiezas(piezas as string[]) };
}

/** Texto editable del campo, el mismo que se puede tipear. */
export function describirPiezas(valor: Piezas): string {
  switch (valor.modo) {
    case "ninguna":
      return "";
    case "sueltas":
      return valor.piezas.join(" ");
    case "tramo":
      return `${valor.desde}-${valor.hasta}`;
    case "arcada":
      return `arcada ${valor.arcada}`;
  }
}

/** Formato de §8 del design system: "1.8" · "2.4–2.6" · "arcada sup." · "—" */
export function formatPieza(texto: string | null | undefined): string {
  const valor = parsearPiezas(texto);
  switch (valor.modo) {
    case "ninguna":
      return "—";
    case "sueltas":
      return valor.piezas.join(" · ");
    case "tramo":
      return `${valor.desde}–${valor.hasta}`;
    case "arcada":
      return ETIQUETA_ARCADA[valor.arcada];
  }
}

/** Piezas que quedan resaltadas en el odontograma para un valor dado. */
export function piezasSeleccionadas(valor: Piezas): string[] {
  switch (valor.modo) {
    case "ninguna":
      return [];
    case "sueltas":
      return valor.piezas;
    case "tramo":
      return piezasDelTramo(valor.desde, valor.hasta);
    case "arcada":
      return valor.arcada === "ambas"
        ? [...secuenciaArcada("sup"), ...secuenciaArcada("inf")]
        : secuenciaArcada(valor.arcada);
  }
}
