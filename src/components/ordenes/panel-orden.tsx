"use client";

import { Pencil, Printer, Receipt, Undo2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Dato } from "@/components/formulario/campo";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useSesion } from "@/components/layout/session";
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
import { anularOrden } from "./datos";

/** El circuito de producción. La entrega la hace el remito, no este panel. */
const SIGUIENTE: Partial<Record<EstadoOrden, { estado: EstadoOrden; etiqueta: string }>> = {
  ingresada: { estado: "en_proceso", etiqueta: "Pasar a en proceso" },
  en_proceso: { estado: "terminada", etiqueta: "Marcar terminada" },
};

/** Volver atrás, para cuando alguien marcó de más. */
const ANTERIOR: Partial<Record<EstadoOrden, { estado: EstadoOrden; etiqueta: string }>> = {
  en_proceso: { estado: "ingresada", etiqueta: "Volver a ingresada" },
  terminada: { estado: "en_proceso", etiqueta: "Volver a en proceso" },
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

  const sesion = useSesion();
  const esAdmin = sesion.estado === "autenticado" && sesion.usuario.rol === "admin";

  const [motivo, setMotivo] = useState("");
  const [anulando, setAnulando] = useState(false);

  const siguiente = SIGUIENTE[orden.estado];
  const anterior = ANTERIOR[orden.estado];
  const atrasada = estaAtrasada(orden);
  // Mientras no esté en un remito se puede editar, anular y facturar.
  const abierta = orden.remito_id === null && orden.estado !== "anulada";

  async function anular() {
    setAnulando(true);
    try {
      await anularOrden(orden.id, motivo);
      toast.success("Orden anulada");
      onCambio();
    } catch (error) {
      toast.error(
        (error as { message?: string }).message?.includes("administrador")
          ? "Solo un administrador puede anular una orden."
          : "No se pudo anular la orden. Revisá la conexión y probá de nuevo.",
        { duration: Infinity },
      );
    } finally {
      setAnulando(false);
    }
  }

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

      {orden.estado === "anulada" && (
        <Dato etiqueta="Motivo de la anulación">{orden.motivo_anulacion ?? "—"}</Dato>
      )}

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

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={`/ordenes/comanda?ot=${orden.numero}`} />}
        >
          <Printer data-icon="inline-start" />
          Comanda
        </Button>

        {abierta && (
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/ordenes/editar?ot=${orden.numero}`} />}
          >
            <Pencil data-icon="inline-start" />
            Editar
          </Button>
        )}

        {anterior && abierta && (
          <Button variant="outline" onClick={() => pasarA(anterior.estado)}>
            <Undo2 data-icon="inline-start" />
            {anterior.etiqueta}
          </Button>
        )}

        {abierta && esAdmin && (
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="destructive" disabled={anulando} />}>
              Anular orden
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Anular la OT {formatOT(orden.numero)}</AlertDialogTitle>
                <AlertDialogDescription>
                  La orden queda anulada y no se puede facturar. No se borra: sigue apareciendo
                  en el listado con su estado y el motivo.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="motivo-anulacion"
                  className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase"
                >
                  Motivo
                </label>
                <Input
                  id="motivo-anulacion"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Por qué se anula"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={anular}>
                  Anular
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {siguiente && <Button onClick={() => pasarA(siguiente.estado)}>{siguiente.etiqueta}</Button>}

        {orden.estado === "terminada" && (
          <Button nativeButton={false} render={<Link href={`/remitos/nuevo?ot=${orden.numero}`} />}>
            <Receipt data-icon="inline-start" />
            Facturar
          </Button>
        )}
      </div>
    </div>
  );
}
