import { FILAS_POR_PAGINA } from "@/components/listado/pagina-listado";
import { centavosDesdeNumeric } from "@/lib/money";
import { getSupabase } from "@/lib/supabase";
import { limpiarParaBusqueda } from "@/lib/texto";
import type { EstadoOrden, Orden, OrdenItem } from "@/lib/tipos";

export type OrdenConDoctor = Orden & {
  doctor: { nombre: string; ficha: number } | null;
  obra_social: { nombre: string } | null;
};

export type ItemDeOrden = OrdenItem & { trabajo: { codigo: string; titulo: string } | null };

export type FiltrosOrdenes = {
  texto: string;
  doctorId: string;
  estado: EstadoOrden | "todos" | "en_curso";
  desde: string;
  hasta: string;
  pagina: number;
};

const SELECCION = "*, doctores(nombre, ficha), obras_sociales(nombre)";

type FilaCruda = Record<string, unknown> & {
  total: number;
  doctores: { nombre: string; ficha: number } | null;
  obras_sociales: { nombre: string } | null;
};

function aOrden(fila: FilaCruda): OrdenConDoctor {
  const { doctores, obras_sociales, ...resto } = fila;
  return {
    ...(resto as unknown as Orden),
    total: centavosDesdeNumeric(fila.total),
    ajuste: centavosDesdeNumeric((fila.ajuste as number) ?? 0),
    doctor: doctores,
    obra_social: obras_sociales,
  };
}

export async function listarOrdenes(
  f: FiltrosOrdenes,
): Promise<{ filas: OrdenConDoctor[]; total: number }> {
  let consulta = getSupabase()
    .from("ordenes")
    .select(SELECCION, { count: "exact" })
    .order("numero", { ascending: false });

  if (f.estado === "en_curso") consulta = consulta.in("estado", ["ingresada", "en_proceso", "terminada"]);
  else if (f.estado !== "todos") consulta = consulta.eq("estado", f.estado);

  if (f.doctorId) consulta = consulta.eq("doctor_id", Number(f.doctorId));
  if (f.desde) consulta = consulta.gte("fecha", f.desde);
  if (f.hasta) consulta = consulta.lte("fecha", f.hasta);

  const texto = limpiarParaBusqueda(f.texto);
  if (texto) {
    const numero = Number(texto);
    consulta = Number.isInteger(numero)
      ? consulta.or(`paciente.ilike.%${texto}%,numero.eq.${numero}`)
      : consulta.ilike("paciente", `%${texto}%`);
  }

  const desde = f.pagina * FILAS_POR_PAGINA;
  const { data, error, count } = await consulta.range(desde, desde + FILAS_POR_PAGINA - 1);
  if (error) throw error;

  return { filas: (data ?? []).map((d) => aOrden(d as FilaCruda)), total: count ?? 0 };
}

export async function listarItemsDeOrden(ordenId: number): Promise<ItemDeOrden[]> {
  const { data, error } = await getSupabase()
    .from("orden_items")
    .select("*, trabajos(codigo, titulo)")
    .eq("orden_id", ordenId)
    .order("posicion");
  if (error) throw error;

  return (data ?? []).map((fila) => {
    const { trabajos, ...resto } = fila as Record<string, unknown> & {
      precio_unitario: number;
      subtotal: number;
      trabajos: { codigo: string; titulo: string } | null;
    };
    return {
      ...(resto as unknown as OrdenItem),
      precio_unitario: centavosDesdeNumeric(fila.precio_unitario as number),
      subtotal: centavosDesdeNumeric(fila.subtotal as number),
      trabajo: trabajos,
    };
  });
}

export async function cambiarEstadoOrden(id: number, estado: EstadoOrden): Promise<void> {
  const { error } = await getSupabase().from("ordenes").update({ estado }).eq("id", id);
  if (error) throw error;
}

/** Para la comanda (E7) y el escaneo (E8): busca por número de OT. */
export async function buscarOrdenPorNumero(numero: number): Promise<OrdenConDoctor | null> {
  const { data, error } = await getSupabase()
    .from("ordenes")
    .select(SELECCION)
    .eq("numero", numero)
    .maybeSingle();
  if (error) throw error;
  return data ? aOrden(data as FilaCruda) : null;
}

/** La orden está atrasada si pasó la fecha comprometida y todavía no se entregó. */
export function estaAtrasada(orden: Orden): boolean {
  if (!orden.entrega_at) return false;
  if (orden.estado === "entregada" || orden.estado === "anulada") return false;
  return new Date(orden.entrega_at).getTime() < Date.now();
}
