"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { listarCuentas, type CuentaDoctor } from "@/components/cc/consultas";
import { Campo } from "@/components/formulario/campo";
import { SelectSimple } from "@/components/formulario/select-simple";
import { ErrorConsulta } from "@/components/listado/pagina-listado";
import { reportesDelMes, type ReportesDelMes } from "@/components/reportes/consultas";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useConsulta } from "@/hooks/use-consulta";
import { formatNumero } from "@/lib/format";
import { formatARS } from "@/lib/money";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default function ReportesPage() {
  const ahora = new Date();
  const [anio, setAnio] = useState(String(ahora.getFullYear()));
  const [mes, setMes] = useState(String(ahora.getMonth() + 1));

  const { consulta, recargar } = useConsulta<ReportesDelMes>(
    () => reportesDelMes(Number(anio), Number(mes)),
    [anio, mes],
    "No se pudieron cargar los reportes. Revisá la conexión y probá de nuevo.",
  );

  const { consulta: consultaCuentas } = useConsulta<CuentaDoctor[]>(
    () => listarCuentas(),
    [],
    "No se pudo cargar la antigüedad de la deuda.",
  );

  const antiguedad =
    consultaCuentas.estado === "listo"
      ? consultaCuentas.datos.reduce(
          (acumulado, c) => ({
            dias_0_30: acumulado.dias_0_30 + c.antiguedad.dias_0_30,
            dias_31_60: acumulado.dias_31_60 + c.antiguedad.dias_31_60,
            dias_61_90: acumulado.dias_61_90 + c.antiguedad.dias_61_90,
            dias_mas_90: acumulado.dias_mas_90 + c.antiguedad.dias_mas_90,
          }),
          { dias_0_30: 0, dias_31_60: 0, dias_61_90: 0, dias_mas_90: 0 },
        )
      : null;

  const anios = Array.from({ length: 5 }, (_, i) => String(ahora.getFullYear() - i));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <Button variant="ghost" nativeButton={false} render={<Link href="/" />}>
          <ArrowLeft data-icon="inline-start" />
          Volver al tablero
        </Button>
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
      </div>

      {consulta.estado === "cargando" && <Skeleton className="h-64 w-full" />}
      {consulta.estado === "error" && (
        <ErrorConsulta mensaje={consulta.mensaje} onReintentar={recargar} />
      )}

      {consulta.estado === "listo" && (
        <>
          <p className="flex items-baseline gap-3 text-xs text-ink-2">
            <span>
              {formatNumero(consulta.datos.totalOrdenes)}{" "}
              {consulta.datos.totalOrdenes === 1 ? "orden cargada" : "órdenes cargadas"} en{" "}
              {MESES[Number(mes) - 1].toLowerCase()}
            </span>
            <span className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Total</span>
            <span className="text-sm font-semibold text-ink tabular-nums">
              {formatARS(consulta.datos.totalMes)}
            </span>
          </p>

          <section className="flex flex-col gap-3">
            <h2 className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
              Por obra social
            </h2>
            <div className="overflow-hidden rounded-md border border-border bg-surface">
              {consulta.datos.porObraSocial.length === 0 ? (
                <p className="p-4 text-ink-3">No hay órdenes cargadas en ese mes.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Obra social</TableHead>
                      <TableHead className="text-right">Órdenes</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consulta.datos.porObraSocial.map((fila) => (
                      <TableRow key={fila.obraSocial}>
                        <TableCell>{fila.obraSocial}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumero(fila.ordenes)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatARS(fila.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
              Trabajos más vendidos
            </h2>
            <div className="overflow-hidden rounded-md border border-border bg-surface">
              {consulta.datos.masVendidos.length === 0 ? (
                <p className="p-4 text-ink-3">No hay trabajos cargados en ese mes.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Código</TableHead>
                      <TableHead>Trabajo</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consulta.datos.masVendidos.map((fila) => (
                      <TableRow key={fila.codigo}>
                        <TableCell className="font-mono">{fila.codigo}</TableCell>
                        <TableCell>{fila.titulo}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumero(fila.cantidad)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatARS(fila.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </section>
        </>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
          Antigüedad de la deuda
        </h2>
        {antiguedad === null ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <div className="flex flex-wrap gap-4">
            {[
              { etiqueta: "0 a 30 días", valor: antiguedad.dias_0_30 },
              { etiqueta: "31 a 60 días", valor: antiguedad.dias_31_60 },
              { etiqueta: "61 a 90 días", valor: antiguedad.dias_61_90 },
              { etiqueta: "Más de 90 días", valor: antiguedad.dias_mas_90 },
            ].map((tramo) => (
              <div
                key={tramo.etiqueta}
                className="flex min-w-56 flex-1 flex-col gap-1 rounded-md border border-border bg-surface p-4"
              >
                <span className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
                  {tramo.etiqueta}
                </span>
                <span className="text-2xl font-semibold tabular-nums">{formatARS(tramo.valor)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
