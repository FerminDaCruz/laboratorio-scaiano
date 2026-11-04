import { rangoDelMes } from "@/components/liquidaciones/consultas";
import { centavosDesdeNumeric, numericParaPostgres, type Centavos } from "@/lib/money";
import { getSupabase } from "@/lib/supabase";
import type { Doctor, MedioPago, MovimientoCC, TipoMovimiento } from "@/lib/tipos";

export type EstadoCuenta = "a_favor" | "al_dia" | "con_deuda" | "vencida";

export const ETIQUETA_ESTADO_CUENTA: Record<EstadoCuenta, string> = {
  a_favor: "Saldo a favor",
  al_dia: "Al día",
  con_deuda: "Con deuda",
  vencida: "Vencida +60 días",
};

/** §4 del design system: el color del badge significa el estado de la cuenta. */
export const VARIANTE_ESTADO_CUENTA: Record<EstadoCuenta, "ok" | "neutral" | "warn" | "danger"> = {
  a_favor: "ok",
  al_dia: "neutral",
  con_deuda: "warn",
  vencida: "danger",
};

export type CuentaDoctor = {
  doctor: Doctor;
  saldo: Centavos;
  antiguedad: {
    dias_0_30: Centavos;
    dias_31_60: Centavos;
    dias_61_90: Centavos;
    dias_mas_90: Centavos;
    diasMasViejo: number;
  };
  estado: EstadoCuenta;
};

const VACIA = { dias_0_30: 0, dias_31_60: 0, dias_61_90: 0, dias_mas_90: 0, diasMasViejo: 0 };

export async function listarCuentas(): Promise<CuentaDoctor[]> {
  const supabase = getSupabase();
  const [doctores, saldos, antiguedad] = await Promise.all([
    supabase.from("doctores").select("*").order("nombre"),
    supabase.from("v_saldos_doctor").select("*"),
    supabase.from("v_antiguedad_deuda").select("*"),
  ]);
  if (doctores.error) throw doctores.error;
  if (saldos.error) throw saldos.error;
  if (antiguedad.error) throw antiguedad.error;

  const porDoctor = new Map<number, Centavos>();
  for (const s of saldos.data ?? []) {
    porDoctor.set(s.doctor_id as number, centavosDesdeNumeric((s.saldo as number) ?? 0));
  }

  const vencimientos = new Map<number, CuentaDoctor["antiguedad"]>();
  for (const a of antiguedad.data ?? []) {
    vencimientos.set(a.doctor_id as number, {
      dias_0_30: centavosDesdeNumeric((a.dias_0_30 as number) ?? 0),
      dias_31_60: centavosDesdeNumeric((a.dias_31_60 as number) ?? 0),
      dias_61_90: centavosDesdeNumeric((a.dias_61_90 as number) ?? 0),
      dias_mas_90: centavosDesdeNumeric((a.dias_mas_90 as number) ?? 0),
      diasMasViejo: (a.dias_mas_viejo as number) ?? 0,
    });
  }

  return ((doctores.data ?? []) as Doctor[])
    .map((doctor) => {
      const saldo = porDoctor.get(doctor.id) ?? 0;
      const antig = vencimientos.get(doctor.id) ?? VACIA;
      return { doctor, saldo, antiguedad: antig, estado: estadoDeCuenta(saldo, antig.diasMasViejo) };
    })
    // Un doctor dado de baja sigue apareciendo mientras su cuenta no esté en cero:
    // la deuda no se puede esconder desactivando al doctor.
    .filter((cuenta) => cuenta.doctor.activo || cuenta.saldo !== 0);
}

export function estadoDeCuenta(saldo: Centavos, diasMasViejo: number): EstadoCuenta {
  if (saldo < 0) return "a_favor";
  if (saldo === 0) return "al_dia";
  return diasMasViejo > 60 ? "vencida" : "con_deuda";
}

export type MovimientoConImputado = MovimientoCC & {
  imputado: Centavos;
  pendiente: Centavos;
  remito: { numero: number } | null;
};

export async function movimientosDeDoctor(doctorId: number): Promise<MovimientoConImputado[]> {
  const supabase = getSupabase();
  const [movimientos, imputaciones] = await Promise.all([
    supabase
      .from("movimientos_cc")
      .select("*, remitos(numero)")
      .eq("doctor_id", doctorId)
      .order("fecha")
      .order("id"),
    supabase.from("imputaciones").select("*"),
  ]);
  if (movimientos.error) throw movimientos.error;
  if (imputaciones.error) throw imputaciones.error;

  const porDebe = new Map<number, Centavos>();
  const porHaber = new Map<number, Centavos>();
  for (const i of imputaciones.data ?? []) {
    const importe = centavosDesdeNumeric(i.importe as number);
    porDebe.set(i.movimiento_debe_id as number, (porDebe.get(i.movimiento_debe_id as number) ?? 0) + importe);
    porHaber.set(i.movimiento_haber_id as number, (porHaber.get(i.movimiento_haber_id as number) ?? 0) + importe);
  }

  return (movimientos.data ?? []).map((fila) => {
    const { remitos, ...resto } = fila as Record<string, unknown> & {
      id: number;
      importe: number;
      remitos: { numero: number } | null;
    };
    const importe = centavosDesdeNumeric(fila.importe as number);
    const imputado = (importe > 0 ? porDebe.get(fila.id as number) : porHaber.get(fila.id as number)) ?? 0;
    return {
      ...(resto as unknown as MovimientoCC),
      importe,
      imputado,
      pendiente: Math.abs(importe) - imputado,
      remito: remitos,
    };
  });
}

export type TrabajoDelMes = {
  /** Una fila por orden entregada: remito + OT. */
  id: string;
  fecha: string;
  remitoNumero: number;
  ordenNumero: number;
  paciente: string;
  trabajos: string[];
  /** El importe completo de la orden, no lo que queda por pagar de ella. */
  importe: Centavos;
};

type RemitoDelMesCrudo = {
  numero: number;
  fecha: string;
  remito_lineas: {
    importe: number;
    ordenes: {
      numero: number;
      paciente: string;
      orden_items: { posicion: number; trabajos: { titulo: string } | null }[];
    } | null;
  }[];
};

/**
 * Las órdenes que se le entregaron al doctor en el mes en curso, con su importe completo.
 * Los pagos se descuentan del saldo total, no de cada trabajo: por eso no hay "pendiente"
 * por orden. Los remitos anulados no entran.
 */
export async function trabajosDelMes(doctorId: number, hoy = new Date()): Promise<TrabajoDelMes[]> {
  const { desde, hasta } = rangoDelMes(hoy.getFullYear(), hoy.getMonth() + 1);
  const { data, error } = await getSupabase()
    .from("remitos")
    .select(
      "numero, fecha, remito_lineas(importe, ordenes(numero, paciente, orden_items(posicion, trabajos(titulo))))",
    )
    .eq("doctor_id", doctorId)
    .gte("fecha", desde)
    .lt("fecha", hasta)
    .is("anulado_en", null)
    .order("fecha")
    .order("numero");
  if (error) throw error;

  return ((data ?? []) as unknown as RemitoDelMesCrudo[]).flatMap((remito) =>
    remito.remito_lineas
      .filter((linea) => linea.ordenes !== null)
      .sort((a, b) => (a.ordenes?.numero ?? 0) - (b.ordenes?.numero ?? 0))
      .map((linea) => ({
        id: `${remito.numero}-${linea.ordenes?.numero}`,
        fecha: remito.fecha,
        remitoNumero: remito.numero,
        ordenNumero: linea.ordenes?.numero ?? 0,
        paciente: linea.ordenes?.paciente ?? "—",
        trabajos: [...(linea.ordenes?.orden_items ?? [])]
          .sort((a, b) => a.posicion - b.posicion)
          .map((item) => item.trabajos?.titulo ?? "—"),
        importe: centavosDesdeNumeric(linea.importe),
      })),
  );
}

/**
 * Registra un pago. Se descuenta del saldo total del doctor: el servidor lo aplica
 * solo, de lo más viejo a lo más nuevo, y lo que sobre queda a favor.
 */
export async function registrarPago(datos: {
  doctorId: number;
  importe: Centavos;
  fecha: string;
  medio: MedioPago;
  referencia: string | null;
}): Promise<{ aFavor: Centavos }> {
  const { data, error } = await getSupabase().rpc("registrar_pago", {
    p_doctor_id: datos.doctorId,
    p_importe: numericParaPostgres(datos.importe),
    p_fecha: datos.fecha,
    p_medio: datos.medio,
    ...(datos.referencia ? { p_referencia: datos.referencia } : {}),
  });
  if (error) throw error;

  const r = data as unknown as { a_favor: number };
  return { aFavor: centavosDesdeNumeric(r.a_favor) };
}

export type PagoListado = MovimientoCC & { doctor: { nombre: string; ficha: number } | null };

export async function listarPagos(limite = 50): Promise<PagoListado[]> {
  const { data, error } = await getSupabase()
    .from("movimientos_cc")
    .select("*, doctores(nombre, ficha)")
    .eq("tipo", "pago")
    .order("fecha", { ascending: false })
    .order("id", { ascending: false })
    .limit(limite);
  if (error) throw error;

  return (data ?? []).map((fila) => {
    const { doctores, ...resto } = fila as Record<string, unknown> & {
      importe: number;
      doctores: { nombre: string; ficha: number } | null;
      tipo: TipoMovimiento;
      medio: MedioPago | null;
    };
    return {
      ...(resto as unknown as MovimientoCC),
      importe: centavosDesdeNumeric(fila.importe as number),
      doctor: doctores,
    };
  });
}
