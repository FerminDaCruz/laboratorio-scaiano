"use client";

import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { DocumentoRemito } from "@/components/documentos/remito";
import { ErrorConsulta } from "@/components/listado/pagina-listado";
import {
  buscarRemitoPorNumero,
  listarLineasDeRemito,
  resumenDeCuenta,
  type LineaRemito,
  type RemitoConDoctor,
  type ResumenCuenta,
} from "@/components/remitos/consultas";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useConsulta } from "@/hooks/use-consulta";
import { cn } from "@/lib/utils";

type Ticket = { remito: RemitoConDoctor; lineas: LineaRemito[]; cuenta: ResumenCuenta };
type Datos = { tickets: Ticket[]; faltantes: number[] };

export default function DocumentoRemitoPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-80" />}>
      <RemitoImprimible />
    </Suspense>
  );
}

/**
 * Uno o varios remitos: `?remito=12` o `?remitos=12,13,14`.
 * Con varios, cada uno sale en su propio ticket, uno detrás del otro en la misma impresión.
 */
function RemitoImprimible() {
  const parametros = useSearchParams();
  const pedidos = parametros.get("remitos") ?? parametros.get("remito") ?? "";
  const numeros = pedidos
    .split(",")
    .map((n) => Number(n.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  const clave = numeros.join(",");

  const { consulta, recargar } = useConsulta<Datos>(
    async () => {
      const tickets: Ticket[] = [];
      const faltantes: number[] = [];
      // De a uno y en orden: así el saldo de cada ticket sale igual que si se imprimiera solo.
      for (const numero of numeros) {
        const remito = await buscarRemitoPorNumero(numero);
        if (!remito) {
          faltantes.push(numero);
          continue;
        }
        const [lineas, cuenta] = await Promise.all([
          listarLineasDeRemito(remito.id),
          resumenDeCuenta(remito.doctor_id, remito.fecha, remito.total, remito.id),
        ]);
        if (cuenta === null) faltantes.push(numero);
        else tickets.push({ remito, lineas, cuenta });
      }
      return { tickets, faltantes };
    },
    [clave],
    "No se pudo cargar el remito. Revisá la conexión y probá de nuevo.",
  );

  const tickets = consulta.estado === "listo" ? consulta.datos.tickets : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 print:hidden">
        <Button variant="ghost" nativeButton={false} render={<Link href="/remitos" />}>
          <ArrowLeft data-icon="inline-start" />
          Volver a remitos
        </Button>
        <Button onClick={() => window.print()} disabled={tickets.length === 0}>
          <Printer data-icon="inline-start" />
          {tickets.length > 1 ? `Imprimir los ${tickets.length} remitos` : "Imprimir o guardar en PDF"}
        </Button>
      </div>

      {consulta.estado === "cargando" && <Skeleton className="h-96 w-80" />}
      {consulta.estado === "error" && (
        <ErrorConsulta mensaje={consulta.mensaje} onReintentar={recargar} />
      )}
      {consulta.estado === "listo" && (
        <>
          {numeros.length === 0 && <p className="text-ink-3">No existe el remito pedido.</p>}
          {consulta.datos.faltantes.length > 0 && (
            <p className="text-ink-3 print:hidden">
              {consulta.datos.faltantes.length === 1
                ? `No existe el remito ${consulta.datos.faltantes[0]}.`
                : `No existen los remitos ${consulta.datos.faltantes.join(", ")}.`}
            </p>
          )}
          {tickets.map((t, i) => (
            <div
              key={t.remito.id}
              className={cn(
                "w-fit border border-border bg-surface shadow-sm print:border-0 print:shadow-none",
                // Un corte entre ticket y ticket, sin dejar uno en blanco al final.
                i < tickets.length - 1 && "print:break-after-page",
              )}
            >
              <DocumentoRemito remito={t.remito} lineas={t.lineas} cuenta={t.cuenta} />
            </div>
          ))}
        </>
      )}
    </div>
  );
}
