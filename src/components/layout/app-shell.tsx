"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSesion } from "./session";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export const RUTA_LOGIN = "/login";

/**
 * Layout de §9 y guard de rutas. El guard es comodidad, no seguridad:
 * lo que protege los datos es RLS en la base.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const sesion = useSesion();
  const enLogin = pathname === RUTA_LOGIN;

  useEffect(() => {
    if (sesion.estado === "anonimo" && !enLogin) {
      router.replace(`${RUTA_LOGIN}?next=${encodeURIComponent(pathname)}`);
    }
  }, [sesion.estado, enLogin, pathname, router]);

  if (enLogin) return children;

  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-auto p-6 print:overflow-visible print:p-0">
          {sesion.estado === "autenticado" ? (
            children
          ) : sesion.estado === "sin-configurar" ? (
            <ErrorConfiguracion />
          ) : sesion.estado === "sin-habilitar" ? (
            <UsuarioSinHabilitar />
          ) : (
            <ContenidoCargando />
          )}
        </main>
      </div>
    </div>
  );
}

export function ErrorConfiguracion() {
  return (
    <p className="text-sm text-danger">
      Falta configurar la conexión con Supabase. Cargá NEXT_PUBLIC_SUPABASE_URL y
      NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local y reiniciá el servidor.
    </p>
  );
}

/** Hay sesión pero el usuario no está dado de alta: RLS no le deja ver nada. */
function UsuarioSinHabilitar() {
  return (
    <div className="flex max-w-[640px] flex-col gap-3">
      <p className="text-danger">Tu usuario todavía no está habilitado en el sistema.</p>
      <p className="text-ink-2">
        Pedile a un administrador que te dé de alta en la tabla de usuarios del laboratorio. Hasta
        entonces no vas a ver órdenes ni doctores.
      </p>
    </div>
  );
}

function ContenidoCargando() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Cargando">
      <Skeleton className="h-8 w-full max-w-md" />
      <div className="flex flex-col gap-1">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    </div>
  );
}
