// Notación dental FDI.
//
// Cuadrantes permanentes, desde el punto de vista del paciente:
//   1 = superior derecho (1.8 → 1.1)   2 = superior izquierdo (2.1 → 2.8)
//   4 = inferior derecho (4.8 → 4.1)   3 = inferior izquierdo (3.1 → 3.8)
// Temporales: 5 y 6 arriba, 8 y 7 abajo, con cinco piezas por cuadrante.
//
// El valor se guarda serializado en un solo campo (orden_items.piezas):
//   null                → sin pieza
//   "1.8"               → una pieza suelta
//   "2.4-2.6"           → un tramo (un puente)
//   "1.1,2.4-2.6"       → piezas sueltas y tramos combinados
//   "arcada:sup"        → arcada completa (sup | inf | ambas)

export type Arcada = "sup" | "inf" | "ambas";

/** Una parte de la selección: una pieza suelta o un tramo. */
export type Parte =
  | { tipo: "pieza"; pieza: string }
  | { tipo: "tramo"; desde: string; hasta: string };

export type Piezas =
  | { modo: "ninguna" }
  | { modo: "partes"; partes: Parte[] }
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

/** Todas las piezas en el orden en que se ven en la boca. */
function ordenAnatomico(): string[] {
  return [
    ...secuenciaArcada("sup"),
    ...secuenciaArcada("sup", true),
    ...secuenciaArcada("inf"),
    ...secuenciaArcada("inf", true),
  ];
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

/**
 * Arma un tramo con las puntas ordenadas por número de pieza, que es como se
 * dicta: "del 4.5 al 4.7". En la arcada inferior eso no coincide con el orden
 * del dibujo (4.8 → 4.1), y se prefiere cómo lo dice la gente.
 */
export function crearTramo(desde: string, hasta: string): Parte | null {
  const abarcadas = piezasDelTramo(desde, hasta);
  if (abarcadas.length === 0) return null;
  if (abarcadas.length === 1) return { tipo: "pieza", pieza: abarcadas[0] };

  const [menor, mayor] = [desde, hasta].sort();
  return { tipo: "tramo", desde: menor, hasta: mayor };
}

/** Ordena piezas sueltas como se ven en la boca: primero la arcada superior. */
export function ordenarPiezas(piezas: string[]): string[] {
  const orden = ordenAnatomico();
  return [...piezas].sort((a, b) => orden.indexOf(a) - orden.indexOf(b));
}

export function piezasDeParte(parte: Parte): string[] {
  return parte.tipo === "pieza" ? [parte.pieza] : piezasDelTramo(parte.desde, parte.hasta);
}

/**
 * Deja la selección prolija: sin repetidos, sin piezas sueltas que ya estén
 * dentro de un tramo, y ordenada como se ve en la boca.
 */
export function normalizarPartes(partes: Parte[]): Parte[] {
  const cubiertasPorTramos = new Set(
    partes.filter((p) => p.tipo === "tramo").flatMap((p) => piezasDeParte(p)),
  );

  const vistas = new Set<string>();
  const limpias: Parte[] = [];

  for (const parte of partes) {
    if (parte.tipo === "pieza") {
      if (cubiertasPorTramos.has(parte.pieza) || vistas.has(parte.pieza)) continue;
      vistas.add(parte.pieza);
      limpias.push(parte);
      continue;
    }
    const clave = `${parte.desde}-${parte.hasta}`;
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    limpias.push(parte);
  }

  const orden = ordenAnatomico();
  return limpias.sort(
    (a, b) => orden.indexOf(piezasDeParte(a)[0]) - orden.indexOf(piezasDeParte(b)[0]),
  );
}

function desdePartes(partes: Parte[]): Piezas {
  const limpias = normalizarPartes(partes);
  return limpias.length === 0 ? SIN_PIEZAS : { modo: "partes", partes: limpias };
}

function textoDeParte(parte: Parte): string {
  return parte.tipo === "pieza" ? parte.pieza : `${parte.desde}-${parte.hasta}`;
}

export function serializarPiezas(valor: Piezas): string | null {
  switch (valor.modo) {
    case "ninguna":
      return null;
    case "partes":
      return valor.partes.length === 0 ? null : valor.partes.map(textoDeParte).join(",");
    case "arcada":
      return `arcada:${valor.arcada}`;
  }
}

/** Lee un token suelto: "1.8", "18", "2.4-2.6" o "24-26". */
function parsearParte(texto: string): Parte | null {
  const limpio = texto.trim();
  if (limpio === "") return null;

  if (limpio.includes("-")) {
    const puntas = limpio.split("-");
    if (puntas.length !== 2) return null;
    const desde = normalizarPieza(puntas[0]);
    const hasta = normalizarPieza(puntas[1]);
    if (!desde || !hasta) return null;
    return crearTramo(desde, hasta);
  }

  const pieza = normalizarPieza(limpio);
  return pieza ? { tipo: "pieza", pieza } : null;
}

/** Lee lo guardado en la base. Lo que no se entiende se descarta. */
export function parsearPiezas(texto: string | null | undefined): Piezas {
  if (!texto) return SIN_PIEZAS;
  const limpio = texto.trim();

  if (limpio.startsWith("arcada:")) {
    const arcada = limpio.slice("arcada:".length) as Arcada;
    return arcada in ETIQUETA_ARCADA ? { modo: "arcada", arcada } : SIN_PIEZAS;
  }

  const partes = limpio
    .split(/[,\s]+/)
    .map(parsearParte)
    .filter((p): p is Parte => p !== null);

  return desdePartes(partes);
}

/**
 * Lo que se tipea en el campo: "2.4-2.6", "1.1, 2.4-2.6", "18 24", "arcada sup".
 * Las partes van separadas por coma (los espacios no molestan) y en cualquier orden.
 * Devuelve null cuando algo no se entiende, para poder mostrar el error.
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

  const tokens = limpio.split(/[,\s]+/).filter(Boolean);
  const partes: Parte[] = [];
  for (const token of tokens) {
    const parte = parsearParte(token);
    if (!parte) return null;
    partes.push(parte);
  }

  return desdePartes(partes);
}

/** Texto editable del campo, el mismo que se puede tipear. */
export function describirPiezas(valor: Piezas): string {
  switch (valor.modo) {
    case "ninguna":
      return "";
    case "partes":
      return valor.partes.map(textoDeParte).join(", ");
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
    case "partes":
      return valor.partes
        .map((p) => (p.tipo === "pieza" ? p.pieza : `${p.desde}–${p.hasta}`))
        .join(" · ");
    case "arcada":
      return ETIQUETA_ARCADA[valor.arcada];
  }
}

/** Piezas que quedan resaltadas en el odontograma para un valor dado. */
export function piezasSeleccionadas(valor: Piezas): string[] {
  switch (valor.modo) {
    case "ninguna":
      return [];
    case "partes":
      return ordenarPiezas([...new Set(valor.partes.flatMap(piezasDeParte))]);
    case "arcada":
      return valor.arcada === "ambas"
        ? [...secuenciaArcada("sup"), ...secuenciaArcada("inf")]
        : secuenciaArcada(valor.arcada);
  }
}

/** La parte que contiene a esa pieza, si hay alguna. */
export function parteQueContiene(valor: Piezas, pieza: string): Parte | null {
  if (valor.modo !== "partes") return null;
  return valor.partes.find((p) => piezasDeParte(p).includes(pieza)) ?? null;
}

/** Agrega o saca una pieza suelta. Si la pieza estaba dentro de un tramo, saca el tramo. */
export function alternarPieza(valor: Piezas, pieza: string): Piezas {
  const partes = valor.modo === "partes" ? valor.partes : [];
  const contenedora = parteQueContiene(valor, pieza);

  if (contenedora) {
    return desdePartes(partes.filter((p) => p !== contenedora));
  }
  return desdePartes([...partes, { tipo: "pieza", pieza }]);
}

/** Suma un tramo a lo que ya estaba elegido. */
export function agregarTramo(valor: Piezas, desde: string, hasta: string): Piezas | null {
  const tramo = crearTramo(desde, hasta);
  if (!tramo) return null;
  const partes = valor.modo === "partes" ? valor.partes : [];
  return desdePartes([...partes, tramo]);
}
