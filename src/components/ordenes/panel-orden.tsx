"use client";

import { Printer } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Dato } from "@/components/formulario/campo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useConsulta } from "@/hooks/use-consulta";
import { formatPieza } from "@/lib/fdi";
import { formatFechaCorta, formatFechaLarga, formatHora, formatOT } from "@/lib/format";
import { formatARS } from "@/lib/money";
import { ETIQUETA_ESTADO, ETIQUETA_SEXO, VARIANTE_ESTADO, type EstadoOrden, type Sexo } from "@/lib/tipos";
import {
  cambiarEstadoOrden,
  estaAtrasada,
  listarItemsDeOrden,
  type ItemDeOrden,
  type OrdenConDoctor,
} from "./consultas";

/** El estado siguiente del circuito de producción. La entrega la hace el remito (E8). */
const SIGUIENTE: Partial<Record<EstadoOrden, { estado: EstadoOrden; etiqueta: string }>> = {
  ingresada: { estado: "en_proceso", etiqueta: "Pasar a en proceso" },
  en_proceso: { estado: "terminada", etiqueta: "Marcar terminada" },
};

export function PanelOrden({
  orden,
  onCerrar,
  onCambio,
}: {
  orden: OrdenConDoctor | null;
  onCerrar: () => void;
  onCambio: () => void;
}) {
  return (
    <Sheet open={orden !== null} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <SheetContent className="data-[side=right]:sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{orden ? `OT ${formatOT(orden.numero)}` : ""}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {orden && <DetalleOrden orden={orden} onCambio={onCambio} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetalleOrden({ orden, onCambio }: { orden: OrdenConDoctor; onCambio: () => void }) {
  const { consulta } = useConsulta<ItemDeOrden[]>(
    () => listarItemsDeOrden(orden.id),
    [orden.id],
    "No se pudieron cargar los trabajos de la orden.",
  );

  const siguiente = SIGUIENTE[orden.estado];
  const atrasada = estaAtrasada(orden);

  async function pasarA(estado: EstadoOrden) {
    try {
      await cambiarEstadoOrden(orden.id, estado);
      toast.success(`Orden ${ETIQUETA_ESTADO[estado].toLowerCase()}`);
      onCambio();
    } catch {
      toast.error("No se pudo cambiar el estado. Revisá la conexión y probá de nuevo.", {
        duration: Infinity,
      });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={VARIANTE_ESTADO[orden.estado]}>{ETIQUETA_ESTADO[orden.estado]}</Badge>
        {atrasada && <Badge variant="danger">Atrasada</Badge>}
        <span className="text-xs text-ink-2">{formatFechaLarga(orden.fecha)}</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Dato etiqueta="Doctor">
          {orden.doctor ? `${orden.doctor.nombre} (ficha ${orden.doctor.ficha})` : "—"}
        </Dato>
        <Dato etiqueta="Paciente">{orden.paciente}</Dato>
        <Dato etiqueta="Obra social">{orden.obra_social?.nombre ?? "—"}</Dato>
        <Dato etiqueta="Sexo y edad">
          {[orden.sexo ? ETIQUETA_SEXO[orden.sexo as Sexo] : null, orden.edad ? `${orden.edad} años` : null]
            .filter(Boolean)
            .join(" · ") || "—"}
        </Dato>
        <Dato etiqueta="Color">{orden.color ?? "—"}</Dato>
        <Dato etiqueta="Entrega comprometida">
          {orden.entrega_at
            ? `${formatFechaCorta(orden.entrega_at)} ${formatHora(orden.entrega_at)}`
            : "—"}
        </Dato>
      </div>

      {orden.indicaciones && <Dato etiqueta="Indicaciones">{orden.indicaciones}</Dato>}

      <Separator />

      <div className="flex flex-col gap-2">
        <h3 className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Trabajos</h3>
        {consulta.estado === "cargando" && <Skeleton className="h-16 w-full" />}
        {consulta.estado === "error" && <p className="text-danger">{consulta.mensaje}</p>}
        {consulta.estado === "listo" && (
          <ul className="flex flex-col">
            {consulta.datos.map((item) => (
              <li key={item.id} className="flex justify-between gap-3 border-b border-border py-2">
                <span className="flex flex-col">
                  <span>
                    {item.cantidad} × {item.trabajo?.titulo ?? "—"}
                  </span>
                  <span className="text-xs text-ink-3">
                    <span className="font-mono">{item.trabajo?.codigo}</span> · piezas{" "}
                    {formatPieza(item.piezas)} · {formatARS(item.precio_unitario)} c/u
                  </span>
                </span>
                <span className="tabular-nums">{formatARS(item.subtotal)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="flex justify-between pt-1">
          <span className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Total</span>
          <span className="text-lg font-semibold tabular-nums">{formatARS(orden.total)}</span>
        </p>
      </div>

      <Separator />

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={`/ordenes/comanda?ot=${orden.numero}`} />}
        >
          <Printer data-icon="inline-start" />
          Comanda
        </Button>
        {siguiente && <Button onClick={() => pasarA(siguiente.estado)}>{siguiente.etiqueta}</Button>}
      </div>
    </div>
  );
}
