// Parámetros de impresión en un solo lugar.
// La impresora del laboratorio es una 3nStar RPT005: papel de 80 mm, ESC/POS y USB.
// Si alguna vez se cambia por una de 58 mm, se cambia acá y en ningún otro lado.

export const ANCHO_TICKET_MM = 80;

/** Prefijo del código de barras de una comanda: lo lee el escaneo de E8. */
export const PREFIJO_OT = "OT-";

export function codigoDeBarrasDeOT(numeroFormateado: string): string {
  return `${PREFIJO_OT}${numeroFormateado}`;
}
