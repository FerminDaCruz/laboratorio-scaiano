// Parámetros de impresión en un solo lugar.
// La impresora del laboratorio es una 3nStar RPT005: papel de 80 mm, ESC/POS y USB.
// Si alguna vez se cambia por una de 58 mm, se cambia acá y en ningún otro lado.

export const ANCHO_TICKET_MM = 80;

/** Membrete de los documentos (remito y liquidación). */
export const LOGO_LABORATORIO = "/logo-scaiano.png";
export const TELEFONO_LABORATORIO = "+54 9 2944535258";
export const MAIL_LABORATORIO = "laboratorioscaianodigital@gmail.com";

/**
 * Contenido del código de barras de una comanda: solo el número de orden
 * ("0000002"), sin prefijo. La lectora se comporta como un teclado y con la
 * distribución en español un "-" llega como "'", así que cualquier prefijo
 * rompe la búsqueda por número.
 */
export function codigoDeBarrasDeOT(numeroFormateado: string): string {
  return numeroFormateado;
}
