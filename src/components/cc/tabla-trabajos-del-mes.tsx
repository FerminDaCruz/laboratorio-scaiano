"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatFechaCorta, formatOT, formatRemito } from "@/lib/format";
import { formatARS, type Centavos } from "@/lib/money";
import type { TrabajoDelMes } from "./consultas";

/**
 * Lo que se le entregó al doctor este mes, con el importe completo de cada orden, y
 * debajo el saldo total de su cuenta. Los pagos se descuentan de ese saldo, no de cada
 * trabajo, así que acá no hay columna de "pendiente".
 */
export function TablaTrabajosDelMes({
  trabajos,
  saldo,
}: {
  trabajos: TrabajoDelMes[];
  saldo: Centavos;
}) {
  const facturado = trabajos.reduce((suma, t) => suma + t.importe, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-md border border-border bg-surface">
        {trabajos.length === 0 ? (
          <p className="p-4 text-ink-3">Este mes todavía no se le entregaron trabajos.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Fecha</TableHead>
                <TableHead className="w-28">Remito</TableHead>
                <TableHead className="w-24">OT</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Trabajos</TableHead>
                <TableHead className="text-right">Importe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trabajos.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{formatFechaCorta(t.fecha)}</TableCell>
                  <TableCell className="font-mono">{formatRemito(t.remitoNumero)}</TableCell>
                  <TableCell className="font-mono">{formatOT(t.ordenNumero)}</TableCell>
                  <TableCell>{t.paciente}</TableCell>
                  <TableCell className="max-w-80 truncate">{t.trabajos.join(" · ") || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatARS(t.importe)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="flex flex-col items-end gap-1">
        <p className="flex items-baseline gap-3 text-xs text-ink-2">
          <span>Facturado este mes</span>
          <span className="tabular-nums">{formatARS(facturado)}</span>
        </p>
        <p className="flex items-baseline gap-3">
          <span className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
            {saldo < 0 ? "Saldo a favor" : "Deuda total"}
          </span>
          <span className={`text-sm font-semibold tabular-nums ${saldo < 0 ? "text-ok" : "text-ink"}`}>
            {formatARS(saldo)}
          </span>
        </p>
      </div>
    </div>
  );
}
