"use client";

import { Plus, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { SelectSimple } from "@/components/formulario/select-simple";
import { ErrorConsulta, PaginaListado } from "@/components/listado/pagina-listado";
import { TablaCargando, TablaNavegable, type Columna } from "@/components/listado/tabla-navegable";
import { filtrarTrabajos, listarTrabajos } from "@/components/trabajos/datos";
import { PanelTrabajo } from "@/components/trabajos/panel-trabajo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAtajoBuscador } from "@/hooks/use-atajos";
import { useConsulta } from "@/hooks/use-consulta";
import { formatARS } from "@/lib/money";
import type { TrabajoConPrecio } from "@/lib/tipos";

export default function TrabajosPage() {
  const buscador = useRef<HTMLInputElement>(null);
  useAtajoBuscador(buscador);

  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState("activos");
  const [panel, setPanel] = useState<{ abierto: boolean; trabajo: TrabajoConPrecio | null }>({
    abierto: false,
    trabajo: null,
  });

  const { consulta, recargar } = useConsulta<TrabajoConPrecio[]>(
    () => listarTrabajos(estado === "todos"),
    [estado],
    "No se pudieron cargar los trabajos. Revisá la conexión y probá de nuevo.",
  );

  const filas = consulta.estado === "listo" ? filtrarTrabajos(consulta.datos, texto) : [];

  const columnas: Columna<TrabajoConPrecio>[] = [
    { clave: "codigo", titulo: "Código", mono: true, ancho: "w-24", render: (t) => t.codigo },
    { clave: "titulo", titulo: "Trabajo", render: (t) => t.titulo },
    {
      clave: "descripcion",
      titulo: "Descripción",
      render: (t) => <span className="block max-w-80 truncate text-ink-2">{t.descripcion ?? "—"}</span>,
    },
    {
      clave: "precio",
      titulo: "Precio vigente",
      numerica: true,
      ancho: "w-40",
      render: (t) => (t.precio === null ? <span className="text-ink-3">sin precio</span> : formatARS(t.precio)),
    },
    {
      clave: "estado",
      titulo: "Estado",
      ancho: "w-28",
      render: (t) => (
        <Badge variant={t.activo ? "ok" : "neutral"}>{t.activo ? "Activo" : "Inactivo"}</Badge>
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
              placeholder="Buscar por código o título…  ( / )"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
            <SelectSimple
              valor={estado}
              onCambio={setEstado}
              opciones={[
                { valor: "activos", etiqueta: "Activos" },
                { valor: "todos", etiqueta: "Todos" },
              ]}
              ancho="w-36"
            />
            <Button variant="outline" nativeButton={false} render={<Link href="/trabajos/precios" />}>
              <TrendingUp data-icon="inline-start" />
              Actualizar precios
            </Button>
          </>
        }
        accionPrimaria={
          <Button onClick={() => setPanel({ abierto: true, trabajo: null })}>
            <Plus data-icon="inline-start" />
            Nuevo trabajo
          </Button>
        }
        pie={
          consulta.estado === "listo" ? (
            <p className="text-xs text-ink-2 tabular-nums">
              {filas.length} {filas.length === 1 ? "trabajo" : "trabajos"}
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
            idDe={(t) => t.id}
            onAbrir={(t) => setPanel({ abierto: true, trabajo: t })}
            vacio={texto ? "Ningún trabajo coincide con la búsqueda." : "Todavía no hay trabajos cargados."}
          />
        )}
      </PaginaListado>

      <PanelTrabajo
        abierto={panel.abierto}
        trabajo={panel.trabajo}
        onCerrar={() => setPanel({ abierto: false, trabajo: null })}
        onGuardado={() => {
          setPanel({ abierto: false, trabajo: null });
          recargar();
        }}
      />
    </>
  );
}
