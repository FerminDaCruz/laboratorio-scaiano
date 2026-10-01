// Parámetros de impresión en un solo lugar.
// TODO(E13): la impresora térmica todavía no está comprada. Cuando se sepa el
// modelo hay que confirmar el ancho real del papel (58 u 80 mm) acá, y nada más.

export const ANCHO_TICKET_MM = 80;

/** Prefijo del código de barras de una comanda: lo lee el escaneo de E8. */
export const PREFIJO_OT = "OT-";

export function codigoDeBarrasDeOT(numeroFormateado: string): string {
  return `${PREFIJO_OT}${numeroFormateado}`;
}
