import { FILAS_POR_PAGINA } from "@/components/listado/pagina-listado";
import { centavosDesdeNumeric, numericParaPostgres, type Centavos } from "@/lib/money";
import { getSupabase, rpcNueva } from "@/lib/supabase";
import type { Orden, Remito } from "@/lib/tipos";

/** Los datos del doctor que salen impresos en el remito, para la entrega. */
export type DoctorDelRemito = {
  nombre: string;
  ficha: number;
  domicilio: string | null;
  piso: string | null;
  departamento: string | null;
  localidad: string | null;
};

export type RemitoConDoctor = Remito & {
  doctor: DoctorDelRemito | null;
  lineas: number;
  /** Descuento (negativo) o recargo (positivo) aplicado al emitir. */
  ajuste: Centavos;
  ajuste_motivo: string | null;
};

export type LineaRemito = {
  id: number;
  importe: Centavos;
  /** El importe de la línea ya incluye el ajuste de la orden; se muestra desglosado. */
  orden:
    | (Pick<Orden, "id" | "numero" | "paciente" | "fecha"> & {
        ajuste: Centavos;
        ajuste_pct: number | null;
        ajuste_motivo: string | null;
      })
    | null;
};

export type FiltrosRemitos = { doctorId: string; desde: string; hasta: string; pagina: number };

export async function listarRemitos(
  f: FiltrosRemitos,
): Promise<{ filas: RemitoConDoctor[]; total: number }> {
  let consulta = getSupabase()
    .from("remitos")
    .select(
      "*, doctores(nombre, ficha, domicilio, piso, departamento, localidad), remito_lineas(count)",
      { count: "exact" },
    )
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
      doctores: DoctorDelRemito | null;
      remito_lineas: { count: number }[];
    };
    return {
      ...(resto as unknown as Remito),
      total: centavosDesdeNumeric(fila.total as number),
      ajuste: centavosDesdeNumeric(((fila as Record<string, unknown>).ajuste as number) ?? 0),
      ajuste_motivo: ((fila as Record<string, unknown>).ajuste_motivo as string) ?? null,
      doctor: doctores,
      lineas: remito_lineas?.[0]?.count ?? 0,
    };
  });

  return { filas, total: count ?? 0 };
}

export async function buscarRemitoPorNumero(numero: number): Promise<RemitoConDoctor | null> {
  const { data, error } = await getSupabase()
    .from("remitos")
    .select("*, doctores(nombre, ficha, domicilio, piso, departamento, localidad), remito_lineas(count)")
    .eq("numero", numero)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { doctores, remito_lineas, ...resto } = data as Record<string, unknown> & {
    total: number;
    doctores: DoctorDelRemito | null;
    remito_lineas: { count: number }[];
  };
  return {
    ...(resto as unknown as Remito),
    total: centavosDesdeNumeric(data.total as number),
    ajuste: centavosDesdeNumeric(((data as Record<string, unknown>).ajuste as number) ?? 0),
    ajuste_motivo: ((data as Record<string, unknown>).ajuste_motivo as string) ?? null,
    doctor: doctores,
    lineas: remito_lineas?.[0]?.count ?? 0,
  };
}

/** La orden de una línea, con el ajuste ya pasado a centavos. */
function aOrdenDeLinea(cruda: unknown): LineaRemito["orden"] {
  if (!cruda) return null;
  const fila = cruda as Record<string, unknown>;
  return {
    id: fila.id as number,
    numero: fila.numero as number,
    paciente: fila.paciente as string,
    fecha: fila.fecha as string,
    ajuste: centavosDesdeNumeric((fila.ajuste as number) ?? 0),
    ajuste_pct: (fila.ajuste_pct as number) ?? null,
    ajuste_motivo: (fila.ajuste_motivo as string) ?? null,
  };
}

export async function listarLineasDeRemito(remitoId: number): Promise<LineaRemito[]> {
  const { data, error } = await getSupabase()
    .from("remito_lineas")
    .select(
      "id, importe, ordenes(id, numero, paciente, fecha, ajuste, ajuste_pct, ajuste_motivo)",
    )
    .eq("remito_id", remitoId);
  if (error) throw error;

  return (data ?? [])
    .map((fila) => ({
      id: fila.id as number,
      importe: centavosDesdeNumeric(fila.importe as number),
      orden: aOrdenDeLinea((fila as Record<string, unknown>).ordenes),
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
  ajuste: Centavos = 0,
  ajusteMotivo = "",
): Promise<{ id: number; numero: number; total: Centavos; imputado: Centavos }> {
  const r = await rpcNueva<{ id: number; numero: number; total: number; imputado: number }>(
    "emitir_remito",
    {
      p_doctor_id: doctorId,
      p_orden_ids: ordenIds,
      p_fecha: fecha,
      p_ajuste: numericParaPostgres(ajuste),
      ...(ajusteMotivo.trim() !== "" ? { p_ajuste_motivo: ajusteMotivo.trim() } : {}),
    },
  );

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
