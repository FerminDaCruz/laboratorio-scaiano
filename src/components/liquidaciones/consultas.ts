import { centavosDesdeNumeric, type Centavos } from "@/lib/money";
import { getSupabase } from "@/lib/supabase";
import type { Doctor } from "@/lib/tipos";

export type FilaLiquidacion = {
  id: string;
  fecha: string;
  remitoNumero: number;
  ordenNumero: number;
  articulo: string;
  paciente: string;
  obraSocial: string;
  cantidad: number;
  precio: Centavos;
  total: Centavos;
};

export type Liquidacion = {
  doctor: Doctor;
  filas: FilaLiquidacion[];
  saldoAnterior: Centavos;
  facturado: Centavos;
  pagos: Centavos;
  saldoFinal: Centavos;
};

export type Periodo = {
  id: number;
  anio: number;
  mes: number;
  cerrado_en: string | null;
};

export function rangoDelMes(anio: number, mes: number): { desde: string; hasta: string } {
  const desde = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const siguiente = mes === 12 ? `${anio + 1}-01-01` : `${anio}-${String(mes + 1).padStart(2, "0")}-01`;
  return { desde, hasta: siguiente };
}

export async function listarPeriodos(): Promise<Periodo[]> {
  const { data, error } = await getSupabase()
    .from("periodos")
    .select("id, anio, mes, cerrado_en")
    .order("anio", { ascending: false })
    .order("mes", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Periodo[];
}

export async function cerrarPeriodo(anio: number, mes: number): Promise<{ doctores: number; ordenesAbiertas: number }> {
  const { data, error } = await getSupabase().rpc("cerrar_periodo", { p_anio: anio, p_mes: mes });
  if (error) throw error;
  const r = data as unknown as { doctores: number; ordenes_abiertas: number };
  return { doctores: r.doctores, ordenesAbiertas: r.ordenes_abiertas };
}

type LineaCruda = {
  remito_id: number;
  ordenes: {
    numero: number;
    paciente: string;
    obras_sociales: { nombre: string } | null;
    orden_items: {
      cantidad: number;
      precio_unitario: number;
      subtotal: number;
      trabajos: { titulo: string } | null;
    }[];
  } | null;
};

/**
 * Liquidación del mes por doctor: una fila por trabajo entregado, más el bloque
 * de saldos. Los remitos anulados no entran.
 */
export async function liquidacionesDelMes(
  anio: number,
  mes: number,
  doctorId: number | null,
): Promise<Liquidacion[]> {
  const supabase = getSupabase();
  const { desde, hasta } = rangoDelMes(anio, mes);

  let consultaRemitos = supabase
    .from("remitos")
    .select("id, numero, fecha, doctor_id")
    .gte("fecha", desde)
    .lt("fecha", hasta)
    .is("anulado_en", null)
    .order("fecha");
  if (doctorId) consultaRemitos = consultaRemitos.eq("doctor_id", doctorId);

  const [remitos, doctores] = await Promise.all([
    consultaRemitos,
    supabase.from("doctores").select("*").order("nombre"),
  ]);
  if (remitos.error) throw remitos.error;
  if (doctores.error) throw doctores.error;

  const remitosPorId = new Map(
    (remitos.data ?? []).map((r) => [r.id as number, r as { id: number; numero: number; fecha: string; doctor_id: number }]),
  );
  const doctoresConRemito = new Set((remitos.data ?? []).map((r) => r.doctor_id as number));
  if (remitosPorId.size === 0) return [];

  const { data: lineas, error: errorLineas } = await supabase
    .from("remito_lineas")
    .select(
      "remito_id, ordenes(numero, paciente, obras_sociales(nombre), orden_items(cantidad, precio_unitario, subtotal, trabajos(titulo)))",
    )
    .in("remito_id", [...remitosPorId.keys()]);
  if (errorLineas) throw errorLineas;

  const filasPorDoctor = new Map<number, FilaLiquidacion[]>();
  for (const linea of (lineas ?? []) as unknown as LineaCruda[]) {
    const remito = remitosPorId.get(linea.remito_id);
    if (!remito || !linea.ordenes) continue;

    const items = linea.ordenes.orden_items ?? [];
    const filas = items.map((item, i) => ({
      id: `${linea.remito_id}-${linea.ordenes?.numero}-${i}`,
      fecha: remito.fecha,
      remitoNumero: remito.numero,
      ordenNumero: linea.ordenes?.numero ?? 0,
      articulo: item.trabajos?.titulo ?? "—",
      paciente: linea.ordenes?.paciente ?? "—",
      obraSocial: linea.ordenes?.obras_sociales?.nombre ?? "—",
      cantidad: item.cantidad,
      precio: centavosDesdeNumeric(item.precio_unitario),
      total: centavosDesdeNumeric(item.subtotal),
    }));

    filasPorDoctor.set(remito.doctor_id, [...(filasPorDoctor.get(remito.doctor_id) ?? []), ...filas]);
  }

  // Saldos del mes, por doctor.
  const { data: movimientos, error: errorMovimientos } = await supabase
    .from("movimientos_cc")
    .select("doctor_id, fecha, importe")
    .in("doctor_id", [...doctoresConRemito])
    .lt("fecha", hasta);
  if (errorMovimientos) throw errorMovimientos;

  const saldos = new Map<number, { anterior: Centavos; facturado: Centavos; pagos: Centavos }>();
  for (const m of movimientos ?? []) {
    const doctor = m.doctor_id as number;
    const importe = centavosDesdeNumeric(m.importe as number);
    const acumulado = saldos.get(doctor) ?? { anterior: 0, facturado: 0, pagos: 0 };

    if ((m.fecha as string) < desde) acumulado.anterior += importe;
    else if (importe > 0) acumulado.facturado += importe;
    else acumulado.pagos += -importe;

    saldos.set(doctor, acumulado);
  }

  return ((doctores.data ?? []) as Doctor[])
    .filter((d) => doctoresConRemito.has(d.id))
    .map((doctor) => {
      const s = saldos.get(doctor.id) ?? { anterior: 0, facturado: 0, pagos: 0 };
      const filas = (filasPorDoctor.get(doctor.id) ?? []).sort(
        (a, b) => a.remitoNumero - b.remitoNumero || a.ordenNumero - b.ordenNumero,
      );
      return {
        doctor,
        filas,
        saldoAnterior: s.anterior,
        facturado: s.facturado,
        pagos: s.pagos,
        saldoFinal: s.anterior + s.facturado - s.pagos,
      };
    });
}
