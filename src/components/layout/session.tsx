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

/**
 * Modo demo: si están cargadas estas dos variables, la app inicia sesión sola con
 * esa cuenta y nadie ve la pantalla de login.
 *
 * La contraseña viaja dentro del JavaScript que descarga el navegador, así que es
 * pública para cualquiera que tenga el link. Se usa con una cuenta hecha para eso,
 * y se corta de dos maneras: sacando las variables y volviendo a desplegar, o
 * desactivando ese usuario en la tabla `usuarios`.
 */
const DEMO_EMAIL = process.env.NEXT_PUBLIC_DEMO_EMAIL;
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD;

export const MODO_DEMO = Boolean(DEMO_EMAIL && DEMO_PASSWORD);

/**
 * La sesión dura un mes desde que se inició; después se vuelve a pedir la contraseña.
 * Supabase renueva la sesión sola y sin límite (ponerle uno desde el panel es del plan
 * pago), así que el vencimiento lo controla la app: anota cuándo empezó la sesión en
 * este navegador y la cierra al pasar el plazo. Es comodidad, no seguridad: la
 * protección de los datos sigue siendo la contraseña y RLS.
 */
const DURACION_SESION_MS = 30 * 24 * 60 * 60 * 1000;
const CLAVE_INICIO_SESION = "lab:inicio-sesion";

/** true si la sesión de este navegador ya pasó el plazo. Anota el inicio si no estaba. */
function sesionVencida(): boolean {
  try {
    const guardado = Number(localStorage.getItem(CLAVE_INICIO_SESION));
    if (!guardado) {
      localStorage.setItem(CLAVE_INICIO_SESION, String(Date.now()));
      return false;
    }
    return Date.now() - guardado > DURACION_SESION_MS;
  } catch {
    return false; // sin almacenamiento no se puede medir: la sesión sigue
  }
}

function olvidarInicioDeSesion() {
  try {
    localStorage.removeItem(CLAVE_INICIO_SESION);
  } catch {
    // nada que borrar
  }
}

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
    let demoIntentado = false;

    async function aplicar(session: Session | null) {
      if (session && sesionVencida()) {
        olvidarInicioDeSesion();
        // signOut dispara onAuthStateChange sin sesión, que muestra el login.
        await getSupabase().auth.signOut();
        return;
      }
      if (!session) {
        olvidarInicioDeSesion();
        // En modo demo se entra solo, una sola vez: si falla, se muestra el login.
        if (MODO_DEMO && !demoIntentado) {
          demoIntentado = true;
          const { error } = await getSupabase().auth.signInWithPassword({
            email: DEMO_EMAIL as string,
            password: DEMO_PASSWORD as string,
          });
          if (!error) return; // onAuthStateChange vuelve a entrar acá con la sesión
        }
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
