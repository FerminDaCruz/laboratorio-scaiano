import { FILAS_POR_PAGINA } from "@/components/listado/pagina-listado";
import { centavosDesdeNumeric, type Centavos } from "@/lib/money";
import { getSupabase } from "@/lib/supabase";
import { limpiarParaBusqueda } from "@/lib/texto";
import type { Doctor, ObraSocial } from "@/lib/tipos";

export type EstadoFiltro = "activos" | "inactivos" | "todos";

export type FiltrosDoctores = {
  texto: string;
  obraSocialId: string;
  estado: EstadoFiltro;
  pagina: number;
};

export type DatosDoctor = {
  ficha: number;
  nombre: string;
  domicilio: string | null;
  piso: string | null;
  departamento: string | null;
  localidad: string | null;
  telefono: string | null;
  obra_social_id: number | null;
  fecha_alta: string;
  activo: boolean;
  notas: string | null;
};

/** El código 23505 de Postgres es "valor duplicado en índice único". */
export const CODIGO_DUPLICADO = "23505";

export async function listarDoctores(
  f: FiltrosDoctores,
): Promise<{ filas: Doctor[]; total: number }> {
  let consulta = getSupabase()
    .from("doctores")
    .select("*", { count: "exact" })
    .order("nombre");

  if (f.estado !== "todos") consulta = consulta.eq("activo", f.estado === "activos");
  if (f.obraSocialId) consulta = consulta.eq("obra_social_id", Number(f.obraSocialId));

  const texto = limpiarParaBusqueda(f.texto);
  if (texto) {
    const ficha = Number(texto);
    consulta = Number.isInteger(ficha)
      ? consulta.or(`nombre.ilike.%${texto}%,ficha.eq.${ficha}`)
      : consulta.ilike("nombre", `%${texto}%`);
  }

  const desde = f.pagina * FILAS_POR_PAGINA;
  const { data, error, count } = await consulta.range(desde, desde + FILAS_POR_PAGINA - 1);
  if (error) throw error;

  return { filas: (data ?? []) as Doctor[], total: count ?? 0 };
}

// Las fichas nuevas empiezan con 100 y tienen seis dígitos: 100101, 100304…
export const FICHA_MINIMA = 100000;
export const FICHA_MAXIMA = 100999;
const PRIMERA_FICHA = 100101;

export function fichaConFormato(ficha: number): boolean {
  return Number.isInteger(ficha) && ficha >= FICHA_MINIMA && ficha <= FICHA_MAXIMA;
}

/** La ficha libre más chica después de la última usada, dentro del formato. */
export async function proximaFichaLibre(): Promise<number> {
  const { data, error } = await getSupabase()
    .from("doctores")
    .select("ficha")
    .gte("ficha", FICHA_MINIMA)
    .lte("ficha", FICHA_MAXIMA)
    .order("ficha", { ascending: false })
    .limit(1);
  if (error) throw error;

  const ultima = data?.[0]?.ficha as number | undefined;
  if (ultima === undefined) return PRIMERA_FICHA;
  if (ultima >= FICHA_MAXIMA) {
    throw new Error("No quedan fichas libres con el formato 100xxx");
  }
  return ultima + 1;
}

/** Todos los doctores activos, para los combobox de otras pantallas. */
export async function listarDoctoresParaCombo(): Promise<Doctor[]> {
  const { data, error } = await getSupabase()
    .from("doctores")
    .select("*")
    .eq("activo", true)
    .order("nombre");
  if (error) throw error;
  return (data ?? []) as Doctor[];
}

/** Saldo de cuenta corriente del doctor: positivo es deuda. */
export async function saldoDeDoctor(doctorId: number): Promise<Centavos> {
  const { data, error } = await getSupabase()
    .from("v_saldos_doctor")
    .select("saldo")
    .eq("doctor_id", doctorId)
    .maybeSingle();
  if (error) throw error;
  return centavosDesdeNumeric((data?.saldo as number) ?? 0);
}

export async function listarObrasSociales(soloActivas = false): Promise<ObraSocial[]> {
  let consulta = getSupabase().from("obras_sociales").select("*").order("nombre");
  if (soloActivas) consulta = consulta.eq("activa", true);
  const { data, error } = await consulta;
  if (error) throw error;
  return (data ?? []) as ObraSocial[];
}

export async function guardarDoctor(datos: DatosDoctor, id: number | null): Promise<void> {
  const supabase = getSupabase();
  const { error } = id
    ? await supabase.from("doctores").update(datos).eq("id", id)
    : await supabase.from("doctores").insert(datos);
  if (error) throw error;
}

export async function guardarObraSocial(
  datos: { codigo: string; nombre: string; activa: boolean },
  id: number | null,
): Promise<void> {
  const supabase = getSupabase();
  const { error } = id
    ? await supabase.from("obras_sociales").update(datos).eq("id", id)
    : await supabase.from("obras_sociales").insert(datos);
  if (error) throw error;
}
