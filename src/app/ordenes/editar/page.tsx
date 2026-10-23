"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { listarDoctoresParaCombo, listarObrasSociales } from "@/components/doctores/datos";
import { ErrorConsulta } from "@/components/listado/pagina-listado";
import { buscarOrdenPorNumero, listarItemsDeOrden } from "@/components/ordenes/consultas";
import { FormularioOrden, type OrdenEditable } from "@/components/ordenes/formulario-orden";
import { listarTrabajos } from "@/components/trabajos/datos";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useConsulta } from "@/hooks/use-consulta";
import { formatOT } from "@/lib/format";
import type { Doctor, ObraSocial, TrabajoConPrecio } from "@/lib/tipos";

type Datos = {
  orden: OrdenEditable | null;
  motivo: "remitida" | "anulada" | null;
  doctores: Doctor[];
  trabajos: TrabajoConPrecio[];
  obrasSociales: ObraSocial[];
};

export default function EditarOrdenPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full max-w-[640px]" />}>
      <EditarOrden />
    </Suspense>
  );
}

function EditarOrden() {
  const router = useRouter();
  const numero = Number(useSearchParams().get("ot"));

  const { consulta, recargar } = useConsulta<Datos>(
    async () => {
      const [doctores, trabajos, obrasSociales] = await Promise.all([
        listarDoctoresParaCombo(),
        listarTrabajos(true),
        listarObrasSociales(),
      ]);

      if (!Number.isInteger(numero) || numero <= 0) {
        return { orden: null, motivo: null, doctores, trabajos, obrasSociales };
      }

      const orden = await buscarOrdenPorNumero(numero);
      if (!orden) return { orden: null, motivo: null, doctores, trabajos, obrasSociales };
      if (orden.remito_id !== null || orden.estado === "entregada") {
        return { orden: null, motivo: "remitida", doctores, trabajos, obrasSociales };
      }
      if (orden.estado === "anulada") {
        return { orden: null, motivo: "anulada", doctores, trabajos, obrasSociales };
      }

      const items = await listarItemsDeOrden(orden.id);
      return {
        orden: {
          id: orden.id,
          numero: orden.numero,
          doctor_id: orden.doctor_id,
          paciente: orden.paciente,
          sexo: orden.sexo,
          edad: orden.edad,
          obra_social_id: orden.obra_social_id,
          color: orden.color,
          fecha: orden.fecha,
          entrega_at: orden.entrega_at,
          indicaciones: orden.indicaciones,
          items: items.map((i) => ({
            trabajo_id: i.trabajo_id,
            cantidad: i.cantidad,
            piezas: i.piezas,
          })),
          ajuste: orden.ajuste,
          ajuste_pct: orden.ajuste_pct,
          ajuste_motivo: orden.ajuste_motivo,
        },
        motivo: null,
        doctores,
        trabajos,
        obrasSociales,
      };
    },
    [numero],
    "No se pudo cargar la orden. Revisá la conexión y probá de nuevo.",
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button variant="ghost" nativeButton={false} render={<Link href="/ordenes" />}>
          <ArrowLeft data-icon="inline-start" />
          Volver a órdenes
        </Button>
      </div>

      {consulta.estado === "cargando" && <Skeleton className="h-64 w-full max-w-[640px]" />}
      {consulta.estado === "error" && (
        <ErrorConsulta mensaje={consulta.mensaje} onReintentar={recargar} />
      )}

      {consulta.estado === "listo" &&
        (consulta.datos.orden === null ? (
          <p className="text-ink-3">
            {consulta.datos.motivo === "remitida"
              ? `La OT ${formatOT(numero)} ya está en un remito. Para cambiarla hay que corregir el remito desde la pantalla de Remitos.`
              : consulta.datos.motivo === "anulada"
                ? `La OT ${formatOT(numero)} está anulada.`
                : `No existe la orden ${numero || "pedida"}.`}
          </p>
        ) : (
          <FormularioOrden
            orden={consulta.datos.orden}
            doctores={consulta.datos.doctores}
            trabajos={consulta.datos.trabajos}
            obrasSociales={consulta.datos.obrasSociales}
            onGuardada={() => router.push("/ordenes")}
            onCancelar={() => router.push("/ordenes")}
          />
        ))}
    </div>
  );
}
