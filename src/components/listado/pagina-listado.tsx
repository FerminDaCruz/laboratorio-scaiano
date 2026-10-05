"use client";

import { Button } from "@/components/ui/button";
import { formatNumero } from "@/lib/format";

export const FILAS_POR_PAGINA = 50;

/**
 * Patrón §5A. El título de la página lo muestra la barra superior (§9),
 * así que acá va solo la acción primaria, los filtros, la tabla y el pie.
 */
export function PaginaListado({
  accionPrimaria,
  filtros,
  children,
  pie,
}: {
  accionPrimaria?: React.ReactNode;
  filtros: React.ReactNode;
  children: React.ReactNode;
  pie?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2">{filtros}</div>
        {accionPrimaria}
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-surface">{children}</div>

      {pie}
    </div>
  );
}

export function PiePaginado({
  total,
  pagina,
  cantidadEnPagina,
  onPagina,
  etiqueta,
}: {
  total: number | null;
  pagina: number;
  cantidadEnPagina: number;
  onPagina: (pagina: number) => void;
  etiqueta: string;
}) {
  const desde = total === 0 ? 0 : pagina * FILAS_POR_PAGINA + 1;
  const hasta = pagina * FILAS_POR_PAGINA + cantidadEnPagina;
  const haySiguiente = total === null ? cantidadEnPagina === FILAS_POR_PAGINA : hasta < total;

  return (
    <div className="flex items-center justify-between gap-4 text-xs text-ink-2">
      <span className="tabular-nums">
        {total === null
          ? `${formatNumero(cantidadEnPagina)} ${etiqueta}`
          : `${formatNumero(desde)}–${formatNumero(hasta)} de ${formatNumero(total)} ${etiqueta}`}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" disabled={pagina === 0} onClick={() => onPagina(pagina - 1)}>
          Anterior
        </Button>
        <Button variant="outline" disabled={!haySiguiente} onClick={() => onPagina(pagina + 1)}>
          Siguiente
        </Button>
      </div>
    </div>
  );
}

/** Estado de error de §7: qué pasó y qué hacer. */
export function ErrorConsulta({ mensaje, onReintentar }: { mensaje: string; onReintentar: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 p-4">
      <p className="text-danger">{mensaje}</p>
      <Button variant="outline" onClick={onReintentar}>
        Probar de nuevo
      </Button>
    </div>
  );
}
