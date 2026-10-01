import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

// Los montos se formatean con formatARS de ./money.

/**
 * Acepta Date o el texto ISO que devuelve Supabase. Las fechas sin hora
 * ("2026-09-18") se leen con parseISO para que queden en hora local:
 * con new Date() quedarían en UTC y en Argentina mostrarían el día anterior.
 */
export type FechaEntrada = Date | string;

function aFecha(d: FechaEntrada): Date {
  return typeof d === "string" ? parseISO(d) : d;
}

/** "18/09/26" — tablas */
export function formatFechaCorta(d: FechaEntrada): string {
  return format(aFecha(d), "dd/MM/yy", { locale: es });
}

/** "18/09/2026" — documentos */
export function formatFechaLarga(d: FechaEntrada): string {
  return format(aFecha(d), "dd/MM/yyyy", { locale: es });
}

/** "11:42" — 24 h */
export function formatHora(d: FechaEntrada): string {
  return format(aFecha(d), "HH:mm", { locale: es });
}

function correlativo(n: number): string {
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new Error(`Número correlativo inválido: ${n}`);
  }
  return String(n).padStart(6, "0");
}

/** 4821 → "004821" */
export function formatOT(n: number): string {
  return correlativo(n);
}

/** 12940 → "012940" */
export function formatRemito(n: number): string {
  return correlativo(n);
}

// formatPieza vive en ./fdi, al lado de la serialización de las piezas.
export { formatPieza } from "./fdi";
