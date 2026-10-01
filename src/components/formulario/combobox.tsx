"use client";

import { ChevronsUpDown } from "lucide-react";
import { useRef, useState } from "react";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { normalizar } from "@/lib/texto";
import { cn } from "@/lib/utils";

export type OpcionCombo = {
  valor: string;
  etiqueta: string;
  /** Texto adicional por el que también se puede buscar (código, ficha). */
  busqueda?: string;
  detalle?: string;
};

const MINIMO_PARA_FILTRAR = 3;
const VISIBLES_SIN_BUSQUEDA = 8;

/**
 * Combobox con búsqueda (§6): los select de doctor y de trabajo filtran
 * al tipear tres letras. Se opera entero con el teclado.
 */
export function Combobox({
  id,
  valor,
  onCambio,
  opciones,
  placeholder = "Elegir…",
  vacio = "No hay coincidencias.",
  invalido,
  ancho = "w-full",
}: {
  id?: string;
  valor: string | null;
  onCambio: (valor: string | null) => void;
  opciones: OpcionCombo[];
  placeholder?: string;
  vacio?: string;
  invalido?: boolean;
  ancho?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const disparador = useRef<HTMLButtonElement>(null);

  const elegida = opciones.find((o) => o.valor === valor);
  const consulta = normalizar(texto);
  const filtrando = consulta.length >= MINIMO_PARA_FILTRAR;
  const visibles = filtrando
    ? opciones.filter((o) => normalizar(`${o.etiqueta} ${o.busqueda ?? ""}`).includes(consulta))
    : opciones.slice(0, VISIBLES_SIN_BUSQUEDA);

  function elegir(opcion: OpcionCombo) {
    onCambio(opcion.valor);
    setAbierto(false);
    setTexto("");
    disparador.current?.focus();
  }

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger
        render={
          <Button
            ref={disparador}
            id={id}
            type="button"
            variant="outline"
            aria-invalid={invalido ? true : undefined}
            className={cn("justify-between font-normal", ancho)}
          />
        }
      >
        <span className={cn("truncate", !elegida && "text-ink-3")}>
          {elegida ? elegida.etiqueta : placeholder}
        </span>
        <ChevronsUpDown data-icon="inline-end" className="text-ink-3" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--anchor-width) min-w-72 p-0">
        <Command shouldFilter={false}>
          <CommandInput
            autoFocus
            value={texto}
            onValueChange={setTexto}
            placeholder="Buscar…"
          />
          <CommandList>
            {visibles.length === 0 ? (
              <CommandEmpty className="text-ink-3">{vacio}</CommandEmpty>
            ) : (
              visibles.map((o) => (
                <CommandItem
                  key={o.valor}
                  value={o.valor}
                  onSelect={() => elegir(o)}
                  data-checked={o.valor === valor ? true : undefined}
                >
                  <span className="truncate">{o.etiqueta}</span>
                  {o.detalle && <span className="ml-auto text-xs text-ink-3">{o.detalle}</span>}
                </CommandItem>
              ))
            )}
          </CommandList>
          {!filtrando && opciones.length > VISIBLES_SIN_BUSQUEDA && (
            <p className="px-3 py-2 text-xs text-ink-3">
              Escribí al menos {MINIMO_PARA_FILTRAR} letras para buscar entre {opciones.length}.
            </p>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
