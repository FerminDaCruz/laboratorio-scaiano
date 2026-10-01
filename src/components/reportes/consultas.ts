import { rangoDelMes } from "@/components/liquidaciones/consultas";
import { centavosDesdeNumeric, type Centavos } from "@/lib/money";
import { getSupabase } from "@/lib/supabase";
import type { EstadoOrden } from "@/lib/tipos";

export type ResumenTablero = {
  facturadoMes: Centavos;
  facturadoMesAnterior: Centavos;
  deudaTotal: Centavos;
  doctoresConDeuda: number;
  ordenesPorEstado: Record<EstadoOrden, number>;
  ordenesAtrasadas: number;
  deudores: { doctor: string; ficha: number; doctorId: number; saldo: Centavos }[];
};

function mesAnterior(anio: number, mes: number): { anio: number; mes: number } {
  return mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 };
}

async function facturadoDe(anio: number, mes: number): Promise<Centavos> {
  const { desde, hasta } = rangoDelMes(anio, mes);
  const { data, error } = await getSupabase()
    .from("movimientos_cc")
    .select("importe")
    .eq("tipo", "remito")
    .gte("fecha", desde)
    .lt("fecha", hasta);
  if (error) throw error;
  return (data ?? []).reduce((suma, m) => suma + centavosDesdeNumeric(m.importe as number), 0);
}

export async function resumenTablero(anio: number, mes: number): Promise<ResumenTablero> {
  const supabase = getSupabase();
  const anterior = mesAnterior(anio, mes);

  const [facturadoMes, facturadoMesAnterior, saldos, doctores, ordenes] = await Promise.all([
    facturadoDe(anio, mes),
    facturadoDe(anterior.anio, anterior.mes),
    supabase.from("v_saldos_doctor").select("*"),
    supabase.from("doctores").select("id, nombre, ficha"),
    supabase.from("ordenes").select("estado, entrega_at"),
  ]);
  if (saldos.error) throw saldos.error;
  if (doctores.error) throw doctores.error;
  if (ordenes.error) throw ordenes.error;

  const nombres = new Map(
    (doctores.data ?? []).map((d) => [d.id as number, { nombre: d.nombre as string, ficha: d.ficha as number }]),
  );

  const deudores = (saldos.data ?? [])
    .map((s) => ({
      doctorId: s.doctor_id as number,
      saldo: centavosDesdeNumeric((s.saldo as number) ?? 0),
    }))
    .filter((s) => s.saldo > 0)
    .map((s) => ({
      ...s,
      doctor: nombres.get(s.doctorId)?.nombre ?? "—",
      ficha: nombres.get(s.doctorId)?.ficha ?? 0,
    }))
    .sort((a, b) => b.saldo - a.saldo);

  const ordenesPorEstado: Record<EstadoOrden, number> = {
    ingresada: 0,
    en_proceso: 0,
    terminada: 0,
    entregada: 0,
    anulada: 0,
  };
  let ordenesAtrasadas = 0;
  const ahora = Date.now();

  for (const o of ordenes.data ?? []) {
    const estado = o.estado as EstadoOrden;
    ordenesPorEstado[estado] = (ordenesPorEstado[estado] ?? 0) + 1;
    if (
      o.entrega_at &&
      new Date(o.entrega_at as string).getTime() < ahora &&
      estado !== "entregada" &&
      estado !== "anulada"
    ) {
      ordenesAtrasadas += 1;
    }
  }

  return {
    facturadoMes,
    facturadoMesAnterior,
    deudaTotal: deudores.reduce((suma, d) => suma + d.saldo, 0),
    doctoresConDeuda: deudores.length,
    ordenesPorEstado,
    ordenesAtrasadas,
    deudores: deudores.slice(0, 10),
  };
}

export type FilaObraSocial = { obraSocial: string; ordenes: number; total: Centavos };
export type FilaTrabajo = { codigo: string; titulo: string; cantidad: number; total: Centavos };

export type ReportesDelMes = {
  porObraSocial: FilaObraSocial[];
  masVendidos: FilaTrabajo[];
  totalOrdenes: number;
  totalMes: Centavos;
};

export async function reportesDelMes(anio: number, mes: number): Promise<ReportesDelMes> {
  const supabase = getSupabase();
  const { desde, hasta } = rangoDelMes(anio, mes);

  const { data, error } = await supabase
    .from("ordenes")
    .select(
      "id, total, obras_sociales(nombre), orden_items(cantidad, subtotal, trabajos(codigo, titulo))",
    )
    .gte("fecha", desde)
    .lt("fecha", hasta)
    .neq("estado", "anulada");
  if (error) throw error;

  type OrdenCruda = {
    total: number;
    obras_sociales: { nombre: string } | null;
    orden_items: { cantidad: number; subtotal: number; trabajos: { codigo: string; titulo: string } | null }[];
  };

  const porObra = new Map<string, FilaObraSocial>();
  const porTrabajo = new Map<string, FilaTrabajo>();
  let totalMes = 0;

  for (const orden of (data ?? []) as unknown as OrdenCruda[]) {
    const total = centavosDesdeNumeric(orden.total);
    totalMes += total;

    const obra = orden.obras_sociales?.nombre ?? "Sin obra social";
    const acumulado = porObra.get(obra) ?? { obraSocial: obra, ordenes: 0, total: 0 };
    porObra.set(obra, { ...acumulado, ordenes: acumulado.ordenes + 1, total: acumulado.total + total });

    for (const item of orden.orden_items ?? []) {
      const codigo = item.trabajos?.codigo ?? "—";
      const previo = porTrabajo.get(codigo) ?? {
        codigo,
        titulo: item.trabajos?.titulo ?? "—",
        cantidad: 0,
        total: 0,
      };
      porTrabajo.set(codigo, {
        ...previo,
        cantidad: previo.cantidad + item.cantidad,
        total: previo.total + centavosDesdeNumeric(item.subtotal),
      });
    }
  }

  return {
    porObraSocial: [...porObra.values()].sort((a, b) => b.total - a.total),
    masVendidos: [...porTrabajo.values()].sort((a, b) => b.cantidad - a.cantidad),
    totalOrdenes: (data ?? []).length,
    totalMes,
  };
}
