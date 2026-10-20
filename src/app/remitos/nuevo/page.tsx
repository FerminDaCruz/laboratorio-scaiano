"use client";

import { X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Campo } from "@/components/formulario/campo";
import { InputMonto } from "@/components/formulario/input-monto";
import { SelectSimple } from "@/components/formulario/select-simple";
import { emitirRemito } from "@/components/remitos/consultas";
import { buscarOrdenPorNumero, type OrdenConDoctor } from "@/components/ordenes/consultas";
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
import { formatFechaCorta, formatOT } from "@/lib/format";
import { centavosDesdeTexto, formatARS } from "@/lib/money";
import { interpretarEscaneo, useFocoDeEscaneo } from "@/lib/scanner";

const hoy = () => new Date().toISOString().slice(0, 10);

type TipoAjuste = "" | "descuento" | "recargo";

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
  const [fecha, setFecha] = useState(hoy());
  const [bandeja, setBandeja] = useState<OrdenConDoctor[]>([]);
  const [emitiendo, setEmitiendo] = useState(false);

  const [tipoAjuste, setTipoAjuste] = useState<TipoAjuste>("");
  const [importeAjuste, setImporteAjuste] = useState("");
  const [motivoAjuste, setMotivoAjuste] = useState("");
  const [errorAjuste, setErrorAjuste] = useState<string>();

  const doctor = bandeja[0]?.doctor ?? null;
  const doctorId = bandeja[0]?.doctor_id ?? null;
  const trabajos = bandeja.reduce((suma, o) => suma + o.total, 0);
  const ajuste =
    tipoAjuste === "" ? 0 : (centavosDesdeTexto(importeAjuste) ?? 0) * (tipoAjuste === "descuento" ? -1 : 1);
  const total = trabajos + ajuste;

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
    if (doctorId !== null && orden.doctor_id !== doctorId) {
      toast.error(
        `La OT ${formatOT(numero)} es de ${orden.doctor?.nombre ?? "otro doctor"}. Un remito lleva órdenes de un solo doctor.`,
      );
      return;
    }

    setBandeja((actual) => [...actual, orden as OrdenConDoctor]);
  }

  async function emitir() {
    if (doctorId === null || bandeja.length === 0) return;

    if (tipoAjuste !== "") {
      const importe = centavosDesdeTexto(importeAjuste);
      if (importe === null || importe <= 0) {
        setErrorAjuste("Poné el importe del ajuste.");
        return;
      }
      if (motivoAjuste.trim() === "") {
        setErrorAjuste("Un descuento o un recargo necesita un motivo.");
        return;
      }
      if (total < 0) {
        setErrorAjuste("El descuento no puede ser mayor que el total.");
        return;
      }
    }
    setErrorAjuste(undefined);

    setEmitiendo(true);
    try {
      const remito = await emitirRemito(
        doctorId,
        bandeja.map((o) => o.id),
        fecha,
        ajuste,
        motivoAjuste,
      );
      toast.success(`Remito emitido: ${formatOT(remito.numero)}`);
      router.push(`/remitos/documento?remito=${remito.numero}`);
    } catch {
      toast.error("No se pudo emitir el remito. Revisá la conexión y probá de nuevo.", {
        duration: Infinity,
      });
      setEmitiendo(false);
    }
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
          ayuda="También podés escribir el número de OT y apretar Enter. CMD-EMITIR emite, CMD-LIMPIAR vacía la bandeja."
        >
          <Input
            id="escaneo"
            ref={campo}
            className="font-mono"
            placeholder="OT-000003"
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
            Bandeja {doctor ? `· ${doctor.nombre}` : ""}
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
              La bandeja está vacía. Escaneá las comandas de las órdenes que vas a entregar.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">OT</TableHead>
                  <TableHead className="w-24">Fecha</TableHead>
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

      <section className="flex flex-col gap-3">
        <h2 className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
          Descuento o recargo
        </h2>
        <div className="flex flex-wrap items-start gap-3">
          <Campo id="tipo_ajuste" etiqueta="Ajuste">
            <SelectSimple
              id="tipo_ajuste"
              valor={tipoAjuste}
              onCambio={(v) => {
                setTipoAjuste(v as TipoAjuste);
                setErrorAjuste(undefined);
              }}
              ancho="w-44"
              placeholder="Sin ajuste"
              opciones={[
                { valor: "", etiqueta: "Sin ajuste" },
                { valor: "descuento", etiqueta: "Descuento" },
                { valor: "recargo", etiqueta: "Recargo" },
              ]}
            />
          </Campo>

          {tipoAjuste !== "" && (
            <>
              <Campo id="importe_ajuste" etiqueta="Importe">
                <InputMonto
                  id="importe_ajuste"
                  className="w-40"
                  valor={importeAjuste}
                  invalido={Boolean(errorAjuste)}
                  onCambio={(v) => {
                    setImporteAjuste(v);
                    setErrorAjuste(undefined);
                  }}
                />
              </Campo>
              <Campo
                id="motivo_ajuste"
                etiqueta="Motivo"
                error={errorAjuste}
                ayuda="Queda escrito en el remito."
              >
                <Input
                  id="motivo_ajuste"
                  className="w-72"
                  value={motivoAjuste}
                  onChange={(e) => {
                    setMotivoAjuste(e.target.value);
                    setErrorAjuste(undefined);
                  }}
                  placeholder="Entrega urgente, descuento acordado…"
                />
              </Campo>
            </>
          )}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          {ajuste !== 0 && (
            <p className="flex items-baseline gap-3 text-xs text-ink-2">
              <span>Trabajos {formatARS(trabajos)}</span>
              <span>
                {ajuste < 0 ? "Descuento" : "Recargo"} {formatARS(ajuste)}
              </span>
            </p>
          )}
          <p className="flex items-baseline gap-3">
            <span className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
              Total del remito
            </span>
            <span className="text-lg font-semibold tabular-nums">{formatARS(total)}</span>
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBandeja([])} disabled={bandeja.length === 0}>
            Vaciar bandeja
          </Button>
          <Button onClick={emitir} disabled={bandeja.length === 0 || emitiendo}>
            {emitiendo ? "Emitiendo…" : "Emitir remito"}
          </Button>
        </div>
      </div>
    </div>
  );
}
