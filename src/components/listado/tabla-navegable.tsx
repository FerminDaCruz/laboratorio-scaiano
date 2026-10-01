"use client";

import { useEffect, useRef, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type Columna<T> = {
  clave: string;
  titulo: string;
  /** Números y montos: a la derecha y con tabular-nums (§5B). */
  numerica?: boolean;
  mono?: boolean;
  ancho?: string;
  render: (fila: T) => React.ReactNode;
};

/**
 * Tabla del patrón §5B con el teclado de §5A: ↑ ↓ mueven el foco entre filas
 * y Enter abre la fila.
 */
export function TablaNavegable<T>({
  columnas,
  filas,
  idDe,
  onAbrir,
  vacio,
}: {
  columnas: Columna<T>[];
  filas: T[];
  idDe: (fila: T) => string | number;
  onAbrir?: (fila: T) => void;
  vacio: string;
}) {
  const [foco, setFoco] = useState(0);
  const refs = useRef<Map<string | number, HTMLTableRowElement>>(new Map());

  useEffect(() => {
    setFoco(0);
  }, [filas]);

  if (filas.length === 0) {
    return <p className="p-4 text-ink-3">{vacio}</p>;
  }

  function mover(e: React.KeyboardEvent, delta: number) {
    const destino = Math.min(Math.max(foco + delta, 0), filas.length - 1);
    if (destino === foco) return;
    e.preventDefault();
    setFoco(destino);
    refs.current.get(idDe(filas[destino]))?.focus();
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columnas.map((c) => (
            <TableHead
              key={c.clave}
              className={cn(c.numerica && "text-right", c.ancho)}
            >
              {c.titulo}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {filas.map((fila, i) => (
          <TableRow
            key={idDe(fila)}
            ref={(el) => {
              if (el) refs.current.set(idDe(fila), el);
              else refs.current.delete(idDe(fila));
            }}
            tabIndex={onAbrir ? 0 : -1}
            data-state={i === foco ? "selected" : undefined}
            className={cn(onAbrir && "cursor-pointer")}
            onFocus={() => setFoco(i)}
            onClick={() => onAbrir?.(fila)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") mover(e, 1);
              else if (e.key === "ArrowUp") mover(e, -1);
              else if (e.key === "Enter") {
                e.preventDefault();
                onAbrir?.(fila);
              }
            }}
          >
            {columnas.map((c) => (
              <TableCell
                key={c.clave}
                className={cn(c.numerica && "text-right tabular-nums", c.mono && "font-mono")}
              >
                {c.render(fila)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Skeleton con la forma de la tabla (§7): nunca un spinner centrado. */
export function TablaCargando({ columnas, filas = 8 }: { columnas: number; filas?: number }) {
  return (
    <div className="flex flex-col gap-1 p-3">
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="flex gap-3">
          {Array.from({ length: columnas }, (_, j) => (
            <Skeleton key={j} className="h-6 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
