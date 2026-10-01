"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type Opcion = { valor: string; etiqueta: string };

export function SelectSimple({
  id,
  valor,
  onCambio,
  opciones,
  placeholder = "Elegir…",
  ancho = "w-full",
  invalido,
}: {
  id?: string;
  valor: string;
  onCambio: (valor: string) => void;
  opciones: Opcion[];
  placeholder?: string;
  ancho?: string;
  invalido?: boolean;
}) {
  const items = opciones.map((o) => ({ value: o.valor, label: o.etiqueta }));

  return (
    <Select
      items={items}
      value={valor}
      onValueChange={(nuevo) => onCambio(String(nuevo ?? ""))}
    >
      <SelectTrigger id={id} className={ancho} aria-invalid={invalido ? true : undefined}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {opciones.map((o) => (
          <SelectItem key={o.valor} value={o.valor}>
            {o.etiqueta}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
