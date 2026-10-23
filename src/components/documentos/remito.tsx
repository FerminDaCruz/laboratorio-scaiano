"use client";

import { Fragment } from "react";

import type { LineaRemito, RemitoConDoctor, ResumenCuenta } from "@/components/remitos/consultas";
import { formatFechaLarga, formatOT, formatRemito } from "@/lib/format";
import { ANCHO_TICKET_MM } from "@/lib/impresion";
import { formatARS } from "@/lib/money";

/** Remito de entrega (§5D). Blanco y negro, monoespaciado, medidas en mm. */
export function DocumentoRemito({
  remito,
  lineas,
  cuenta,
}: {
  remito: RemitoConDoctor;
  lineas: LineaRemito[];
  cuenta: ResumenCuenta;
}) {
  // El cadete lleva este papel: el domicilio va debajo del nombre.
  const domicilio = [
    remito.doctor?.domicilio,
    remito.doctor?.piso ? `Piso ${remito.doctor.piso}` : null,
    remito.doctor?.departamento ? `Dto. ${remito.doctor.departamento}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <style>{`
        .remito {
          width: ${ANCHO_TICKET_MM}mm;
          padding: 3mm;
          background: #fff;
          color: #000;
          font-family: var(--font-mono);
          font-size: 9pt;
          line-height: 1.35;
        }
        .remito h1 { font-size: 13pt; font-weight: 600; margin: 0; }
        .remito table { width: 100%; border-collapse: collapse; }
        .remito td { padding: 0.4mm 0; vertical-align: top; }
        .remito .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .remito hr { border: 0; border-top: 1px solid #000; margin: 2mm 0; }
        .remito .sangria { margin: 0 0 0 11mm; }
        .remito .detalle { padding-left: 3mm; }
        .remito .leyenda { margin-top: 3mm; text-align: center; text-transform: uppercase; }
        .remito .anulado { border: 1px solid #000; padding: 1mm; text-align: center; margin-bottom: 2mm; }

        @media print {
          @page { size: ${ANCHO_TICKET_MM}mm auto; margin: 4mm; }
          .remito { width: auto; padding: 0; }
        }
      `}</style>

      <div className="remito">
        {remito.anulado_en && <p className="anulado">ANULADO</p>}

        <h1>REMITO {formatRemito(remito.numero)}</h1>
        <p>{formatFechaLarga(remito.fecha)}</p>
        <p>
          dr/a: {remito.doctor?.nombre ?? "—"}
          {remito.doctor ? ` (ficha ${remito.doctor.ficha})` : ""}
        </p>
        {domicilio && <p className="sangria">{domicilio}</p>}
        {remito.doctor?.localidad && <p className="sangria">{remito.doctor.localidad}</p>}

        <hr />

        <table>
          <tbody>
            {lineas.map((linea) => {
              const ajuste = linea.orden?.ajuste ?? 0;
              const pct = linea.orden?.ajuste_pct ?? null;
              return (
                <Fragment key={linea.id}>
                  <tr>
                    <td>{linea.orden ? formatOT(linea.orden.numero) : "—"}</td>
                    <td>{linea.orden?.paciente ?? "—"}</td>
                    <td className="num">{formatARS(linea.importe - ajuste)}</td>
                  </tr>
                  {ajuste !== 0 && (
                    <>
                      <tr>
                        <td />
                        <td className="detalle">
                          {ajuste < 0 ? "descuento" : "plus"}
                          {pct !== null ? ` ${Math.abs(pct)}%` : ""}
                          {linea.orden?.ajuste_motivo ? ` · ${linea.orden.ajuste_motivo}` : ""}
                        </td>
                        <td className="num">{formatARS(ajuste)}</td>
                      </tr>
                      <tr>
                        <td />
                        <td className="detalle">subtotal</td>
                        <td className="num">{formatARS(linea.importe)}</td>
                      </tr>
                    </>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>

        <hr />

        <table>
          <tbody>
            {remito.ajuste !== 0 && (
              <>
                <tr>
                  <td>subtotal</td>
                  <td className="num">{formatARS(remito.total - remito.ajuste)}</td>
                </tr>
                <tr>
                  <td>{remito.ajuste < 0 ? "descuento" : "recargo"}</td>
                  <td className="num">{formatARS(remito.ajuste)}</td>
                </tr>
              </>
            )}
            <tr>
              <td>TOTAL</td>
              <td className="num">{formatARS(remito.total)}</td>
            </tr>
          </tbody>
        </table>

        {remito.ajuste_motivo && <p>motivo: {remito.ajuste_motivo}</p>}

        <hr />

        <p>CUENTA CORRIENTE</p>
        <table>
          <tbody>
            <tr>
              <td>saldo anterior</td>
              <td className="num">{formatARS(cuenta.saldoAnterior)}</td>
            </tr>
            <tr>
              <td>fact/mes</td>
              <td className="num">{formatARS(cuenta.facturadoMes)}</td>
            </tr>
            <tr>
              <td>pagos del mes</td>
              <td className="num">{formatARS(cuenta.pagosMes)}</td>
            </tr>
            <tr>
              <td>saldo cta cte</td>
              <td className="num">{formatARS(cuenta.saldoCuenta)}</td>
            </tr>
            <tr>
              <td>OT entregadas</td>
              <td className="num">{lineas.length}</td>
            </tr>
            <tr>
              <td>este ticket</td>
              <td className="num">{formatARS(cuenta.esteTicket)}</td>
            </tr>
            <tr>
              <td>saldo total</td>
              <td className="num">{formatARS(cuenta.saldoTotal)}</td>
            </tr>
          </tbody>
        </table>

        <p className="leyenda">documento no válido como factura</p>
      </div>
    </>
  );
}
