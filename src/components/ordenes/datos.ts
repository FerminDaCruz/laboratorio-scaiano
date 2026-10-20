import { getSupabase, rpcNueva } from "@/lib/supabase";
import { centavosDesdeNumeric, numericParaPostgres, type Centavos } from "@/lib/money";

export type ItemNuevo = {
  trabajo_id: number;
  cantidad: number;
  piezas: string | null;
  /** Precio acordado para este trabajo. Si es null, se usa el del catálogo. */
  precio: Centavos | null;
};

function aItemsJson(items: ItemNuevo[]) {
  return items.map((i) => ({
    trabajo_id: i.trabajo_id,
    cantidad: i.cantidad,
    piezas: i.piezas,
    ...(i.precio !== null ? { precio: numericParaPostgres(i.precio) } : {}),
  }));
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
};

export type OrdenCreada = { id: number; numero: number; total: Centavos };

/**
 * Un solo viaje al servidor. La función asigna el número correlativo y congela
 * los precios: el del catálogo, o el que se haya acordado para ese trabajo.
 */
export async function crearOrden(orden: OrdenNueva): Promise<OrdenCreada> {
  const { data, error } = await getSupabase().rpc("crear_orden", {
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
  });
  if (error) throw error;

  const resultado = data as unknown as { id: number; numero: number; total: number };
  return {
    id: resultado.id,
    numero: resultado.numero,
    total: centavosDesdeNumeric(resultado.total),
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
