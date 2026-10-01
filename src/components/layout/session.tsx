"use client";

import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

export type Usuario = { id: string; nombre: string; rol: "operador" | "admin"; activo: boolean };

export type EstadoSesion =
  | { estado: "cargando" }
  | { estado: "sin-configurar" }
  | { estado: "anonimo" }
  /** Hay sesión, pero el usuario no tiene fila en `usuarios` o está inactivo: RLS no lo deja ver nada. */
  | { estado: "sin-habilitar"; session: Session }
  | { estado: "autenticado"; session: Session; usuario: Usuario };

const SessionContext = createContext<EstadoSesion>({ estado: "cargando" });

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [sesion, setSesion] = useState<EstadoSesion>({ estado: "cargando" });

  useEffect(() => {
    let supabase;
    try {
      supabase = getSupabase();
    } catch {
      setSesion({ estado: "sin-configurar" });
      return;
    }

    let vigente = true;

    async function aplicar(session: Session | null) {
      if (!session) {
        if (vigente) setSesion({ estado: "anonimo" });
        return;
      }
      const { data } = await getSupabase()
        .from("usuarios")
        .select("id, nombre, rol, activo")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!vigente) return;
      setSesion(
        data && data.activo
          ? { estado: "autenticado", session, usuario: data as Usuario }
          : { estado: "sin-habilitar", session },
      );
    }

    // onAuthStateChange emite INITIAL_SESSION al suscribirse, no hace falta getSession().
    const { data } = supabase.auth.onAuthStateChange((_evento, session) => {
      void aplicar(session);
    });

    return () => {
      vigente = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return <SessionContext.Provider value={sesion}>{children}</SessionContext.Provider>;
}

export function useSesion(): EstadoSesion {
  return useContext(SessionContext);
}
