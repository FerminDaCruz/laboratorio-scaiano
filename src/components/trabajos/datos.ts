import { getSupabase } from "@/lib/supabase";
import { centavosDesdeNumeric, numericParaPostgres, type Centavos } from "@/lib/money";
import { normalizar } from "@/lib/texto";
import type { PrecioTrabajo, Trabajo, TrabajoConPrecio } from "@/lib/tipos";

export async function listarTrabajos(incluirInactivos: boolean): Promise<TrabajoConPrecio[]> {
  const supabase = getSupabase();

  let consulta = supabase.from("trabajos").select("*").order("codigo");
  if (!incluirInactivos) consulta = consulta.eq("activo", true);

  const [trabajos, precios] = await Promise.all([
    consulta,
    supabase.from("v_precios_vigentes").select("trabajo_id, precio"),
  ]);
  if (trabajos.error) throw trabajos.error;
  if (precios.error) throw precios.error;

  const porTrabajo = new Map<number, Centavos>();
  for (const p of precios.data ?? []) {
    porTrabajo.set(p.trabajo_id as number, centavosDesdeNumeric(p.precio as number));
  }

  return ((trabajos.data ?? []) as Trabajo[]).map((t) => ({
    ...t,
    precio: porTrabajo.get(t.id) ?? null,
  }));
}

export function filtrarTrabajos(trabajos: TrabajoConPrecio[], texto: string): TrabajoConPrecio[] {
  const consulta = normalizar(texto);
  if (!consulta) return trabajos;
  return trabajos.filter((t) => normalizar(`${t.codigo} ${t.titulo}`).includes(consulta));
}

export async function listarPreciosDe(trabajoId: number): Promise<PrecioTrabajo[]> {
  const { data, error } = await getSupabase()
    .from("precios_trabajo")
    .select("*")
    .eq("trabajo_id", trabajoId)
    .order("vigente_desde", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((p) => ({
    id: p.id as number,
    trabajo_id: p.trabajo_id as number,
    precio: centavosDesdeNumeric(p.precio as number),
    vigente_desde: p.vigente_desde as string,
    creado_en: p.creado_en as string,
  }));
}

export async function guardarTrabajo(
  datos: { codigo: string; titulo: string; descripcion: string | null; activo: boolean },
  id: number | null,
): Promise<number> {
  const supabase = getSupabase();

  if (id) {
    const { error } = await supabase.from("trabajos").update(datos).eq("id", id);
    if (error) throw error;
    return id;
  }

  const { data, error } = await supabase.from("trabajos").insert(datos).select("id").single();
  if (error) throw error;
  return data.id as number;
}

/** Agregar un precio nunca pisa el anterior: el historial es una fila más. */
export async function agregarPrecio(
  trabajoId: number,
  precio: Centavos,
  vigenteDesde: string,
): Promise<void> {
  const { error } = await getSupabase().from("precios_trabajo").insert({
    trabajo_id: trabajoId,
    precio: numericParaPostgres(precio),
    vigente_desde: vigenteDesde,
  });
  if (error) throw error;
}

/** Corrige el precio ya cargado para una fecha, en vez de duplicar la fila. */
export async function corregirPrecio(precioId: number, precio: Centavos): Promise<void> {
  const { error } = await getSupabase()
    .from("precios_trabajo")
    .update({ precio: numericParaPostgres(precio) })
    .eq("id", precioId);
  if (error) throw error;
}

export async function agregarPreciosEnLote(
  filas: { trabajo_id: number; precio: Centavos; vigente_desde: string }[],
): Promise<void> {
  const { error } = await getSupabase().from("precios_trabajo").insert(
    filas.map((f) => ({
      trabajo_id: f.trabajo_id,
      precio: numericParaPostgres(f.precio),
      vigente_desde: f.vigente_desde,
    })),
  );
  if (error) throw error;
}
