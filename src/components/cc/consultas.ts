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
    supabase.from("doctores").select("*").eq("activo", true).order("nombre"),
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

  return ((doctores.data ?? []) as Doctor[]).map((doctor) => {
    const saldo = porDoctor.get(doctor.id) ?? 0;
    const antig = vencimientos.get(doctor.id) ?? VACIA;
    return { doctor, saldo, antiguedad: antig, estado: estadoDeCuenta(saldo, antig.diasMasViejo) };
  });
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

export type DeudaPendiente = {
  id: number;
  fecha: string;
  pendiente: Centavos;
  importe: Centavos;
  remitoId: number | null;
  remitoNumero: number | null;
  pacientes: string[];
};

export async function deudasPendientes(doctorId: number): Promise<DeudaPendiente[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("v_deudas_pendientes")
    .select("*")
    .eq("doctor_id", doctorId)
    .order("fecha");
  if (error) throw error;

  const deudas = (data ?? []).map((d) => ({
    id: d.id as number,
    fecha: d.fecha as string,
    pendiente: centavosDesdeNumeric(d.pendiente as number),
    importe: centavosDesdeNumeric(d.importe as number),
    remitoId: (d.remito_id as number) ?? null,
    remitoNumero: null as number | null,
    pacientes: [] as string[],
  }));

  const remitoIds = deudas.map((d) => d.remitoId).filter((id): id is number => id !== null);
  if (remitoIds.length === 0) return deudas;

  const [remitos, lineas] = await Promise.all([
    supabase.from("remitos").select("id, numero").in("id", remitoIds),
    supabase.from("remito_lineas").select("remito_id, ordenes(paciente)").in("remito_id", remitoIds),
  ]);
  if (remitos.error) throw remitos.error;
  if (lineas.error) throw lineas.error;

  const numeros = new Map((remitos.data ?? []).map((r) => [r.id as number, r.numero as number]));
  const pacientes = new Map<number, string[]>();
  for (const linea of lineas.data ?? []) {
    const remitoId = linea.remito_id as number;
    const paciente = (linea as { ordenes: { paciente: string } | null }).ordenes?.paciente;
    if (!paciente) continue;
    pacientes.set(remitoId, [...(pacientes.get(remitoId) ?? []), paciente]);
  }

  return deudas.map((d) => ({
    ...d,
    remitoNumero: d.remitoId ? (numeros.get(d.remitoId) ?? null) : null,
    pacientes: d.remitoId ? (pacientes.get(d.remitoId) ?? []) : [],
  }));
}

export async function registrarPago(datos: {
  doctorId: number;
  importe: Centavos;
  fecha: string;
  medio: MedioPago;
  referencia: string | null;
  deudaIds: number[] | null;
}): Promise<{ imputado: Centavos; aFavor: Centavos }> {
  const { data, error } = await getSupabase().rpc("registrar_pago", {
    p_doctor_id: datos.doctorId,
    p_importe: numericParaPostgres(datos.importe),
    p_fecha: datos.fecha,
    p_medio: datos.medio,
    ...(datos.referencia ? { p_referencia: datos.referencia } : {}),
    ...(datos.deudaIds && datos.deudaIds.length > 0 ? { p_deuda_ids: datos.deudaIds } : {}),
  });
  if (error) throw error;

  const r = data as unknown as { imputado: number; a_favor: number };
  return {
    imputado: centavosDesdeNumeric(r.imputado),
    aFavor: centavosDesdeNumeric(r.a_favor),
  };
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
