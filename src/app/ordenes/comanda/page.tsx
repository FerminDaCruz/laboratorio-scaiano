"use client";

import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Comanda } from "@/components/documentos/comanda";
import { ErrorConsulta } from "@/components/listado/pagina-listado";
import {
  buscarOrdenPorNumero,
  listarItemsDeOrden,
  type ItemDeOrden,
  type OrdenConDoctor,
} from "@/components/ordenes/consultas";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useConsulta } from "@/hooks/use-consulta";
import { ANCHO_TICKET_MM } from "@/lib/impresion";

export default function ComandaPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-80" />}>
      <ComandaDeOT />
    </Suspense>
  );
}

function ComandaDeOT() {
  // Sitio estático: el detalle va por query param, no por ruta dinámica.
  const numero = Number(useSearchParams().get("ot"));

  const { consulta, recargar } = useConsulta<{
    orden: OrdenConDoctor | null;
    items: ItemDeOrden[];
  }>(
    async () => {
      if (!Number.isInteger(numero) || numero <= 0) return { orden: null, items: [] };
      const orden = await buscarOrdenPorNumero(numero);
      const items = orden ? await listarItemsDeOrden(orden.id) : [];
      return { orden, items };
    },
    [numero],
    "No se pudo cargar la comanda. Revisá la conexión y probá de nuevo.",
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 print:hidden">
        <Button variant="ghost" nativeButton={false} render={<Link href="/ordenes" />}>
          <ArrowLeft data-icon="inline-start" />
          Volver a órdenes
        </Button>
        <Button onClick={() => window.print()} disabled={consulta.estado !== "listo"}>
          <Printer data-icon="inline-start" />
          Imprimir o guardar en PDF
        </Button>
      </div>

      {consulta.estado === "cargando" && <Skeleton className="h-64 w-80" />}
      {consulta.estado === "error" && (
        <ErrorConsulta mensaje={consulta.mensaje} onReintentar={recargar} />
      )}
      {consulta.estado === "listo" &&
        (consulta.datos.orden === null ? (
          <p className="text-ink-3">No existe la orden {numero || "pedida"}.</p>
        ) : (
          <div className="w-fit border border-border bg-surface shadow-sm print:border-0 print:shadow-none">
            <Comanda orden={consulta.datos.orden} items={consulta.datos.items} />
          </div>
        ))}

      <p className="text-xs text-ink-3 print:hidden">
        Ancho de ticket configurado: {ANCHO_TICKET_MM} mm. El valor definitivo se confirma en E13,
        cuando esté la impresora.
      </p>
    </div>
  );
}
