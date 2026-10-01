"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { esRutaActiva, GRUPOS_NAV } from "./nav";

// §9: 200px fijo; debajo de 1024px colapsa a iconos con tooltip.
export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Principal"
      className="flex w-14 shrink-0 flex-col gap-6 overflow-y-auto bg-sidebar px-2 pb-4 text-sm text-sidebar-ink lg:w-[200px] print:hidden"
    >
      <div className="flex h-12 items-center px-2">
        <Link
          href="/"
          className="hidden truncate rounded-md px-1 font-semibold lg:block hover:bg-sidebar-hover"
        >
          Laboratorio Scaiano
        </Link>
      </div>

      {GRUPOS_NAV.map((grupo) => (
        <div key={grupo.titulo} className="flex flex-col gap-1">
          <p className="hidden px-3 pb-1 text-[11px] font-semibold tracking-wide text-sidebar-ink-2 uppercase lg:block">
            {grupo.titulo}
          </p>
          <ul className="flex flex-col gap-1">
            {grupo.items.map((item) => {
              const activo = esRutaActiva(pathname, item.href);
              const Icono = item.icono;
              return (
                <li key={item.href}>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Link
                          href={item.href}
                          aria-current={activo ? "page" : undefined}
                          className={cn(
                            "flex h-8 items-center justify-center gap-2 rounded-md px-2 transition-colors lg:justify-start lg:px-3",
                            activo ? "bg-accent text-accent-ink" : "hover:bg-sidebar-hover",
                          )}
                        />
                      }
                    >
                      <Icono className="size-4 shrink-0" aria-hidden />
                      <span className="sr-only lg:not-sr-only lg:truncate">{item.titulo}</span>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="lg:hidden">
                      {item.titulo}
                    </TooltipContent>
                  </Tooltip>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
