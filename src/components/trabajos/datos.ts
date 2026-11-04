import { getSupabase } from "@/lib/supabase";
import { centavosDesdeNumeric, numericParaPostgres, type Centavos } from "@/lib/money";
import { normalizar, patronSinAcentos } from "@/lib/texto";
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

/** Cuántos trabajos trae cada tanda del combo de la orden. */
export const TRABAJOS_POR_TANDA = 20;

/** Lo que hace falta tipear para que el combo de trabajos busque. */
export const MINIMO_PARA_BUSCAR_TRABAJO = 2;

/**
 * Una tanda de trabajos activos para el combo de la orden, con su precio vigente.
 * Sin texto (o con menos de dos letras) trae el catálogo en orden alfabético; con texto
 * busca por título o código, sin que importen los acentos. Nunca trae el catálogo entero.
 */
export async function buscarTrabajosParaOrden(
  texto: string,
  desde: number,
): Promise<{ trabajos: TrabajoConPrecio[]; hayMas: boolean }> {
  const supabase = getSupabase();

  // Se pide uno de más para saber si queda otra tanda sin contar toda la tabla.
  let consulta = supabase
    .from("trabajos")
    .select("*")
    .eq("activo", true)
    .order("titulo")
    .order("id")
    .range(desde, desde + TRABAJOS_POR_TANDA);

  if (normalizar(texto).length >= MINIMO_PARA_BUSCAR_TRABAJO) {
    const patron = patronSinAcentos(texto);
    consulta = consulta.or(`titulo.imatch."${patron}",codigo.imatch."${patron}"`);
  }

  const { data, error } = await consulta;
  if (error) throw error;

  const filas = (data ?? []) as Trabajo[];
  const hayMas = filas.length > TRABAJOS_POR_TANDA;
  const tanda = filas.slice(0, TRABAJOS_POR_TANDA);

  return { trabajos: await conPrecioVigente(tanda), hayMas };
}

async function conPrecioVigente(trabajos: Trabajo[]): Promise<TrabajoConPrecio[]> {
  if (trabajos.length === 0) return [];
  const { data, error } = await getSupabase()
    .from("v_precios_vigentes")
    .select("trabajo_id, precio")
    .in(
      "trabajo_id",
      trabajos.map((t) => t.id),
    );
  if (error) throw error;

  const porTrabajo = new Map<number, Centavos>();
  for (const p of data ?? []) {
    porTrabajo.set(p.trabajo_id as number, centavosDesdeNumeric(p.precio as number));
  }
  return trabajos.map((t) => ({ ...t, precio: porTrabajo.get(t.id) ?? null }));
}

const PALABRAS_SIN_LETRA = new Set(["de", "del", "la", "el", "los", "las", "y", "o", "a", "en", "con", "para", "por", "s", "c", "p"]);

/**
 * Propone un código corto a partir del título, al estilo de los que ya hay en el catálogo:
 * la inicial de cada palabra con los números tal cual ("Corona ZR monolítica" → "CZM",
 * "Bandeja s/ 4 implantes" → "B4I"). Una sola palabra da sus primeras cuatro letras.
 */
export function codigoDesdeTitulo(titulo: string): string {
  const palabras = normalizar(titulo)
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((p) => p !== "" && !PALABRAS_SIN_LETRA.has(p));

  if (palabras.length === 0) return "";
  if (palabras.length === 1) return palabras[0].slice(0, 4).toUpperCase();

  return palabras
    .map((p) => (/^\d+$/.test(p) ? p : p[0]))
    .join("")
    .slice(0, 8)
    .toUpperCase();
}

/**
 * El primer código libre a partir de una base: "CMC", y si está tomado "CMC2", "CMC3"…
 * Mira la base, así que dos personas cargando a la vez pueden chocar; para eso está la
 * restricción única de la tabla, que el formulario ya muestra debajo del campo.
 */
export async function codigoLibre(base: string): Promise<string> {
  if (base === "") return "";
  const { data, error } = await getSupabase()
    .from("trabajos")
    .select("codigo")
    .ilike("codigo", `${base}%`);
  if (error) throw error;

  const tomados = new Set((data ?? []).map((t) => (t.codigo as string).toUpperCase()));
  if (!tomados.has(base)) return base;
  for (let n = 2; ; n++) {
    if (!tomados.has(`${base}${n}`)) return `${base}${n}`;
  }
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
