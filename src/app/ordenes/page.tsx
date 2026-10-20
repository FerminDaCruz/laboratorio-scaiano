"use client";

import { Check, Play, Plus, Receipt } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { listarDoctoresParaCombo } from "@/components/doctores/datos";
import { Combobox } from "@/components/formulario/combobox";
import { SelectSimple } from "@/components/formulario/select-simple";
import { ErrorConsulta, PaginaListado, PiePaginado } from "@/components/listado/pagina-listado";
import { TablaCargando, TablaNavegable, type Columna } from "@/components/listado/tabla-navegable";
import {
  cambiarEstadoOrden,
  estaAtrasada,
  listarOrdenes,
  type FiltrosOrdenes,
  type OrdenConDoctor,
} from "@/components/ordenes/consultas";
import { PanelOrden } from "@/components/ordenes/panel-orden";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAtajoBuscador } from "@/hooks/use-atajos";
import { useConsulta } from "@/hooks/use-consulta";
import { useDebounce } from "@/hooks/use-debounce";
import { formatFechaCorta, formatHora, formatOT } from "@/lib/format";
import { formatARS } from "@/lib/money";
import { toast } from "sonner";
import { ETIQUETA_ESTADO, VARIANTE_ESTADO, type Doctor, type EstadoOrden } from "@/lib/tipos";

const ESTADOS: { valor: FiltrosOrdenes["estado"]; etiqueta: string }[] = [
  { valor: "en_curso", etiqueta: "En curso" },
  { valor: "ingresada", etiqueta: "Ingresadas" },
  { valor: "en_proceso", etiqueta: "En proceso" },
  { valor: "terminada", etiqueta: "Terminadas" },
  { valor: "entregada", etiqueta: "Entregadas" },
  { valor: "anulada", etiqueta: "Anuladas" },
  { valor: "todos", etiqueta: "Todas" },
];

/** El paso siguiente de cada estado, para tenerlo a mano en el listado. */
const SIGUIENTE: Partial<Record<EstadoOrden, { estado: EstadoOrden; etiqueta: string }>> = {
  ingresada: { estado: "en_proceso", etiqueta: "Pasar a en proceso" },
  en_proceso: { estado: "terminada", etiqueta: "Marcar terminada" },
};

/**
 * Acciones de la fila. El detalle se abre al hacer clic en la fila, así que
 * estos botones frenan la propagación para no abrir el panel sin querer.
 */
function AccionesDeFila({ orden, onCambio }: { orden: OrdenConDoctor; onCambio: () => void }) {
  const siguiente = SIGUIENTE[orden.estado];

  async function pasarA(estado: EstadoOrden, etiqueta: string) {
    try {
      await cambiarEstadoOrden(orden.id, estado);
      toast.success(`OT ${formatOT(orden.numero)}: ${etiqueta.toLowerCase()}`);
      onCambio();
    } catch {
      toast.error("No se pudo cambiar el estado. Revisá la conexión y probá de nuevo.", {
        duration: Infinity,
      });
    }
  }

  return (
    <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {siguiente && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={siguiente.etiqueta}
                onClick={() => void pasarA(siguiente.estado, siguiente.etiqueta)}
              />
            }
          >
            {orden.estado === "ingresada" ? <Play /> : <Check />}
          </TooltipTrigger>
          <TooltipContent>{siguiente.etiqueta}</TooltipContent>
        </Tooltip>
      )}

      {orden.estado === "terminada" && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Facturar"
                nativeButton={false}
                render={<Link href={`/remitos/nuevo?ot=${orden.numero}`} />}
              />
            }
          >
            <Receipt />
          </TooltipTrigger>
          <TooltipContent>Facturar</TooltipContent>
        </Tooltip>
      )}
    </span>
  );
}

export default function OrdenesPage() {
  const buscador = useRef<HTMLInputElement>(null);
  useAtajoBuscador(buscador);

  const [texto, setTexto] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [estado, setEstado] = useState<FiltrosOrdenes["estado"]>("en_curso");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [pagina, setPagina] = useState(0);
  const [abierta, setAbierta] = useState<OrdenConDoctor | null>(null);

  const textoDemorado = useDebounce(texto);

  const { consulta: consultaDoctores } = useConsulta<Doctor[]>(
    () => listarDoctoresParaCombo(),
    [],
    "No se pudieron cargar los doctores.",
  );
  const doctores = consultaDoctores.estado === "listo" ? consultaDoctores.datos : [];

  const { consulta, recargar } = useConsulta(
    () => listarOrdenes({ texto: textoDemorado, doctorId, estado, desde, hasta, pagina }),
    [textoDemorado, doctorId, estado, desde, hasta, pagina],
    "No se pudieron cargar las órdenes. Revisá la conexión y probá de nuevo.",
  );

  const alFiltrar = (accion: () => void) => {
    accion();
    setPagina(0);
  };

  const columnas: Columna<OrdenConDoctor>[] = [
    { clave: "numero", titulo: "OT", mono: true, ancho: "w-24", render: (o) => formatOT(o.numero) },
    { clave: "fecha", titulo: "Fecha", ancho: "w-24", render: (o) => formatFechaCorta(o.fecha) },
    { clave: "doctor", titulo: "Doctor", render: (o) => o.doctor?.nombre ?? "—" },
    { clave: "paciente", titulo: "Paciente", render: (o) => o.paciente },
    {
      clave: "estado",
      titulo: "Estado",
      ancho: "w-40",
      render: (o) => (
        <span className="flex gap-1">
          <Badge variant={VARIANTE_ESTADO[o.estado]}>{ETIQUETA_ESTADO[o.estado]}</Badge>
          {estaAtrasada(o) && <Badge variant="danger">Atrasada</Badge>}
        </span>
      ),
    },
    {
      clave: "entrega",
      titulo: "Entrega",
      ancho: "w-32",
      render: (o) =>
        o.entrega_at ? (
          <span className={estaAtrasada(o) ? "text-danger" : undefined}>
            {formatFechaCorta(o.entrega_at)} {formatHora(o.entrega_at)}
          </span>
        ) : (
          "—"
        ),
    },
    { clave: "total", titulo: "Total", numerica: true, ancho: "w-36", render: (o) => formatARS(o.total) },
    {
      clave: "acciones",
      titulo: "",
      ancho: "w-24",
      render: (o) => <AccionesDeFila orden={o} onCambio={recargar} />,
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
              className="w-64"
              placeholder="Buscar por OT o paciente…  ( / )"
              value={texto}
              onChange={(e) => alFiltrar(() => setTexto(e.target.value))}
            />
            <Combobox
              valor={doctorId || null}
              onCambio={(v) => alFiltrar(() => setDoctorId(v ?? ""))}
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
            <SelectSimple
              valor={estado}
              onCambio={(v) => alFiltrar(() => setEstado(v as FiltrosOrdenes["estado"]))}
              opciones={ESTADOS.map((e) => ({ valor: e.valor, etiqueta: e.etiqueta }))}
              ancho="w-40"
            />
            <Input
              type="date"
              className="w-40"
              aria-label="Desde"
              value={desde}
              onChange={(e) => alFiltrar(() => setDesde(e.target.value))}
            />
            <Input
              type="date"
              className="w-40"
              aria-label="Hasta"
              value={hasta}
              onChange={(e) => alFiltrar(() => setHasta(e.target.value))}
            />
          </>
        }
        accionPrimaria={
          <Button nativeButton={false} render={<Link href="/ordenes/nueva" />}>
            <Plus data-icon="inline-start" />
            Nueva orden
          </Button>
        }
        pie={
          consulta.estado === "listo" ? (
            <PiePaginado
              total={consulta.datos.total}
              pagina={pagina}
              cantidadEnPagina={consulta.datos.filas.length}
              onPagina={setPagina}
              etiqueta="órdenes"
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
            idDe={(o) => o.id}
            onAbrir={setAbierta}
            vacio={
              texto || doctorId || desde || hasta
                ? "Ninguna orden coincide con los filtros."
                : "Todavía no hay órdenes cargadas."
            }
          />
        )}
      </PaginaListado>

      <PanelOrden
        orden={abierta}
        onCerrar={() => setAbierta(null)}
        onCambio={() => {
          setAbierta(null);
          recargar();
        }}
      />
    </>
  );
}
