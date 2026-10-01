"use client";

import { Plus } from "lucide-react";
import { useRef, useState } from "react";
import { listarObrasSociales } from "@/components/doctores/datos";
import { ErrorConsulta, PaginaListado } from "@/components/listado/pagina-listado";
import { TablaCargando, TablaNavegable, type Columna } from "@/components/listado/tabla-navegable";
import { PanelObraSocial } from "@/components/obras-sociales/panel-obra-social";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAtajoBuscador } from "@/hooks/use-atajos";
import { useConsulta } from "@/hooks/use-consulta";
import { normalizar } from "@/lib/texto";
import type { ObraSocial } from "@/lib/tipos";

export default function ObrasSocialesPage() {
  const buscador = useRef<HTMLInputElement>(null);
  useAtajoBuscador(buscador);

  const [texto, setTexto] = useState("");
  const [panel, setPanel] = useState<{ abierto: boolean; obraSocial: ObraSocial | null }>({
    abierto: false,
    obraSocial: null,
  });

  const { consulta, recargar } = useConsulta<ObraSocial[]>(
    () => listarObrasSociales(),
    [],
    "No se pudieron cargar las obras sociales. Revisá la conexión y probá de nuevo.",
  );

  const filtradas =
    consulta.estado === "listo"
      ? consulta.datos.filter((o) =>
          normalizar(`${o.nombre} ${o.codigo}`).includes(normalizar(texto)),
        )
      : [];

  const columnas: Columna<ObraSocial>[] = [
    { clave: "codigo", titulo: "Código", mono: true, ancho: "w-32", render: (o) => o.codigo },
    { clave: "nombre", titulo: "Nombre", render: (o) => o.nombre },
    {
      clave: "estado",
      titulo: "Estado",
      ancho: "w-28",
      render: (o) => (
        <Badge variant={o.activa ? "ok" : "neutral"}>{o.activa ? "Activa" : "Inactiva"}</Badge>
      ),
    },
  ];

  return (
    <>
      <PaginaListado
        filtros={
          <Input
            ref={buscador}
            autoFocus
            className="w-72"
            placeholder="Buscar obra social…  ( / )"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        }
        accionPrimaria={
          <Button onClick={() => setPanel({ abierto: true, obraSocial: null })}>
            <Plus data-icon="inline-start" />
            Nueva obra social
          </Button>
        }
        pie={
          consulta.estado === "listo" ? (
            <p className="text-xs text-ink-2 tabular-nums">
              {filtradas.length} {filtradas.length === 1 ? "obra social" : "obras sociales"}
            </p>
          ) : null
        }
      >
        {consulta.estado === "cargando" && <TablaCargando columnas={columnas.length} filas={5} />}
        {consulta.estado === "error" && (
          <ErrorConsulta mensaje={consulta.mensaje} onReintentar={recargar} />
        )}
        {consulta.estado === "listo" && (
          <TablaNavegable
            columnas={columnas}
            filas={filtradas}
            idDe={(o) => o.id}
            onAbrir={(o) => setPanel({ abierto: true, obraSocial: o })}
            vacio={texto ? "Ninguna obra social coincide." : "Todavía no hay obras sociales cargadas."}
          />
        )}
      </PaginaListado>

      <PanelObraSocial
        abierto={panel.abierto}
        obraSocial={panel.obraSocial}
        onCerrar={() => setPanel({ abierto: false, obraSocial: null })}
        onGuardado={() => {
          setPanel({ abierto: false, obraSocial: null });
          recargar();
        }}
      />
    </>
  );
}
