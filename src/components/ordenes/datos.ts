import { getSupabase, rpcNueva } from "@/lib/supabase";
import { centavosDesdeNumeric, numericParaPostgres, type Centavos } from "@/lib/money";

export type ItemNuevo = {
  trabajo_id: number;
  cantidad: number;
  piezas: string | null;
  ajuste: AjusteItem | null;
};

/**
 * Modificación del precio de un trabajo, sobre su subtotal de catálogo (precio × cantidad).
 * El servidor la resuelve en pesos; el motivo es opcional.
 *
 *   precio      → el importe final que se cobra por el trabajo
 *   porcentaje  → se suma (positivo) o se resta (negativo) ese porcentaje
 *   monto       → se suma (positivo) o se resta (negativo) ese monto
 */
export type AjusteItem =
  | { tipo: "precio"; importe: Centavos; motivo: string }
  | { tipo: "porcentaje"; porcentaje: number; motivo: string }
  | { tipo: "monto"; monto: Centavos; motivo: string };

function aItemsJson(items: ItemNuevo[]) {
  return items.map((i) => ({
    trabajo_id: i.trabajo_id,
    cantidad: i.cantidad,
    piezas: i.piezas,
    ...(i.ajuste === null
      ? {}
      : {
          ajuste_tipo: i.ajuste.tipo,
          // El monto viaja como texto: nunca pasa por un float.
          ajuste_valor:
            i.ajuste.tipo === "precio"
              ? numericParaPostgres(i.ajuste.importe)
              : i.ajuste.tipo === "monto"
                ? numericParaPostgres(i.ajuste.monto)
                : String(i.ajuste.porcentaje),
          ajuste_motivo: i.ajuste.motivo.trim() === "" ? null : i.ajuste.motivo.trim(),
        }),
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
 * Un solo viaje al servidor. La función asigna el número correlativo y congela los
 * precios del catálogo, con la modificación de precio de cada trabajo si la hay.
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
