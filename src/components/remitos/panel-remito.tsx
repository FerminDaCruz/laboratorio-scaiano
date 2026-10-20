"use client";

import { Pencil, Printer } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useConsulta } from "@/hooks/use-consulta";
import { formatFechaCorta, formatFechaLarga, formatOT, formatRemito } from "@/lib/format";
import { formatARS } from "@/lib/money";
import { anularRemito, listarLineasDeRemito, type LineaRemito, type RemitoConDoctor } from "./consultas";

export function PanelRemito({
  remito,
  onCerrar,
  onCambio,
}: {
  remito: RemitoConDoctor | null;
  onCerrar: () => void;
  onCambio: () => void;
}) {
  return (
    <Sheet open={remito !== null} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <SheetContent className="data-[side=right]:sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{remito ? `Remito ${formatRemito(remito.numero)}` : ""}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {remito && <DetalleRemito remito={remito} onCambio={onCambio} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetalleRemito({ remito, onCambio }: { remito: RemitoConDoctor; onCambio: () => void }) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [anulando, setAnulando] = useState(false);
  const [corrigiendo, setCorrigiendo] = useState(false);

  /** Corregir es anular y volver a emitir: el libro mayor no se edita. */
  async function corregir(ordenes: number[]) {
    setCorrigiendo(true);
    try {
      await anularRemito(remito.id, "Corrección del remito");
      toast.success("Remito anulado: armá el nuevo con los cambios");
      router.push(`/remitos/nuevo?ots=${ordenes.join(",")}`);
    } catch {
      toast.error("No se pudo anular el remito. Revisá la conexión y probá de nuevo.", {
        duration: Infinity,
      });
      setCorrigiendo(false);
    }
  }

  const { consulta } = useConsulta<LineaRemito[]>(
    () => listarLineasDeRemito(remito.id),
    [remito.id],
    "No se pudieron cargar las órdenes del remito.",
  );

  async function anular() {
    setAnulando(true);
    try {
      await anularRemito(remito.id, motivo);
      toast.success("Remito anulado");
      onCambio();
    } catch {
      toast.error("No se pudo anular el remito. Revisá la conexión y probá de nuevo.", {
        duration: Infinity,
      });
    } finally {
      setAnulando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Badge variant={remito.anulado_en ? "danger" : "ok"}>
          {remito.anulado_en ? "Anulado" : "Emitido"}
        </Badge>
        <span className="text-xs text-ink-2">{formatFechaLarga(remito.fecha)}</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Dato etiqueta="Doctor">
          {remito.doctor ? `${remito.doctor.nombre} (ficha ${remito.doctor.ficha})` : "—"}
        </Dato>
        <Dato etiqueta="Órdenes entregadas">{remito.lineas}</Dato>
        {remito.ajuste !== 0 && (
          <Dato etiqueta={remito.ajuste < 0 ? "Descuento" : "Recargo"}>
            {formatARS(remito.ajuste)}
            {remito.ajuste_motivo ? ` · ${remito.ajuste_motivo}` : ""}
          </Dato>
        )}
      </div>

      <Separator />

      <div className="flex flex-col gap-2">
        <h3 className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Órdenes</h3>
        {consulta.estado === "cargando" && <Skeleton className="h-16 w-full" />}
        {consulta.estado === "error" && <p className="text-danger">{consulta.mensaje}</p>}
        {consulta.estado === "listo" && (
          <ul className="flex flex-col">
            {consulta.datos.map((linea) => (
              <li key={linea.id} className="flex justify-between gap-3 border-b border-border py-2">
                <span>
                  <span className="font-mono">{linea.orden ? formatOT(linea.orden.numero) : "—"}</span>{" "}
                  {linea.orden?.paciente ?? ""}
                  {linea.orden ? (
                    <span className="text-ink-3"> · {formatFechaCorta(linea.orden.fecha)}</span>
                  ) : null}
                </span>
                <span className="tabular-nums">{formatARS(linea.importe)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="flex justify-between pt-1">
          <span className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Total</span>
          <span className="text-lg font-semibold tabular-nums">{formatARS(remito.total)}</span>
        </p>
      </div>

      <Separator />

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={`/remitos/documento?remito=${remito.numero}`} />}
        >
          <Printer data-icon="inline-start" />
          Ver documento
        </Button>

        {!remito.anulado_en && consulta.estado === "listo" && (
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="outline" disabled={corrigiendo} />}>
              <Pencil data-icon="inline-start" />
              Corregir
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Corregir el remito {formatRemito(remito.numero)}</AlertDialogTitle>
                <AlertDialogDescription>
                  Se anula este remito —queda el contra-asiento en la cuenta del doctor— y volvés
                  a la bandeja con las mismas órdenes para emitirlo de nuevo con los cambios.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() =>
                    void corregir(
                      consulta.datos
                        .map((l) => l.orden?.numero)
                        .filter((n): n is number => typeof n === "number"),
                    )
                  }
                >
                  Anular y rehacer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {!remito.anulado_en && (
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="destructive" disabled={anulando} />}>
              Anular remito
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Anular el remito {formatRemito(remito.numero)}</AlertDialogTitle>
                <AlertDialogDescription>
                  Se genera un contra-asiento por {formatARS(remito.total)} en la cuenta corriente
                  del doctor y las {remito.lineas} órdenes vuelven a quedar terminadas. El remito y
                  su asiento original no se borran.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex flex-col gap-2">
                <label htmlFor="motivo" className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
                  Motivo
                </label>
                <Input
                  id="motivo"
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
      </div>
    </div>
  );
}
