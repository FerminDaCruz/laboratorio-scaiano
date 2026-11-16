"use client";

import { Plus, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { listarDoctoresParaCombo } from "@/components/doctores/datos";
import { Campo } from "@/components/formulario/campo";
import { Combobox } from "@/components/formulario/combobox";
import { ErrorConsulta } from "@/components/listado/pagina-listado";
import { emitirRemito } from "@/components/remitos/consultas";
import {
  buscarOrdenPorNumero,
  listarOrdenesSinFacturar,
  type OrdenConDoctor,
} from "@/components/ordenes/consultas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useConsulta } from "@/hooks/use-consulta";
import { formatFechaCorta, formatOT, formatRemito } from "@/lib/format";
import { formatARS } from "@/lib/money";
import { interpretarEscaneo, useFocoDeEscaneo } from "@/lib/scanner";
import type { Doctor } from "@/lib/tipos";

const hoy = () => new Date().toISOString().slice(0, 10);

export default function NuevoRemitoPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <NuevoRemito />
    </Suspense>
  );
}

function NuevoRemito() {
  const router = useRouter();
  const parametros = useSearchParams();
  const campo = useRef<HTMLInputElement>(null);
  useFocoDeEscaneo(campo);

  const [texto, setTexto] = useState("");
  const [doctorFiltro, setDoctorFiltro] = useState("");
  const [fecha, setFecha] = useState(hoy());
  const [bandeja, setBandeja] = useState<OrdenConDoctor[]>([]);
  const [emitiendo, setEmitiendo] = useState(false);

  // Cada comanda de la bandeja sale en su propio remito, así que se pueden mezclar
  // doctores. Los descuentos y los plus se ponen en cada trabajo de la orden.
  const total = bandeja.reduce((suma, o) => suma + o.total, 0);
  const doctorEfectivo = doctorFiltro;

  const { consulta: consultaDoctores } = useConsulta<Doctor[]>(
    () => listarDoctoresParaCombo(),
    [],
    "No se pudieron cargar los doctores.",
  );
  const doctores = consultaDoctores.estado === "listo" ? consultaDoctores.datos : [];

  const { consulta: consultaPendientes, recargar: recargarPendientes } = useConsulta<
    OrdenConDoctor[]
  >(
    () => listarOrdenesSinFacturar(doctorEfectivo === "" ? null : Number(doctorEfectivo)),
    [doctorEfectivo],
    "No se pudieron cargar las comandas sin facturar.",
  );
  // Lo que ya está en la bandeja no se ofrece de nuevo.
  const pendientes = (consultaPendientes.estado === "listo" ? consultaPendientes.datos : []).filter(
    (o) => !bandeja.some((b) => b.id === o.id),
  );

  // Se puede llegar con las OT ya puestas: desde una orden (?ot=3) o al corregir
  // un remito anulado (?ots=3,4).
  const pedidas = parametros.get("ots") ?? parametros.get("ot") ?? "";

  useEffect(() => {
    const numeros = pedidas
      .split(",")
      .map((n) => Number(n.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);
    if (numeros.length === 0) return;

    let vigente = true;
    void (async () => {
      const encontradas: OrdenConDoctor[] = [];
      for (const numero of numeros) {
        try {
          const orden = await buscarOrdenPorNumero(numero);
          if (orden && orden.remito_id === null && orden.estado !== "anulada") encontradas.push(orden);
        } catch {
          // Si falla una, se sigue con las demás: la bandeja se puede completar a mano.
        }
      }
      if (vigente) setBandeja(encontradas);
    })();

    return () => {
      vigente = false;
    };
  }, [pedidas]);

  async function agregarOT(numero: number) {
    if (bandeja.some((o) => o.numero === numero)) {
      toast.error(`La OT ${formatOT(numero)} ya está en la bandeja.`);
      return;
    }

    let orden: OrdenConDoctor | null = null;
    try {
      orden = await buscarOrdenPorNumero(numero);
    } catch {
      toast.error("No se pudo buscar la orden. Revisá la conexión y probá de nuevo.", {
        duration: Infinity,
      });
      return;
    }

    if (!orden) {
      toast.error(`No existe la OT ${formatOT(numero)}.`);
      return;
    }
    if (orden.estado === "entregada" || orden.remito_id !== null) {
      toast.error(`La OT ${formatOT(numero)} ya fue entregada en otro remito.`);
      return;
    }
    if (orden.estado === "anulada") {
      toast.error(`La OT ${formatOT(numero)} está anulada.`);
      return;
    }
    agregarOrden(orden);
  }

  /** Suma una orden ya cargada: la eligió de la lista o la trajo el escaneo. */
  function agregarOrden(orden: OrdenConDoctor) {
    if (bandeja.some((o) => o.id === orden.id)) {
      toast.error(`La OT ${formatOT(orden.numero)} ya está en la bandeja.`);
      return;
    }
    setBandeja((actual) => [...actual, orden]);
  }

  /**
   * Emite un remito por cada comanda de la bandeja, de a uno y en el orden de la bandeja.
   * Cada emisión es su propia transacción: si una falla, las ya emitidas quedan hechas
   * y salen de la bandeja; las que faltan quedan para reintentar.
   */
  async function emitir() {
    if (bandeja.length === 0 || emitiendo) return;

    setEmitiendo(true);
    const emitidos: number[] = [];
    const emitidas: number[] = [];
    for (const orden of bandeja) {
      try {
        const remito = await emitirRemito(orden.doctor_id, [orden.id], fecha);
        emitidos.push(remito.numero);
        emitidas.push(orden.id);
      } catch {
        const hechos =
          emitidos.length > 0
            ? ` Ya se emitieron ${emitidos.length} (${emitidos.map(formatRemito).join(", ")}); las demás siguen en la bandeja.`
            : "";
        toast.error(
          `No se pudo emitir el remito de la OT ${formatOT(orden.numero)}. Revisá la conexión y probá de nuevo.${hechos}`,
          { duration: Infinity },
        );
        setBandeja((actual) => actual.filter((o) => !emitidas.includes(o.id)));
        setEmitiendo(false);
        recargarPendientes();
        return;
      }
    }

    toast.success(
      emitidos.length === 1
        ? `Remito emitido: ${formatRemito(emitidos[0])}`
        : `Remitos emitidos: ${emitidos.map(formatRemito).join(", ")}`,
    );
    router.push(`/remitos/documento?remitos=${emitidos.join(",")}`);
  }

  function procesar() {
    const escaneo = interpretarEscaneo(texto);
    setTexto("");

    if (escaneo.tipo === "ot") {
      void agregarOT(escaneo.numero);
      return;
    }
    if (escaneo.tipo === "comando") {
      if (escaneo.comando === "EMITIR") void emitir();
      else if (escaneo.comando === "LIMPIAR") setBandeja([]);
      else toast.error(`Comando desconocido: ${escaneo.comando}`);
      return;
    }
    toast.error("No se entendió el código. Probá con el número de OT.");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex max-w-[640px] flex-col gap-3">
        <Campo
          id="escaneo"
          etiqueta="Escaneá la comanda"
          ayuda="Opcional: también podés elegirla de la lista. Escribí el número de OT y apretá Enter; CMD-EMITIR emite y CMD-LIMPIAR vacía la bandeja."
        >
          <Input
            id="escaneo"
            ref={campo}
            className="font-mono"
            placeholder="0000003"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              procesar();
            }}
          />
        </Campo>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
            Comandas sin facturar
          </h2>
          {pendientes.length > 0 && doctorEfectivo !== "" && (
            <Button variant="outline" onClick={() => setBandeja((a) => [...a, ...pendientes])}>
              Agregar todas
            </Button>
          )}
        </div>

        <div className="max-w-[320px]">
            <Campo id="doctor_filtro" etiqueta="Doctor" ayuda="Vacío muestra las de todos.">
              <Combobox
                id="doctor_filtro"
                valor={doctorFiltro || null}
                onCambio={(v) => setDoctorFiltro(v ?? "")}
                placeholder="Todos los doctores"
                opciones={doctores.map((d) => ({
                  valor: String(d.id),
                  etiqueta: d.nombre,
                  busqueda: String(d.ficha),
                  detalle: `ficha ${d.ficha}`,
                }))}
              />
            </Campo>
          </div>

        {consultaPendientes.estado === "cargando" && <Skeleton className="h-24 w-full" />}
        {consultaPendientes.estado === "error" && (
          <ErrorConsulta mensaje={consultaPendientes.mensaje} onReintentar={recargarPendientes} />
        )}
        {consultaPendientes.estado === "listo" && (
          <div className="overflow-hidden rounded-md border border-border bg-surface">
            {pendientes.length === 0 ? (
              <p className="p-4 text-ink-3">
                {bandeja.length > 0 ? "No quedan comandas sin facturar." : "No hay comandas sin facturar."}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">OT</TableHead>
                    <TableHead className="w-24">Fecha</TableHead>
                    {doctorEfectivo === "" && <TableHead>Doctor</TableHead>}
                    <TableHead>Paciente</TableHead>
                    <TableHead className="text-right">Importe</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendientes.map((orden) => (
                    <TableRow key={orden.id}>
                      <TableCell className="font-mono">{formatOT(orden.numero)}</TableCell>
                      <TableCell>{formatFechaCorta(orden.fecha)}</TableCell>
                      {doctorEfectivo === "" && <TableCell>{orden.doctor?.nombre ?? "—"}</TableCell>}
                      <TableCell>{orden.paciente}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatARS(orden.total)}
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Agregar la OT ${formatOT(orden.numero)} a la bandeja`}
                                onClick={() => agregarOrden(orden)}
                              />
                            }
                          >
                            <Plus />
                          </TooltipTrigger>
                          <TooltipContent>Agregar a la bandeja</TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
            Bandeja
          </h2>
          <Campo id="fecha" etiqueta="Fecha del remito">
            <Input
              id="fecha"
              type="date"
              className="w-44"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </Campo>
        </div>

        <div className="overflow-hidden rounded-md border border-border bg-surface">
          {bandeja.length === 0 ? (
            <p className="p-4 text-ink-3">
              La bandeja está vacía. Elegí las comandas de la lista de arriba o escaneá las
              órdenes que vas a entregar.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">OT</TableHead>
                  <TableHead className="w-24">Fecha</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {bandeja.map((orden) => (
                  <TableRow key={orden.id}>
                    <TableCell className="font-mono">{formatOT(orden.numero)}</TableCell>
                    <TableCell>{formatFechaCorta(orden.fecha)}</TableCell>
                    <TableCell>{orden.doctor?.nombre ?? "—"}</TableCell>
                    <TableCell>{orden.paciente}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatARS(orden.total)}</TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() =>
                                setBandeja((actual) => actual.filter((o) => o.id !== orden.id))
                              }
                            />
                          }
                        >
                          <X />
                        </TooltipTrigger>
                        <TooltipContent>Sacar de la bandeja</TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="flex items-baseline gap-3">
            <span className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
              Total
            </span>
            <span className="text-lg font-semibold tabular-nums">{formatARS(total)}</span>
          </p>
          {bandeja.length > 1 && (
            <p className="text-xs text-ink-2">
              Sale un remito por comanda: {bandeja.length} remitos, impresos uno detrás del otro.
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBandeja([])} disabled={bandeja.length === 0}>
            Vaciar bandeja
          </Button>
          <Button onClick={emitir} disabled={bandeja.length === 0 || emitiendo}>
            {emitiendo
              ? "Emitiendo…"
              : bandeja.length > 1
                ? `Emitir ${bandeja.length} remitos`
                : "Emitir remito"}
          </Button>
        </div>
      </div>
    </div>
  );
}
