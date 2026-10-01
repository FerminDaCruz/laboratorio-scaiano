"use client";

import { useState } from "react";
import { Odontograma } from "@/components/odontograma/odontograma";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatPieza } from "@/lib/fdi";

// Página de prueba de E4: permite seleccionar en los cuatro modos, con mouse y
// con teclado, y ver cómo queda el valor que se guarda.

const EJEMPLOS = [
  { etiqueta: "Sin pieza", valor: null },
  { etiqueta: "Sueltas", valor: "1.8,2.4,3.6" },
  { etiqueta: "Tramo", valor: "2.4-2.6" },
  { etiqueta: "Arcada superior", valor: "arcada:sup" },
  { etiqueta: "Temporales", valor: "5.5-6.1" },
];

export default function OdontogramaPruebaPage() {
  const [valor, setValor] = useState<string | null>(null);

  return (
    <div className="flex max-w-[640px] flex-col gap-6">
      <Odontograma valor={valor} onCambio={setValor} />

      <Separator />

      <section className="flex flex-col gap-3">
        <h2 className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
          Valor que se guarda
        </h2>
        <div className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4">
          <div className="flex gap-4">
            <span className="w-32 shrink-0 text-xs text-ink-3">Serializado</span>
            <span className="font-mono">{valor === null ? "null" : valor}</span>
          </div>
          <div className="flex gap-4">
            <span className="w-32 shrink-0 text-xs text-ink-3">formatPieza</span>
            <span>{formatPieza(valor)}</span>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Ejemplos</h2>
        <div className="flex flex-wrap gap-2">
          {EJEMPLOS.map((e) => (
            <Button key={e.etiqueta} variant="outline" onClick={() => setValor(e.valor)}>
              {e.etiqueta}
            </Button>
          ))}
        </div>
      </section>
    </div>
  );
}
