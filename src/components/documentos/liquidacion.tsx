"use client";

import type { Liquidacion } from "@/components/liquidaciones/consultas";
import { formatFechaCorta, formatOT, formatRemito } from "@/lib/format";
import { formatARS } from "@/lib/money";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Liquidación mensual por doctor, en hoja A4 (§5D). */
export function DocumentoLiquidacion({
  liquidacion,
  anio,
  mes,
}: {
  liquidacion: Liquidacion;
  anio: number;
  mes: number;
}) {
  const { doctor } = liquidacion;
  const domicilio = [doctor.domicilio, doctor.piso ? `Piso ${doctor.piso}` : null, doctor.departamento ? `Dto. ${doctor.departamento}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <style>{`
        .liquidacion {
          width: 210mm;
          padding: 12mm;
          background: #fff;
          color: #000;
          font-family: var(--font-mono);
          font-size: 9pt;
          line-height: 1.35;
        }
        .liquidacion h1 { font-size: 13pt; font-weight: 600; margin: 0 0 2mm; }
        .liquidacion table { width: 100%; border-collapse: collapse; }
        .liquidacion th { text-align: left; border-bottom: 1px solid #000; padding: 1mm 1mm 1mm 0; font-weight: 600; }
        .liquidacion td { padding: 0.8mm 1mm 0.8mm 0; vertical-align: top; }
        .liquidacion .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .liquidacion .saldos { margin-top: 6mm; width: 85mm; margin-left: auto; }
        .liquidacion .saldos td { border-top: 1px solid #000; }
        .liquidacion .leyenda { margin-top: 6mm; text-align: center; text-transform: uppercase; }

        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          .liquidacion { width: auto; padding: 0; page-break-after: always; }
        }
      `}</style>

      <div className="liquidacion">
        <h1>LIQUIDACIÓN {MESES[mes - 1].toUpperCase()} {anio}</h1>
        <p>
          dr/a: {doctor.nombre} (ficha {doctor.ficha})
        </p>
        {domicilio && <p>{domicilio}</p>}
        {doctor.localidad && <p>{doctor.localidad}</p>}

        <table style={{ marginTop: "6mm" }}>
          <thead>
            <tr>
              <th>fecha</th>
              <th>ticket</th>
              <th>OT</th>
              <th>artículo</th>
              <th>paciente</th>
              <th>obra</th>
              <th className="num">cant</th>
              <th className="num">precio</th>
              <th className="num">total</th>
            </tr>
          </thead>
          <tbody>
            {liquidacion.filas.map((fila) => (
              <tr key={fila.id}>
                <td>{formatFechaCorta(fila.fecha)}</td>
                <td>{formatRemito(fila.remitoNumero)}</td>
                <td>{formatOT(fila.ordenNumero)}</td>
                <td>{fila.articulo}</td>
                <td>{fila.paciente}</td>
                <td>{fila.obraSocial}</td>
                <td className="num">{fila.cantidad}</td>
                <td className="num">{formatARS(fila.precio)}</td>
                <td className="num">{formatARS(fila.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <table className="saldos">
          <tbody>
            <tr>
              <td>saldo anterior</td>
              <td className="num">{formatARS(liquidacion.saldoAnterior)}</td>
            </tr>
            <tr>
              <td>facturado del mes</td>
              <td className="num">{formatARS(liquidacion.facturado)}</td>
            </tr>
            <tr>
              <td>pagos del mes</td>
              <td className="num">{formatARS(liquidacion.pagos)}</td>
            </tr>
            <tr>
              <td>saldo final</td>
              <td className="num">{formatARS(liquidacion.saldoFinal)}</td>
            </tr>
          </tbody>
        </table>

        <p className="leyenda">documento no válido como factura</p>
      </div>
    </>
  );
}
