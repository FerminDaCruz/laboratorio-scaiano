/**
 * Traduce los errores de Supabase a algo que se pueda leer (§7: qué pasó y qué
 * hacer, nunca el código crudo). Lo que no se reconoce cae en el mensaje de
 * respaldo que pasa quien llama.
 */
export function mensajeDeErrorSupabase(error: unknown, respaldo: string): string {
  const e = error as { code?: string; message?: string; details?: string };

  switch (e?.code) {
    case "23505":
      return "Ese valor ya existe y no se puede repetir.";
    case "23503":
      return "El registro está relacionado con otro y no se puede dejar así.";
    case "23514":
      return "Alguno de los valores no cumple las reglas de la base.";
    case "42501":
    case "PGRST301":
      return "Tu usuario no tiene permiso para hacer eso.";
    case "PGRST116":
      return "El registro ya no existe: puede haberlo cambiado otra persona.";
  }

  if (e?.message?.toLowerCase().includes("failed to fetch")) {
    return "No hay conexión con el servidor. Revisá internet y probá de nuevo.";
  }

  // Los errores que levantan las funciones PL/pgSQL ya vienen escritos para leer.
  if (e?.message && /^[A-ZÁÉÍÓÚÑ]/.test(e.message) && e.message.length < 160) {
    return e.message;
  }

  return respaldo;
}
