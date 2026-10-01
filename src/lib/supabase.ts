import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

let cliente: SupabaseClient<Database> | null = null;

/**
 * Cliente único. Se crea al primer uso y no al importar, para que
 * `next build` no falle en el prerender cuando faltan las variables.
 */
export function getSupabase(): SupabaseClient<Database> {
  if (cliente) return cliente;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local",
    );
  }

  cliente = createClient<Database>(url, anonKey);
  return cliente;
}
