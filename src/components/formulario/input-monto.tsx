"use client";

import { useLayoutEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { formatearEntradaMonto } from "@/lib/money";
import { cn } from "@/lib/utils";

/** Cuántos dígitos (y la coma) hay antes de la posición del cursor. */
function significativosAntes(texto: string, posicion: number): number {
  return (texto.slice(0, posicion).match(/[\d,]/g) ?? []).length;
}

/** Dónde queda el cursor después de reformatear, contando los mismos caracteres. */
function posicionParaCursor(formateado: string, significativos: number): number {
  if (significativos === 0) return 0;
  let vistos = 0;
  for (let i = 0; i < formateado.length; i++) {
    if (/[\d,]/.test(formateado[i])) {
      vistos += 1;
      if (vistos === significativos) return i + 1;
    }
  }
  return formateado.length;
}

/**
 * Campo de monto: muestra los miles separados con punto mientras se escribe.
 * El valor que sale sigue siendo texto ("185.000,50"); para pasarlo a centavos
 * se usa `centavosDesdeTexto`.
 */
export function InputMonto({
  id,
  valor,
  onCambio,
  className,
  invalido,
  autoFocus,
  ...resto
}: {
  id?: string;
  valor: string;
  onCambio: (valor: string) => void;
  className?: string;
  invalido?: boolean;
  autoFocus?: boolean;
} & Omit<React.ComponentProps<"input">, "value" | "onChange" | "id" | "className">) {
  const campo = useRef<HTMLInputElement>(null);
  const cursor = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (cursor.current === null || !campo.current) return;
    campo.current.setSelectionRange(cursor.current, cursor.current);
    cursor.current = null;
  });

  return (
    <Input
      {...resto}
      id={id}
      ref={campo}
      inputMode="decimal"
      autoFocus={autoFocus}
      aria-invalid={invalido ? true : undefined}
      className={cn("text-right tabular-nums", className)}
      value={valor}
      onChange={(e) => {
        const crudo = e.target.value;
        const formateado = formatearEntradaMonto(crudo);
        cursor.current = posicionParaCursor(
          formateado,
          significativosAntes(crudo, e.target.selectionStart ?? crudo.length),
        );
        onCambio(formateado);
      }}
    />
  );
}
