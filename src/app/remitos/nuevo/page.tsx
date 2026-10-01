"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Campo } from "@/components/formulario/campo";
import { emitirRemito } from "@/components/remitos/consultas";
import { buscarOrdenPorNumero, type OrdenConDoctor } from "@/components/ordenes/consultas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { formatARS } from "@/lib/money";
import { interpretarEscaneo, useFocoDeEscaneo } from "@/lib/scanner";

const hoy = () => new Date().toISOString().slice(0, 10);

export default function NuevoRemitoPage() {
  const router = useRouter();
  const campo = useRef<HTMLInputElement>(null);
  useFocoDeEscaneo(campo);

  const [texto, setTexto] = useState("");
  const [fecha, setFecha] = useState(hoy());
  const [bandeja, setBandeja] = useState<OrdenConDoctor[]>([]);
  const [emitiendo, setEmitiendo] = useState(false);

  const doctor = bandeja[0]?.doctor ?? null;
  const doctorId = bandeja[0]?.doctor_id ?? null;
  const total = bandeja.reduce((suma, o) => suma + o.total, 0);

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
    setEmitiendo(true);
    try {
      const remito = await emitirRemito(doctorId, bandeja.map((o) => o.id), fecha);
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
          <div className="flex items-center gap-3">
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

        <div className="flex items-center justify-between gap-4">
          <p className="flex items-baseline gap-3">
            <span className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
              Total del remito
            </span>
            <span className="text-lg font-semibold tabular-nums">{formatARS(total)}</span>
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setBandeja([])} disabled={bandeja.length === 0}>
              Vaciar bandeja
            </Button>
            <Button onClick={emitir} disabled={bandeja.length === 0 || emitiendo}>
              {emitiendo ? "Emitiendo…" : "Emitir remito"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
