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
