"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { listarDoctoresParaCombo } from "@/components/doctores/datos";
import { Combobox } from "@/components/formulario/combobox";
import { ErrorConsulta, PaginaListado, PiePaginado } from "@/components/listado/pagina-listado";
import { TablaCargando, TablaNavegable, type Columna } from "@/components/listado/tabla-navegable";
import { listarRemitos, type RemitoConDoctor } from "@/components/remitos/consultas";
import { PanelRemito } from "@/components/remitos/panel-remito";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConsulta } from "@/hooks/use-consulta";
import { formatFechaCorta, formatNumero, formatRemito } from "@/lib/format";
import { formatARS } from "@/lib/money";
import type { Doctor } from "@/lib/tipos";

export default function RemitosPage() {
  const [doctorId, setDoctorId] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [pagina, setPagina] = useState(0);
  const [abierto, setAbierto] = useState<RemitoConDoctor | null>(null);

  const { consulta: consultaDoctores } = useConsulta<Doctor[]>(
    () => listarDoctoresParaCombo(),
    [],
    "No se pudieron cargar los doctores.",
  );
  const doctores = consultaDoctores.estado === "listo" ? consultaDoctores.datos : [];

  const { consulta, recargar } = useConsulta(
    () => listarRemitos({ doctorId, desde, hasta, pagina }),
    [doctorId, desde, hasta, pagina],
    "No se pudieron cargar los remitos. Revisá la conexión y probá de nuevo.",
  );

  const columnas: Columna<RemitoConDoctor>[] = [
    { clave: "numero", titulo: "Remito", mono: true, ancho: "w-28", render: (r) => formatRemito(r.numero) },
    { clave: "fecha", titulo: "Fecha", ancho: "w-24", render: (r) => formatFechaCorta(r.fecha) },
    { clave: "doctor", titulo: "Doctor", render: (r) => r.doctor?.nombre ?? "—" },
    { clave: "lineas", titulo: "Órdenes", numerica: true, ancho: "w-24", render: (r) => formatNumero(r.lineas) },
    { clave: "total", titulo: "Total", numerica: true, ancho: "w-36", render: (r) => formatARS(r.total) },
    {
      clave: "estado",
      titulo: "Estado",
      ancho: "w-28",
      render: (r) => (
        <Badge variant={r.anulado_en ? "danger" : "ok"}>{r.anulado_en ? "Anulado" : "Emitido"}</Badge>
      ),
    },
  ];

  return (
    <>
      <PaginaListado
        filtros={
          <>
            <Combobox
              valor={doctorId || null}
              onCambio={(v) => {
                setDoctorId(v ?? "");
                setPagina(0);
              }}
              ancho="w-56"
              placeholder="Todos los doctores"
              opciones={[
                { valor: "", etiqueta: "Todos los doctores" },
                ...doctores.map((d) => ({
                  valor: String(d.id),
                  etiqueta: d.nombre,
                  busqueda: String(d.ficha),
                  detalle: `ficha ${d.ficha}`,
                })),
              ]}
            />
            <Input
              type="date"
              className="w-40"
              aria-label="Desde"
              value={desde}
              onChange={(e) => {
                setDesde(e.target.value);
                setPagina(0);
              }}
            />
            <Input
              type="date"
              className="w-40"
              aria-label="Hasta"
              value={hasta}
              onChange={(e) => {
                setHasta(e.target.value);
                setPagina(0);
              }}
            />
          </>
        }
        accionPrimaria={
          <Button nativeButton={false} render={<Link href="/remitos/nuevo" />}>
            <Plus data-icon="inline-start" />
            Nuevo remito
          </Button>
        }
        pie={
          consulta.estado === "listo" ? (
            <PiePaginado
              total={consulta.datos.total}
              pagina={pagina}
              cantidadEnPagina={consulta.datos.filas.length}
              onPagina={setPagina}
              etiqueta="remitos"
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
            idDe={(r) => r.id}
            onAbrir={setAbierto}
            vacio={
              doctorId || desde || hasta
                ? "Ningún remito coincide con los filtros."
                : "Todavía no se emitieron remitos."
            }
          />
        )}
      </PaginaListado>

      <PanelRemito
        remito={abierto}
        onCerrar={() => setAbierto(null)}
        onCambio={() => {
          setAbierto(null);
          recargar();
        }}
      />
    </>
  );
}
