"use client";

import { Lock, Printer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { listarDoctoresParaCombo } from "@/components/doctores/datos";
import { DocumentoLiquidacion } from "@/components/documentos/liquidacion";
import { Campo } from "@/components/formulario/campo";
import { Combobox } from "@/components/formulario/combobox";
import { SelectSimple } from "@/components/formulario/select-simple";
import {
  cerrarPeriodo,
  liquidacionesDelMes,
  listarPeriodos,
  type Liquidacion,
  type Periodo,
} from "@/components/liquidaciones/consultas";
import { ErrorConsulta } from "@/components/listado/pagina-listado";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useConsulta } from "@/hooks/use-consulta";
import { formatARS } from "@/lib/money";
import type { Doctor } from "@/lib/tipos";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default function LiquidacionesPage() {
  const ahora = new Date();
  const mesAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);

  const [anio, setAnio] = useState(String(mesAnterior.getFullYear()));
  const [mes, setMes] = useState(String(mesAnterior.getMonth() + 1));
  const [doctorId, setDoctorId] = useState("");
  const [cerrando, setCerrando] = useState(false);

  const { consulta: consultaDoctores } = useConsulta<Doctor[]>(
    () => listarDoctoresParaCombo(),
    [],
    "No se pudieron cargar los doctores.",
  );
  const doctores = consultaDoctores.estado === "listo" ? consultaDoctores.datos : [];

  const { consulta, recargar } = useConsulta<Liquidacion[]>(
    () => liquidacionesDelMes(Number(anio), Number(mes), doctorId ? Number(doctorId) : null),
    [anio, mes, doctorId],
    "No se pudieron armar las liquidaciones. Revisá la conexión y probá de nuevo.",
  );

  const { consulta: consultaPeriodos, recargar: recargarPeriodos } = useConsulta<Periodo[]>(
    () => listarPeriodos(),
    [],
    "No se pudieron cargar los períodos.",
  );
  const periodos = consultaPeriodos.estado === "listo" ? consultaPeriodos.datos : [];
  const periodo = periodos.find((p) => p.anio === Number(anio) && p.mes === Number(mes));
  const cerrado = Boolean(periodo?.cerrado_en);

  const liquidaciones = consulta.estado === "listo" ? consulta.datos : [];
  const totalFacturado = liquidaciones.reduce((suma, l) => suma + l.facturado, 0);

  async function cerrar() {
    setCerrando(true);
    try {
      const resultado = await cerrarPeriodo(Number(anio), Number(mes));
      toast.success(`Período cerrado: ${resultado.doctores} doctores`);
      recargarPeriodos();
    } catch (error) {
      const mensaje = (error as { message?: string }).message ?? "";
      toast.error(
        mensaje.includes("administrador")
          ? "Solo un administrador puede cerrar el período."
          : mensaje.includes("ya estaba cerrado")
            ? "Ese período ya estaba cerrado."
            : "No se pudo cerrar el período. Revisá la conexión y probá de nuevo.",
        { duration: Infinity },
      );
    } finally {
      setCerrando(false);
    }
  }

  const anios = Array.from({ length: 5 }, (_, i) => String(ahora.getFullYear() - i));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <Campo id="mes" etiqueta="Mes">
          <SelectSimple
            id="mes"
            valor={mes}
            onCambio={setMes}
            ancho="w-40"
            opciones={MESES.map((m, i) => ({ valor: String(i + 1), etiqueta: m }))}
          />
        </Campo>
        <Campo id="anio" etiqueta="Año">
          <SelectSimple
            id="anio"
            valor={anio}
            onCambio={setAnio}
            ancho="w-28"
            opciones={anios.map((a) => ({ valor: a, etiqueta: a }))}
          />
        </Campo>
        <Campo id="doctor" etiqueta="Doctor">
          <Combobox
            id="doctor"
            valor={doctorId || null}
            onCambio={(v) => setDoctorId(v ?? "")}
            ancho="w-64"
            placeholder="Todos los doctores"
            opciones={[
              { valor: "", etiqueta: "Todos los doctores" },
              ...doctores.map((d) => ({
                valor: String(d.id),
                etiqueta: d.nombre,
                busqueda: String(d.ficha),
                detalle: `ficha ${d.ficha}`,
              })),
            ]}
          />
        </Campo>

        <div className="ml-auto flex items-end gap-2">
          <Button
            variant="outline"
            onClick={() => window.print()}
            disabled={liquidaciones.length === 0}
          >
            <Printer data-icon="inline-start" />
            Imprimir todas
          </Button>

          {cerrado ? (
            <Badge variant="info">Período cerrado</Badge>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger render={<Button disabled={cerrando} />}>
                <Lock data-icon="inline-start" />
                Cerrar período
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Cerrar {MESES[Number(mes) - 1]} de {anio}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Se congelan los saldos de cada doctor al cierre del mes. Después de esto, un
                    movimiento con fecha de ese mes solo entra como ajuste explícito.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={cerrar}>Cerrar período</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {consulta.estado === "cargando" && <Skeleton className="h-96 w-full max-w-[210mm]" />}
      {consulta.estado === "error" && (
        <ErrorConsulta mensaje={consulta.mensaje} onReintentar={recargar} />
      )}

      {consulta.estado === "listo" && (
        <>
          <p className="flex items-baseline gap-3 text-xs text-ink-2 print:hidden">
            <span>
              {liquidaciones.length}{" "}
              {liquidaciones.length === 1 ? "liquidación" : "liquidaciones"} para{" "}
              {MESES[Number(mes) - 1].toLowerCase()} de {anio}
            </span>
            <span className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
              Facturado
            </span>
            <span className="text-sm font-semibold text-ink tabular-nums">
              {formatARS(totalFacturado)}
            </span>
          </p>

          {liquidaciones.length === 0 ? (
            <p className="text-ink-3">
              No hay remitos emitidos en ese mes, así que no hay nada para liquidar.
            </p>
          ) : (
            <div className="flex flex-col gap-6">
              {liquidaciones.map((liquidacion) => (
                <div
                  key={liquidacion.doctor.id}
                  className="w-fit border border-border bg-surface shadow-sm print:border-0 print:shadow-none"
                >
                  <DocumentoLiquidacion
                    liquidacion={liquidacion}
                    anio={Number(anio)}
                    mes={Number(mes)}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
