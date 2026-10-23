import { getSupabase, rpcNueva } from "@/lib/supabase";
import { centavosDesdeNumeric, numericParaPostgres, type Centavos } from "@/lib/money";

export type ItemNuevo = {
  trabajo_id: number;
  cantidad: number;
  piezas: string | null;
};

/**
 * Descuento o plus de la orden. El precio de cada trabajo sale del catálogo y no se
 * toca: lo acordado va acá, sobre el total. El signo lo dice el valor: negativo
 * descuenta, positivo suma.
 */
export type AjusteOrden =
  | { tipo: "porcentaje"; porcentaje: number; motivo: string }
  | { tipo: "monto"; monto: Centavos; motivo: string };

function aItemsJson(items: ItemNuevo[]) {
  return items.map((i) => ({
    trabajo_id: i.trabajo_id,
    cantidad: i.cantidad,
    piezas: i.piezas,
  }));
}

function argumentosDeAjuste(ajuste: AjusteOrden | null) {
  if (ajuste === null) return {};
  return {
    p_ajuste_tipo: ajuste.tipo,
    p_ajuste_valor:
      ajuste.tipo === "monto" ? numericParaPostgres(ajuste.monto) : ajuste.porcentaje,
    p_ajuste_motivo: ajuste.motivo,
  };
}

export type OrdenNueva = {
  doctor_id: number;
  paciente: string;
  items: ItemNuevo[];
  sexo: string | null;
  edad: number | null;
  obra_social_id: number | null;
  color: string | null;
  indicaciones: string | null;
  fecha: string;
  entrega_at: string | null;
  ajuste: AjusteOrden | null;
};

export type OrdenCreada = { id: number; numero: number; total: Centavos };

/**
 * Un solo viaje al servidor. La función asigna el número correlativo y congela los
 * precios del catálogo, más el descuento o el plus que se haya acordado.
 */
export async function crearOrden(orden: OrdenNueva): Promise<OrdenCreada> {
  const data = await rpcNueva<{ id: number; numero: number; total: number }>("crear_orden", {
    p_doctor_id: orden.doctor_id,
    p_paciente: orden.paciente,
    p_items: aItemsJson(orden.items),
    ...(orden.sexo ? { p_sexo: orden.sexo } : {}),
    ...(orden.edad !== null ? { p_edad: orden.edad } : {}),
    ...(orden.obra_social_id !== null ? { p_obra_social_id: orden.obra_social_id } : {}),
    ...(orden.color ? { p_color: orden.color } : {}),
    ...(orden.indicaciones ? { p_indicaciones: orden.indicaciones } : {}),
    p_fecha: orden.fecha,
    ...(orden.entrega_at ? { p_entrega_at: orden.entrega_at } : {}),
    ...argumentosDeAjuste(orden.ajuste),
  });

  return {
    id: data.id,
    numero: data.numero,
    total: centavosDesdeNumeric(data.total),
  };
}

/** Cambia los trabajos y los datos de una orden que todavía no se facturó. */
export async function editarOrden(
  ordenId: number,
  orden: Omit<OrdenNueva, "doctor_id" | "fecha">,
): Promise<OrdenCreada> {
  const data = await rpcNueva<{ id: number; numero: number; total: number }>("editar_orden", {
    p_orden_id: ordenId,
    p_paciente: orden.paciente,
    p_items: aItemsJson(orden.items),
    ...(orden.sexo ? { p_sexo: orden.sexo } : {}),
    ...(orden.edad !== null ? { p_edad: orden.edad } : {}),
    ...(orden.obra_social_id !== null ? { p_obra_social_id: orden.obra_social_id } : {}),
    ...(orden.color ? { p_color: orden.color } : {}),
    ...(orden.indicaciones ? { p_indicaciones: orden.indicaciones } : {}),
    ...(orden.entrega_at ? { p_entrega_at: orden.entrega_at } : {}),
    ...argumentosDeAjuste(orden.ajuste),
  });

  return {
    id: data.id,
    numero: data.numero,
    total: centavosDesdeNumeric(data.total),
  };
}

/** Anula una orden sin facturar. Solo un administrador. */
export async function anularOrden(ordenId: number, motivo: string): Promise<void> {
  await rpcNueva("anular_orden", { p_orden_id: ordenId, p_motivo: motivo });
}

/** Junta la fecha y la hora de entrega en un instante, u omite la hora. */
export function armarEntrega(fecha: string, hora: string): string | null {
  if (!fecha) return null;
  const instante = new Date(`${fecha}T${hora || "00:00"}`);
  return Number.isNaN(instante.getTime()) ? null : instante.toISOString();
}
