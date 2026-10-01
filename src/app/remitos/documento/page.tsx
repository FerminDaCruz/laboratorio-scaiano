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

type Datos = { remito: RemitoConDoctor | null; lineas: LineaRemito[]; cuenta: ResumenCuenta | null };

export default function DocumentoRemitoPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-80" />}>
      <RemitoImprimible />
    </Suspense>
  );
}

function RemitoImprimible() {
  const numero = Number(useSearchParams().get("remito"));

  const { consulta, recargar } = useConsulta<Datos>(
    async () => {
      if (!Number.isInteger(numero) || numero <= 0) return { remito: null, lineas: [], cuenta: null };
      const remito = await buscarRemitoPorNumero(numero);
      if (!remito) return { remito: null, lineas: [], cuenta: null };
      const [lineas, cuenta] = await Promise.all([
        listarLineasDeRemito(remito.id),
        resumenDeCuenta(remito.doctor_id, remito.fecha, remito.total, remito.id),
      ]);
      return { remito, lineas, cuenta };
    },
    [numero],
    "No se pudo cargar el remito. Revisá la conexión y probá de nuevo.",
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 print:hidden">
        <Button variant="ghost" nativeButton={false} render={<Link href="/remitos" />}>
          <ArrowLeft data-icon="inline-start" />
          Volver a remitos
        </Button>
        <Button onClick={() => window.print()} disabled={consulta.estado !== "listo"}>
          <Printer data-icon="inline-start" />
          Imprimir o guardar en PDF
        </Button>
      </div>

      {consulta.estado === "cargando" && <Skeleton className="h-96 w-80" />}
      {consulta.estado === "error" && (
        <ErrorConsulta mensaje={consulta.mensaje} onReintentar={recargar} />
      )}
      {consulta.estado === "listo" &&
        (consulta.datos.remito === null || consulta.datos.cuenta === null ? (
          <p className="text-ink-3">No existe el remito {numero || "pedido"}.</p>
        ) : (
          <div className="w-fit border border-border bg-surface shadow-sm print:border-0 print:shadow-none">
            <DocumentoRemito
              remito={consulta.datos.remito}
              lineas={consulta.datos.lineas}
              cuenta={consulta.datos.cuenta}
            />
          </div>
        ))}
    </div>
  );
}
