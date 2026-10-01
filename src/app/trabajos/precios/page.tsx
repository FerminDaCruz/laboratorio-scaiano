"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Campo, SeccionFormulario } from "@/components/formulario/campo";
import { ErrorConsulta } from "@/components/listado/pagina-listado";
import { agregarPreciosEnLote, listarTrabajos } from "@/components/trabajos/datos";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useConsulta } from "@/hooks/use-consulta";
import { formatFechaLarga } from "@/lib/format";
import { aplicarPorcentaje, formatARS } from "@/lib/money";
import type { TrabajoConPrecio } from "@/lib/tipos";

const hoy = () => new Date().toISOString().slice(0, 10);

export default function ActualizarPreciosPage() {
  const [porcentaje, setPorcentaje] = useState("");
  const [vigenteDesde, setVigenteDesde] = useState(hoy());
  const [aplicando, setAplicando] = useState(false);

  const { consulta, recargar } = useConsulta<TrabajoConPrecio[]>(
    () => listarTrabajos(false),
    [],
    "No se pudieron cargar los trabajos. Revisá la conexión y probá de nuevo.",
  );

  const numero = Number(porcentaje.replace(",", "."));
  const porcentajeValido = porcentaje.trim() !== "" && Number.isFinite(numero) && numero !== 0;

  const trabajos = consulta.estado === "listo" ? consulta.datos : [];
  const conPrecio = trabajos.filter((t) => t.precio !== null);
  const sinPrecio = trabajos.length - conPrecio.length;

  const vistaPrevia = porcentajeValido
    ? conPrecio.map((t) => ({
        trabajo: t,
        actual: t.precio as number,
        nuevo: aplicarPorcentaje(t.precio as number, numero),
      }))
    : [];

  async function aplicar() {
    setAplicando(true);
    try {
      await agregarPreciosEnLote(
        vistaPrevia.map((f) => ({
          trabajo_id: f.trabajo.id,
          precio: f.nuevo,
          vigente_desde: vigenteDesde,
        })),
      );
      toast.success(`Precios actualizados: ${vistaPrevia.length} trabajos`);
      setPorcentaje("");
      recargar();
    } catch (error) {
      const duplicado = (error as { code?: string }).code === "23505";
      toast.error(
        duplicado
          ? "Ya hay precios cargados con esa fecha de vigencia. Elegí otra fecha."
          : "No se pudieron actualizar los precios. Revisá la conexión y probá de nuevo.",
        { duration: Infinity },
      );
    } finally {
      setAplicando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button variant="ghost" nativeButton={false} render={<Link href="/trabajos" />}>
          <ArrowLeft data-icon="inline-start" />
          Volver a trabajos
        </Button>
      </div>

      <div className="max-w-[640px]">
        <SeccionFormulario titulo="Aumento general" primera>
          <div className="flex flex-col gap-3">
            <Campo
              id="porcentaje"
              etiqueta="Porcentaje"
              ayuda="Positivo aumenta, negativo baja. Por ejemplo 12,5 o -5."
            >
              <Input
                id="porcentaje"
                autoFocus
                inputMode="decimal"
                className="w-40"
                value={porcentaje}
                onChange={(e) => setPorcentaje(e.target.value)}
              />
            </Campo>
            <Campo id="vigencia" etiqueta="Vigente desde">
              <Input
                id="vigencia"
                type="date"
                className="w-48"
                value={vigenteDesde}
                onChange={(e) => setVigenteDesde(e.target.value)}
              />
            </Campo>
          </div>
        </SeccionFormulario>
      </div>

      {consulta.estado === "error" && (
        <ErrorConsulta mensaje={consulta.mensaje} onReintentar={recargar} />
      )}

      {consulta.estado === "listo" && !porcentajeValido && (
        <p className="text-ink-3">
          Escribí un porcentaje para ver cómo quedarían los {conPrecio.length} precios vigentes.
        </p>
      )}

      {vistaPrevia.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
            Vista previa
          </h2>

          <div className="overflow-hidden rounded-md border border-border bg-surface">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Código</TableHead>
                  <TableHead>Trabajo</TableHead>
                  <TableHead className="text-right">Precio actual</TableHead>
                  <TableHead className="text-right">Precio nuevo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vistaPrevia.map((f) => (
                  <TableRow key={f.trabajo.id}>
                    <TableCell className="font-mono">{f.trabajo.codigo}</TableCell>
                    <TableCell>{f.trabajo.titulo}</TableCell>
                    <TableCell className="text-right text-ink-2 tabular-nums">
                      {formatARS(f.actual)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatARS(f.nuevo)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-ink-2">
              {sinPrecio > 0
                ? `${sinPrecio} ${sinPrecio === 1 ? "trabajo queda afuera porque no tiene" : "trabajos quedan afuera porque no tienen"} precio cargado.`
                : "Todos los trabajos activos tienen precio cargado."}
            </p>

            <AlertDialog>
              <AlertDialogTrigger render={<Button disabled={aplicando} />}>
                {aplicando ? "Aplicando…" : "Aplicar aumento"}
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Actualizar {vistaPrevia.length} precios</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se agrega un precio nuevo a cada trabajo, con vigencia desde el{" "}
                    {formatFechaLarga(vigenteDesde)}. Los precios anteriores quedan en el historial
                    y las órdenes ya cargadas no cambian.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={aplicar}>Aplicar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </section>
      )}
    </div>
  );
}
