"use client";

import JsBarcode from "jsbarcode";
import { useEffect, useRef } from "react";
import type { ItemDeOrden, OrdenConDoctor } from "@/components/ordenes/consultas";
import { formatPieza } from "@/lib/fdi";
import { formatFechaLarga, formatHora, formatOT } from "@/lib/format";
import { ANCHO_TICKET_MM, codigoDeBarrasDeOT } from "@/lib/impresion";

/**
 * Comanda: el papel chico que sale al cargar la orden (§5D).
 * Blanco y negro, monoespaciada y con medidas en mm.
 */
export function Comanda({ orden, items }: { orden: OrdenConDoctor; items: ItemDeOrden[] }) {
  const codigo = useRef<SVGSVGElement>(null);
  const numero = formatOT(orden.numero);

  useEffect(() => {
    if (!codigo.current) return;
    JsBarcode(codigo.current, codigoDeBarrasDeOT(numero), {
      format: "CODE128",
      displayValue: false,
      height: 40,
      width: 2,
      margin: 0,
    });
  }, [numero]);

  return (
    <>
      <style>{`
        .comanda {
          width: ${ANCHO_TICKET_MM}mm;
          padding: 3mm;
          background: #fff;
          color: #000;
          font-family: var(--font-mono);
          font-size: 10pt;
          line-height: 1.35;
        }
        .comanda-ot { font-size: 16pt; font-weight: 600; }
        .comanda svg { width: 100%; height: 14mm; }
        .comanda dl { display: grid; grid-template-columns: 14mm 1fr; column-gap: 2mm; }
        .comanda dd { margin: 0; }
        .comanda hr { border: 0; border-top: 1px solid #000; margin: 2mm 0; }

        @media print {
          @page { size: ${ANCHO_TICKET_MM}mm auto; margin: 4mm; }
          .comanda { width: auto; padding: 0; }
        }
      `}</style>

      <div className="comanda">
        <p className="comanda-ot">OT: {numero}</p>
        <svg ref={codigo} aria-label={`Código de barras ${codigoDeBarrasDeOT(numero)}`} />

        <dl>
          <dt>dr/a:</dt>
          <dd>{orden.doctor?.nombre ?? "—"}</dd>
          <dt>paci:</dt>
          <dd>{orden.paciente}</dd>
        </dl>

        <hr />

        {items.map((item) => (
          <dl key={item.id}>
            <dt>caso:</dt>
            <dd>
              {item.trabajo?.titulo ?? "—"}
              {item.piezas ? ` (${formatPieza(item.piezas)})` : ""}
            </dd>
            <dt>cant:</dt>
            <dd>{item.cantidad}</dd>
          </dl>
        ))}

        <hr />

        <dl>
          <dt>Ctl :</dt>
          <dd>
            {orden.entrega_at
              ? `${formatFechaLarga(orden.entrega_at)} ${formatHora(orden.entrega_at)}`
              : "sin fecha comprometida"}
          </dd>
          {orden.color && (
            <>
              <dt>color:</dt>
              <dd>{orden.color}</dd>
            </>
          )}
        </dl>

        {orden.indicaciones && (
          <>
            <hr />
            <p>{orden.indicaciones}</p>
          </>
        )}
      </div>
    </>
  );
}
