/** Normaliza para buscar: sin acentos, en minúsculas. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Escapa lo que rompe el filtro `or` de PostgREST (comas, paréntesis, comodines). */
export function limpiarParaBusqueda(texto: string): string {
  return texto.replace(/[,()*%\\]/g, " ").trim();
}

const CON_ACENTO: Record<string, string> = {
  a: "[aáàä]",
  e: "[eéèë]",
  i: "[iíìï]",
  o: "[oóòö]",
  u: "[uúùü]",
  n: "[nñ]",
};

/**
 * Expresión regular para buscar en la base con `imatch` sin que importen los acentos:
 * "protesis" encuentra "Prótesis". Lo que no es letra, número, espacio o guion se
 * busca como "cualquier carácter", así no hay nada que escapar.
 */
export function patronSinAcentos(texto: string): string {
  return [...normalizar(texto)]
    .map((c) => CON_ACENTO[c] ?? (/[a-z0-9 -]/.test(c) ? c : "."))
    .join("");
}
