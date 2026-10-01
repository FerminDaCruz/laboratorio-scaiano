import { getSupabase } from "@/lib/supabase";
import { centavosDesdeNumeric, type Centavos } from "@/lib/money";

export type ItemNuevo = {
  trabajo_id: number;
  cantidad: number;
  piezas: string | null;
};

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
 * los precios leyendo el catálogo: el cliente nunca manda el precio.
 */
export async function crearOrden(orden: OrdenNueva): Promise<OrdenCreada> {
  const { data, error } = await getSupabase().rpc("crear_orden", {
    p_doctor_id: orden.doctor_id,
    p_paciente: orden.paciente,
    p_items: orden.items,
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

/** Junta la fecha y la hora de entrega en un instante, u omite la hora. */
export function armarEntrega(fecha: string, hora: string): string | null {
  if (!fecha) return null;
  const instante = new Date(`${fecha}T${hora || "00:00"}`);
  return Number.isNaN(instante.getTime()) ? null : instante.toISOString();
}
