import { FILAS_POR_PAGINA } from "@/components/listado/pagina-listado";
import { centavosDesdeNumeric, type Centavos } from "@/lib/money";
import { getSupabase } from "@/lib/supabase";
import type { Orden, Remito } from "@/lib/tipos";

export type RemitoConDoctor = Remito & {
  doctor: { nombre: string; ficha: number } | null;
  lineas: number;
};

export type LineaRemito = {
  id: number;
  importe: Centavos;
  orden: Pick<Orden, "id" | "numero" | "paciente" | "fecha"> | null;
};

export type FiltrosRemitos = { doctorId: string; desde: string; hasta: string; pagina: number };

export async function listarRemitos(
  f: FiltrosRemitos,
): Promise<{ filas: RemitoConDoctor[]; total: number }> {
  let consulta = getSupabase()
    .from("remitos")
    .select("*, doctores(nombre, ficha), remito_lineas(count)", { count: "exact" })
    .order("numero", { ascending: false });

  if (f.doctorId) consulta = consulta.eq("doctor_id", Number(f.doctorId));
  if (f.desde) consulta = consulta.gte("fecha", f.desde);
  if (f.hasta) consulta = consulta.lte("fecha", f.hasta);

  const desde = f.pagina * FILAS_POR_PAGINA;
  const { data, error, count } = await consulta.range(desde, desde + FILAS_POR_PAGINA - 1);
  if (error) throw error;

  const filas = (data ?? []).map((fila) => {
    const { doctores, remito_lineas, ...resto } = fila as Record<string, unknown> & {
      total: number;
      doctores: { nombre: string; ficha: number } | null;
      remito_lineas: { count: number }[];
    };
    return {
      ...(resto as unknown as Remito),
      total: centavosDesdeNumeric(fila.total as number),
      doctor: doctores,
      lineas: remito_lineas?.[0]?.count ?? 0,
    };
  });

  return { filas, total: count ?? 0 };
}

export async function buscarRemitoPorNumero(numero: number): Promise<RemitoConDoctor | null> {
  const { data, error } = await getSupabase()
    .from("remitos")
    .select("*, doctores(nombre, ficha), remito_lineas(count)")
    .eq("numero", numero)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { doctores, remito_lineas, ...resto } = data as Record<string, unknown> & {
    total: number;
    doctores: { nombre: string; ficha: number } | null;
    remito_lineas: { count: number }[];
  };
  return {
    ...(resto as unknown as Remito),
    total: centavosDesdeNumeric(data.total as number),
    doctor: doctores,
    lineas: remito_lineas?.[0]?.count ?? 0,
  };
}

export async function listarLineasDeRemito(remitoId: number): Promise<LineaRemito[]> {
  const { data, error } = await getSupabase()
    .from("remito_lineas")
    .select("id, importe, ordenes(id, numero, paciente, fecha)")
    .eq("remito_id", remitoId);
  if (error) throw error;

  return (data ?? [])
    .map((fila) => ({
      id: fila.id as number,
      importe: centavosDesdeNumeric(fila.importe as number),
      orden: (fila as { ordenes: LineaRemito["orden"] }).ordenes,
    }))
    .sort((a, b) => (a.orden?.numero ?? 0) - (b.orden?.numero ?? 0));
}

/** Órdenes terminadas o en curso de un doctor que todavía no entraron en un remito. */
export async function ordenesSinRemitir(doctorId: number) {
  const { data, error } = await getSupabase()
    .from("ordenes")
    .select("id, numero, paciente, fecha, total, estado")
    .eq("doctor_id", doctorId)
    .is("remito_id", null)
    .not("estado", "in", "(entregada,anulada)")
    .order("numero");
  if (error) throw error;
  return (data ?? []).map((o) => ({ ...o, total: centavosDesdeNumeric(o.total as number) }));
}

export async function emitirRemito(
  doctorId: number,
  ordenIds: number[],
  fecha: string,
): Promise<{ id: number; numero: number; total: Centavos; imputado: Centavos }> {
  const { data, error } = await getSupabase().rpc("emitir_remito", {
    p_doctor_id: doctorId,
    p_orden_ids: ordenIds,
    p_fecha: fecha,
  });
  if (error) throw error;

  const r = data as unknown as { id: number; numero: number; total: number; imputado: number };
  return {
    id: r.id,
    numero: r.numero,
    total: centavosDesdeNumeric(r.total),
    imputado: centavosDesdeNumeric(r.imputado ?? 0),
  };
}

export async function anularRemito(remitoId: number, motivo: string): Promise<void> {
  const { error } = await getSupabase().rpc("anular_remito", {
    p_remito_id: remitoId,
    p_motivo: motivo,
  });
  if (error) throw error;
}

export type ResumenCuenta = {
  saldoAnterior: Centavos;
  facturadoMes: Centavos;
  pagosMes: Centavos;
  saldoCuenta: Centavos;
  esteTicket: Centavos;
  saldoTotal: Centavos;
};

/**
 * Bloque de cuenta corriente que lleva el remito. "Saldo anterior" es el cierre
 * del mes pasado; "este ticket" es el remito que se está imprimiendo.
 */
export async function resumenDeCuenta(
  doctorId: number,
  fechaRemito: string,
  totalRemito: Centavos,
  remitoId: number,
): Promise<ResumenCuenta> {
  const { data, error } = await getSupabase()
    .from("movimientos_cc")
    .select("fecha, importe, remito_id, tipo")
    .eq("doctor_id", doctorId)
    .order("fecha");
  if (error) throw error;

  const inicioDeMes = `${fechaRemito.slice(0, 7)}-01`;
  let saldoAnterior = 0;
  let facturadoMes = 0;
  let pagosMes = 0;

  for (const m of data ?? []) {
    const importe = centavosDesdeNumeric(m.importe as number);
    const esEsteRemito = m.remito_id === remitoId && m.tipo === "remito";
    if (esEsteRemito) continue;

    if ((m.fecha as string) < inicioDeMes) {
      saldoAnterior += importe;
      continue;
    }
    if (importe > 0) facturadoMes += importe;
    else pagosMes += -importe;
  }

  const saldoCuenta = saldoAnterior + facturadoMes - pagosMes;
  return {
    saldoAnterior,
    facturadoMes,
    pagosMes,
    saldoCuenta,
    esteTicket: totalRemito,
    saldoTotal: saldoCuenta + totalRemito,
  };
}
