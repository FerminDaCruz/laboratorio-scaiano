"use client";

import { useState } from "react";
import { listarDoctoresParaCombo, listarObrasSociales } from "@/components/doctores/datos";
import { ErrorConsulta } from "@/components/listado/pagina-listado";
import { FormularioOrden } from "@/components/ordenes/formulario-orden";
import { listarTrabajos } from "@/components/trabajos/datos";
import { Skeleton } from "@/components/ui/skeleton";
import { useConsulta } from "@/hooks/use-consulta";
import { formatOT } from "@/lib/format";
import type { Doctor, ObraSocial, TrabajoConPrecio } from "@/lib/tipos";

type Catalogos = [Doctor[], TrabajoConPrecio[], ObraSocial[]];

export default function NuevaOrdenPage() {
  const [ultima, setUltima] = useState<{ id: number; numero: number } | null>(null);

  // El catálogo se precarga una sola vez: tipear no toca la red.
  const { consulta, recargar } = useConsulta<Catalogos>(
    () => Promise.all([listarDoctoresParaCombo(), listarTrabajos(false), listarObrasSociales(true)]),
    [],
    "No se pudieron cargar los doctores y trabajos. Revisá la conexión y probá de nuevo.",
  );

  return (
    <div className="flex flex-col gap-6">
      {ultima && (
        <p className="flex items-center gap-3 rounded-md border border-ok bg-ok-soft px-3 py-2 text-ok">
          <span className="font-semibold">Orden creada</span>
          <span className="font-mono">OT {formatOT(ultima.numero)}</span>
          {/* TODO(E7): acá va el botón para imprimir la comanda. */}
        </p>
      )}

      {consulta.estado === "cargando" && (
        <div className="flex max-w-[640px] flex-col gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      )}

      {consulta.estado === "error" && (
        <ErrorConsulta mensaje={consulta.mensaje} onReintentar={recargar} />
      )}

      {consulta.estado === "listo" &&
        (consulta.datos[0].length === 0 || consulta.datos[1].length === 0 ? (
          <p className="text-ink-3">
            Antes de cargar una orden hace falta tener doctores y trabajos con precio cargados.
          </p>
        ) : (
          <FormularioOrden
            doctores={consulta.datos[0]}
            trabajos={consulta.datos[1]}
            obrasSociales={consulta.datos[2]}
            onCreada={setUltima}
          />
        ))}
    </div>
  );
}
