"use client";

import Link from "next/link";
import { resumenTablero, type ResumenTablero } from "@/components/reportes/consultas";
import { ErrorConsulta } from "@/components/listado/pagina-listado";
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
import { ETIQUETA_ESTADO } from "@/lib/tipos";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function Tarjeta({
  etiqueta,
  valor,
  detalle,
  tono,
}: {
  etiqueta: string;
  valor: string;
  detalle?: string;
  tono?: "ok" | "warn" | "danger";
}) {
  const color = tono === "ok" ? "text-ok" : tono === "warn" ? "text-warn" : tono === "danger" ? "text-danger" : "";
  return (
    <div className="flex min-w-56 flex-1 flex-col gap-1 rounded-md border border-border bg-surface p-4">
      <span className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">{etiqueta}</span>
      <span className={`text-2xl font-semibold tabular-nums ${color}`}>{valor}</span>
      {detalle && <span className="text-xs text-ink-2">{detalle}</span>}
    </div>
  );
}

export default function TableroPage() {
  const ahora = new Date();
  const anio = ahora.getFullYear();
  const mes = ahora.getMonth() + 1;

  const { consulta, recargar } = useConsulta<ResumenTablero>(
    () => resumenTablero(anio, mes),
    [anio, mes],
    "No se pudo cargar el tablero. Revisá la conexión y probá de nuevo.",
  );

  if (consulta.estado === "cargando") {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 min-w-56 flex-1" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (consulta.estado === "error") {
    return <ErrorConsulta mensaje={consulta.mensaje} onReintentar={recargar} />;
  }

  const r = consulta.datos;
  const diferencia = r.facturadoMes - r.facturadoMesAnterior;
  const porcentaje =
    r.facturadoMesAnterior === 0
      ? null
      : Math.round((diferencia / r.facturadoMesAnterior) * 100);
  const enCurso = r.ordenesPorEstado.ingresada + r.ordenesPorEstado.en_proceso;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-4">
        <Tarjeta
          etiqueta={`Facturado de ${MESES[mes - 1]}`}
          valor={formatARS(r.facturadoMes)}
          detalle={
            porcentaje === null
              ? `El mes anterior: ${formatARS(r.facturadoMesAnterior)}`
              : `${porcentaje >= 0 ? "+" : ""}${porcentaje}% contra ${MESES[(mes + 10) % 12]}`
          }
        />
        <Tarjeta
          etiqueta="Deuda total"
          valor={formatARS(r.deudaTotal)}
          detalle={`${r.doctoresConDeuda} ${r.doctoresConDeuda === 1 ? "doctor" : "doctores"} con saldo`}
          tono={r.deudaTotal > 0 ? "warn" : undefined}
        />
        <Tarjeta
          etiqueta="Órdenes en curso"
          valor={formatNumero(enCurso)}
          detalle={`${formatNumero(r.ordenesPorEstado.terminada)} terminadas esperando entrega`}
        />
        <Tarjeta
          etiqueta="Atrasadas"
          valor={formatNumero(r.ordenesAtrasadas)}
          detalle="Pasó la fecha comprometida"
          tono={r.ordenesAtrasadas > 0 ? "danger" : "ok"}
        />
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
            Doctores con más deuda
          </h2>
          <Button variant="outline" nativeButton={false} render={<Link href="/reportes" />}>
            Ver reportes del mes
          </Button>
        </div>

        <div className="overflow-hidden rounded-md border border-border bg-surface">
          {r.deudores.length === 0 ? (
            <p className="p-4 text-ink-3">Ningún doctor tiene deuda pendiente.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Ficha</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.deudores.map((d) => (
                  <TableRow key={d.doctorId}>
                    <TableCell className="font-mono tabular-nums">{d.ficha}</TableCell>
                    <TableCell>
                      <Link className="underline-offset-2 hover:underline" href={`/cuenta-corriente?doctor=${d.doctorId}`}>
                        {d.doctor}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatARS(d.saldo)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
          Órdenes por estado
        </h2>
        <div className="flex flex-wrap gap-4">
          {(Object.keys(r.ordenesPorEstado) as (keyof typeof r.ordenesPorEstado)[]).map((estado) => (
            <Tarjeta
              key={estado}
              etiqueta={ETIQUETA_ESTADO[estado]}
              valor={formatNumero(r.ordenesPorEstado[estado])}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
