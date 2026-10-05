"use client";

import { ChevronDownIcon, LogOut, Monitor, Moon, Sun } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { getSupabase } from "@/lib/supabase";
import { tituloDeRuta } from "./nav";
import { MODO_DEMO, useSesion } from "./session";

export function Topbar() {
  const pathname = usePathname();
  const sesion = useSesion();

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-6 print:hidden">
      <div className="flex min-w-0 items-center gap-3">
        <h1 className="truncate text-xl font-semibold">{tituloDeRuta(pathname)}</h1>
        {MODO_DEMO && <Badge variant="warn">Modo demo</Badge>}
      </div>
      {sesion.estado === "autenticado" || sesion.estado === "sin-habilitar" ? (
        <MenuUsuario email={sesion.session.user.email ?? ""} />
      ) : (
        <Skeleton className="h-4 w-40" />
      )}
    </header>
  );
}

function MenuUsuario({ email }: { email: string }) {
  const { theme, setTheme } = useTheme();

  async function cerrarSesion() {
    const { error } = await getSupabase().auth.signOut();
    if (error) {
      toast.error("No se pudo cerrar la sesión. Revisá la conexión y probá de nuevo.", {
        duration: Infinity,
      });
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" />}>
        <span className="max-w-60 truncate">{email}</span>
        <ChevronDownIcon data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Tema</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme} onValueChange={(valor) => setTheme(String(valor))}>
            <DropdownMenuRadioItem value="light">
              <Sun />
              Claro
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">
              <Moon />
              Oscuro
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system">
              <Monitor />
              Sistema
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={cerrarSesion}>
          <LogOut />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
