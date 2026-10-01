"use client";

import { Plus } from "lucide-react";
import { useRef, useState } from "react";
import { listarDoctores, listarObrasSociales, type EstadoFiltro } from "@/components/doctores/datos";
import { PanelDoctor } from "@/components/doctores/panel-doctor";
import { SelectSimple } from "@/components/formulario/select-simple";
import {
  ErrorConsulta,
  PaginaListado,
  PiePaginado,
} from "@/components/listado/pagina-listado";
import { TablaCargando, TablaNavegable, type Columna } from "@/components/listado/tabla-navegable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAtajoBuscador } from "@/hooks/use-atajos";
import { useConsulta } from "@/hooks/use-consulta";
import { useDebounce } from "@/hooks/use-debounce";
import type { Doctor, ObraSocial } from "@/lib/tipos";

const ESTADOS: { valor: EstadoFiltro; etiqueta: string }[] = [
  { valor: "activos", etiqueta: "Activos" },
  { valor: "inactivos", etiqueta: "Inactivos" },
  { valor: "todos", etiqueta: "Todos" },
];

export default function DoctoresPage() {
  const buscador = useRef<HTMLInputElement>(null);
  useAtajoBuscador(buscador);

  const [texto, setTexto] = useState("");
  const [obraSocialId, setObraSocialId] = useState("");
  const [estado, setEstado] = useState<EstadoFiltro>("activos");
  const [pagina, setPagina] = useState(0);
  const [panel, setPanel] = useState<{ abierto: boolean; doctor: Doctor | null }>({
    abierto: false,
    doctor: null,
  });

  const textoDemorado = useDebounce(texto);

  const { consulta: consultaObras } = useConsulta<ObraSocial[]>(
    () => listarObrasSociales(),
    [],
    "No se pudieron cargar las obras sociales.",
  );
  const obrasSociales = consultaObras.estado === "listo" ? consultaObras.datos : [];

  const { consulta, recargar } = useConsulta(
    () => listarDoctores({ texto: textoDemorado, obraSocialId, estado, pagina }),
    [textoDemorado, obraSocialId, estado, pagina],
    "No se pudieron cargar los doctores. Revisá la conexión y probá de nuevo.",
  );

  const columnas: Columna<Doctor>[] = [
    { clave: "ficha", titulo: "Ficha", mono: true, numerica: true, ancho: "w-20", render: (d) => d.ficha },
    { clave: "nombre", titulo: "Nombre", render: (d) => d.nombre },
    { clave: "localidad", titulo: "Localidad", render: (d) => d.localidad ?? "—" },
    { clave: "telefono", titulo: "Teléfono", render: (d) => d.telefono ?? "—" },
    {
      clave: "obra",
      titulo: "Obra social",
      render: (d) => obrasSociales.find((o) => o.id === d.obra_social_id)?.nombre ?? "—",
    },
    {
      clave: "estado",
      titulo: "Estado",
      ancho: "w-28",
      render: (d) => (
        <Badge variant={d.activo ? "ok" : "neutral"}>{d.activo ? "Activo" : "Inactivo"}</Badge>
      ),
    },
  ];

  return (
    <>
      <PaginaListado
        filtros={
          <>
            <Input
              ref={buscador}
              autoFocus
              className="w-72"
              placeholder="Buscar por nombre o ficha…  ( / )"
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                setPagina(0);
              }}
            />
            <SelectSimple
              valor={estado}
              onCambio={(v) => {
                setEstado(v as EstadoFiltro);
                setPagina(0);
              }}
              opciones={ESTADOS}
              ancho="w-36"
            />
            <SelectSimple
              valor={obraSocialId}
              onCambio={(v) => {
                setObraSocialId(v);
                setPagina(0);
              }}
              opciones={[
                { valor: "", etiqueta: "Todas las obras sociales" },
                ...obrasSociales.map((o) => ({ valor: String(o.id), etiqueta: o.nombre })),
              ]}
              ancho="w-56"
              placeholder="Todas las obras sociales"
            />
          </>
        }
        accionPrimaria={
          <Button onClick={() => setPanel({ abierto: true, doctor: null })}>
            <Plus data-icon="inline-start" />
            Nuevo doctor
          </Button>
        }
        pie={
          consulta.estado === "listo" ? (
            <PiePaginado
              total={consulta.datos.total}
              pagina={pagina}
              cantidadEnPagina={consulta.datos.filas.length}
              onPagina={setPagina}
              etiqueta="doctores"
            />
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
            filas={consulta.datos.filas}
            idDe={(d) => d.id}
            onAbrir={(d) => setPanel({ abierto: true, doctor: d })}
            vacio={
              texto || obraSocialId || estado !== "activos"
                ? "Ningún doctor coincide con los filtros."
                : "Todavía no hay doctores cargados."
            }
          />
        )}
      </PaginaListado>

      <PanelDoctor
        abierto={panel.abierto}
        doctor={panel.doctor}
        obrasSociales={obrasSociales}
        onCerrar={() => setPanel({ abierto: false, doctor: null })}
        onGuardado={() => {
          setPanel({ abierto: false, doctor: null });
          recargar();
        }}
      />
    </>
  );
}
