"use client";

import { ArrowLeft, Banknote } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import {
  deudasPendientes,
  ETIQUETA_ESTADO_CUENTA,
  listarCuentas,
  movimientosDeDoctor,
  VARIANTE_ESTADO_CUENTA,
  type CuentaDoctor,
  type DeudaPendiente,
  type MovimientoConImputado,
} from "@/components/cc/consultas";
import { ErrorConsulta, PaginaListado } from "@/components/listado/pagina-listado";
import { TablaCargando, TablaNavegable, type Columna } from "@/components/listado/tabla-navegable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAtajoBuscador } from "@/hooks/use-atajos";
import { useConsulta } from "@/hooks/use-consulta";
import { formatFechaCorta, formatRemito } from "@/lib/format";
import { formatARS } from "@/lib/money";
import { normalizar } from "@/lib/texto";
import { ETIQUETA_TIPO_MOVIMIENTO } from "@/lib/tipos";

export default function CuentaCorrientePage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <CuentaCorriente />
    </Suspense>
  );
}

function CuentaCorriente() {
  const doctorId = Number(useSearchParams().get("doctor"));
  return Number.isInteger(doctorId) && doctorId > 0 ? (
    <DetalleCuenta doctorId={doctorId} />
  ) : (
    <ListadoCuentas />
  );
}

function ListadoCuentas() {
  const buscador = useRef<HTMLInputElement>(null);
  useAtajoBuscador(buscador);
  const [texto, setTexto] = useState("");

  const { consulta, recargar } = useConsulta<CuentaDoctor[]>(
    () => listarCuentas(),
    [],
    "No se pudieron cargar las cuentas. Revisá la conexión y probá de nuevo.",
  );

  const filas =
    consulta.estado === "listo"
      ? consulta.datos.filter((c) =>
          normalizar(`${c.doctor.nombre} ${c.doctor.ficha}`).includes(normalizar(texto)),
        )
      : [];

  const totalDeuda = filas.reduce((suma, c) => suma + Math.max(c.saldo, 0), 0);

  const columnas: Columna<CuentaDoctor>[] = [
    { clave: "ficha", titulo: "Ficha", mono: true, numerica: true, ancho: "w-20", render: (c) => c.doctor.ficha },
    { clave: "doctor", titulo: "Doctor", render: (c) => c.doctor.nombre },
    {
      clave: "estado",
      titulo: "Estado",
      ancho: "w-44",
      render: (c) => (
        <Badge variant={VARIANTE_ESTADO_CUENTA[c.estado]}>{ETIQUETA_ESTADO_CUENTA[c.estado]}</Badge>
      ),
    },
    { clave: "d30", titulo: "0-30", numerica: true, ancho: "w-32", render: (c) => formatARS(c.antiguedad.dias_0_30) },
    { clave: "d60", titulo: "31-60", numerica: true, ancho: "w-32", render: (c) => formatARS(c.antiguedad.dias_31_60) },
    { clave: "d90", titulo: "61-90", numerica: true, ancho: "w-32", render: (c) => formatARS(c.antiguedad.dias_61_90) },
    { clave: "d90mas", titulo: "+90", numerica: true, ancho: "w-32", render: (c) => formatARS(c.antiguedad.dias_mas_90) },
    {
      clave: "saldo",
      titulo: "Saldo",
      numerica: true,
      ancho: "w-36",
      render: (c) => <span className={c.saldo < 0 ? "text-ok" : undefined}>{formatARS(c.saldo)}</span>,
    },
  ];

  return (
    <PaginaListado
      filtros={
        <Input
          ref={buscador}
          autoFocus
          className="w-72"
          placeholder="Buscar doctor…  ( / )"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
      }
      accionPrimaria={
        <Button nativeButton={false} render={<Link href="/pagos" />}>
          <Banknote data-icon="inline-start" />
          Registrar pago
        </Button>
      }
      pie={
        consulta.estado === "listo" ? (
          <p className="flex items-baseline gap-3 text-xs text-ink-2">
            <span>{filas.length} doctores</span>
            <span className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
              Deuda total
            </span>
            <span className="text-sm font-semibold text-ink tabular-nums">{formatARS(totalDeuda)}</span>
          </p>
        ) : null
      }
    >
      {consulta.estado === "cargando" && <TablaCargando columnas={columnas.length} />}
      {consulta.estado === "error" && (
        <ErrorConsulta mensaje={consulta.mensaje} onReintentar={recargar} />
      )}
      {consulta.estado === "listo" && (
        <TablaNavegable
          columnas={columnas}
          filas={filas}
          idDe={(c) => c.doctor.id}
          onAbrir={(c) => {
            window.location.href = `/cuenta-corriente?doctor=${c.doctor.id}`;
          }}
          vacio="Ningún doctor coincide con la búsqueda."
        />
      )}
    </PaginaListado>
  );
}

function DetalleCuenta({ doctorId }: { doctorId: number }) {
  const { consulta, recargar } = useConsulta<{
    movimientos: MovimientoConImputado[];
    deudas: DeudaPendiente[];
    cuentas: CuentaDoctor[];
  }>(
    async () => {
      const [movimientos, deudas, cuentas] = await Promise.all([
        movimientosDeDoctor(doctorId),
        deudasPendientes(doctorId),
        listarCuentas(),
      ]);
      return { movimientos, deudas, cuentas };
    },
    [doctorId],
    "No se pudo cargar la cuenta. Revisá la conexión y probá de nuevo.",
  );

  if (consulta.estado === "cargando") return <Skeleton className="h-64 w-full" />;
  if (consulta.estado === "error")
    return <ErrorConsulta mensaje={consulta.mensaje} onReintentar={recargar} />;

  const cuenta = consulta.datos.cuentas.find((c) => c.doctor.id === doctorId);
  let acumulado = 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" nativeButton={false} render={<Link href="/cuenta-corriente" />}>
          <ArrowLeft data-icon="inline-start" />
          Volver a cuentas
        </Button>
        <Button nativeButton={false} render={<Link href={`/pagos?doctor=${doctorId}`} />}>
          <Banknote data-icon="inline-start" />
          Registrar pago
        </Button>
      </div>

      {cuenta && (
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="text-lg font-semibold">{cuenta.doctor.nombre}</h2>
          <Badge variant={VARIANTE_ESTADO_CUENTA[cuenta.estado]}>
            {ETIQUETA_ESTADO_CUENTA[cuenta.estado]}
          </Badge>
          <span className="flex items-baseline gap-2">
            <span className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Saldo</span>
            <span className={`text-2xl font-semibold tabular-nums ${cuenta.saldo < 0 ? "text-ok" : ""}`}>
              {formatARS(cuenta.saldo)}
            </span>
          </span>
        </div>
      )}

      <section className="flex flex-col gap-3">
        <h3 className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Impago</h3>
        <div className="overflow-hidden rounded-md border border-border bg-surface">
          {consulta.datos.deudas.length === 0 ? (
            <p className="p-4 text-ink-3">No hay deudas pendientes.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Fecha</TableHead>
                  <TableHead className="w-28">Remito</TableHead>
                  <TableHead>Pacientes</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                  <TableHead className="text-right">Pendiente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consulta.datos.deudas.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{formatFechaCorta(d.fecha)}</TableCell>
                    <TableCell className="font-mono">
                      {d.remitoNumero ? formatRemito(d.remitoNumero) : "—"}
                    </TableCell>
                    <TableCell>{d.pacientes.join(" · ") || "—"}</TableCell>
                    <TableCell className="text-right text-ink-2 tabular-nums">
                      {formatARS(d.importe)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatARS(d.pendiente)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <h3 className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
          Libro mayor
        </h3>
        <div className="overflow-hidden rounded-md border border-border bg-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Fecha</TableHead>
                <TableHead className="w-36">Tipo</TableHead>
                <TableHead>Referencia</TableHead>
                <TableHead className="text-right">Debe</TableHead>
                <TableHead className="text-right">Haber</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consulta.datos.movimientos.map((m) => {
                acumulado += m.importe;
                return (
                  <TableRow key={m.id}>
                    <TableCell>{formatFechaCorta(m.fecha)}</TableCell>
                    <TableCell>{ETIQUETA_TIPO_MOVIMIENTO[m.tipo]}</TableCell>
                    <TableCell>{m.referencia ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.importe > 0 ? formatARS(m.importe) : ""}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.importe < 0 ? formatARS(-m.importe) : ""}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatARS(acumulado)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-ink-3">
          Los asientos no se editan ni se borran: un error se corrige con un asiento inverso.
        </p>
      </section>
    </div>
  );
}
