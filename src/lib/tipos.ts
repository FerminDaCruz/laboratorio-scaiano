// Tipos de dominio, escritos a mano mientras no exista database.types.ts.
// TODO(E1): cuando se generen los tipos con `supabase gen types typescript`,
// esto se reemplaza por los tipos generados.

import type { Centavos } from "./money";

export type EstadoOrden = "ingresada" | "en_proceso" | "terminada" | "entregada" | "anulada";

export const ESTADOS_ORDEN: EstadoOrden[] = [
  "ingresada",
  "en_proceso",
  "terminada",
  "entregada",
  "anulada",
];

export const ETIQUETA_ESTADO: Record<EstadoOrden, string> = {
  ingresada: "Ingresada",
  en_proceso: "En proceso",
  terminada: "Terminada",
  entregada: "Entregada",
  anulada: "Anulada",
};

// Colores de §4 del design system. El color significa estado, no decoración.
export const VARIANTE_ESTADO: Record<EstadoOrden, "neutral" | "ok" | "warn" | "danger" | "info"> = {
  ingresada: "neutral",
  en_proceso: "warn",
  terminada: "info",
  entregada: "ok",
  anulada: "danger",
};

export type Sexo = "F" | "M" | "X";

export const ETIQUETA_SEXO: Record<Sexo, string> = {
  F: "Femenino",
  M: "Masculino",
  X: "Sin especificar",
};

export type MedioPago = "efectivo" | "transferencia" | "cheque" | "otro";

export const MEDIOS_PAGO: MedioPago[] = ["efectivo", "transferencia", "cheque", "otro"];

export const ETIQUETA_MEDIO: Record<MedioPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  cheque: "Cheque",
  otro: "Otro",
};

export type TipoMovimiento = "remito" | "pago" | "nota_credito" | "ajuste";

export const ETIQUETA_TIPO_MOVIMIENTO: Record<TipoMovimiento, string> = {
  remito: "Remito",
  pago: "Pago",
  nota_credito: "Nota de crédito",
  ajuste: "Ajuste",
};

export type ObraSocial = {
  id: number;
  codigo: string;
  nombre: string;
  activa: boolean;
};

export type Doctor = {
  id: number;
  ficha: number;
  nombre: string;
  domicilio: string | null;
  piso: string | null;
  departamento: string | null;
  localidad: string | null;
  telefono: string | null;
  obra_social_id: number | null;
  fecha_alta: string;
  activo: boolean;
  notas: string | null;
};

export type Trabajo = {
  id: number;
  codigo: string;
  titulo: string;
  descripcion: string | null;
  activo: boolean;
};

/** Trabajo con su precio vigente ya convertido a centavos. */
export type TrabajoConPrecio = Trabajo & { precio: Centavos | null };

export type PrecioTrabajo = {
  id: number;
  trabajo_id: number;
  precio: Centavos;
  vigente_desde: string;
  creado_en: string;
};

export type OrdenItem = {
  id: number;
  orden_id: number;
  trabajo_id: number;
  cantidad: number;
  piezas: string | null;
  precio_unitario: Centavos;
  subtotal: Centavos;
  posicion: number;
};

export type Orden = {
  id: number;
  numero: number;
  doctor_id: number;
  paciente: string;
  sexo: Sexo | null;
  edad: number | null;
  obra_social_id: number | null;
  color: string | null;
  indicaciones: string | null;
  fecha: string;
  entrega_at: string | null;
  estado: EstadoOrden;
  remito_id: number | null;
  total: Centavos;
  /** Descuento (negativo) o plus (positivo) de la orden. El total ya lo incluye. */
  ajuste: Centavos;
  /** El porcentaje acordado, si se pactó así. Null si fue un monto fijo. */
  ajuste_pct: number | null;
  ajuste_motivo: string | null;
  motivo_anulacion: string | null;
};

export type Remito = {
  id: number;
  numero: number;
  doctor_id: number;
  fecha: string;
  total: Centavos;
  anulado_en: string | null;
};

export type MovimientoCC = {
  id: number;
  doctor_id: number;
  fecha: string;
  tipo: TipoMovimiento;
  importe: Centavos; // > 0 debe (deuda) · < 0 haber (pago o crédito)
  remito_id: number | null;
  medio: MedioPago | null;
  referencia: string | null;
  anula_movimiento_id: number | null;
};

/** Colores Vita Classic, más el campo libre que se usa al cargar la orden. */
export const COLORES_VITA = [
  "A1", "A2", "A3", "A3.5", "A4",
  "B1", "B2", "B3", "B4",
  "C1", "C2", "C3", "C4",
  "D2", "D3", "D4",
];
