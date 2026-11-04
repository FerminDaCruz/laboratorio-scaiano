"use client";

import { ChevronsUpDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  buscarTrabajosParaOrden,
  MINIMO_PARA_BUSCAR_TRABAJO,
} from "@/components/trabajos/datos";
import { Button } from "@/components/ui/button";
import { Command, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDebounce } from "@/hooks/use-debounce";
import { formatARS } from "@/lib/money";
import { normalizar } from "@/lib/texto";
import type { TrabajoConPrecio } from "@/lib/tipos";
import { cn } from "@/lib/utils";

/** Cuánto antes del final de la lista se pide la tanda siguiente, en px. */
const MARGEN_PARA_CARGAR = 48;

type Estado =
  | { tipo: "cargando" }
  | { tipo: "listo"; hayMas: boolean; cargandoMas: boolean }
  | { tipo: "error" };

/**
 * Combobox de trabajo para la orden (§6). No precarga el catálogo: trae una tanda,
 * y al bajar hasta el final de la lista trae la siguiente. Al tipear dos letras busca
 * en la base por título o código.
 */
export function ComboboxTrabajo({
  id,
  elegido,
  onCambio,
  invalido,
  ancho = "w-full",
}: {
  id?: string;
  /** El trabajo elegido, para mostrar su título sin volver a pedirlo. */
  elegido: { id: string; titulo: string } | null;
  onCambio: (trabajo: TrabajoConPrecio) => void;
  invalido?: boolean;
  ancho?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [trabajos, setTrabajos] = useState<TrabajoConPrecio[]>([]);
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  const disparador = useRef<HTMLButtonElement>(null);
  // Una respuesta vieja (de lo que se tipeó antes) no pisa la lista nueva.
  const pedido = useRef(0);

  const demorado = useDebounce(texto, 250);
  const busqueda = normalizar(demorado).length >= MINIMO_PARA_BUSCAR_TRABAJO ? demorado : "";

  useEffect(() => {
    if (!abierto) return;
    const este = ++pedido.current;
    setEstado({ tipo: "cargando" });
    buscarTrabajosParaOrden(busqueda, 0)
      .then(({ trabajos: tanda, hayMas }) => {
        if (este !== pedido.current) return;
        setTrabajos(tanda);
        setEstado({ tipo: "listo", hayMas, cargandoMas: false });
      })
      .catch(() => {
        if (este === pedido.current) setEstado({ tipo: "error" });
      });
  }, [abierto, busqueda]);

  const cargarMas = useCallback(() => {
    if (estado.tipo !== "listo" || !estado.hayMas || estado.cargandoMas) return;
    const este = pedido.current;
    setEstado({ ...estado, cargandoMas: true });
    buscarTrabajosParaOrden(busqueda, trabajos.length)
      .then(({ trabajos: tanda, hayMas }) => {
        if (este !== pedido.current) return;
        setTrabajos((actuales) => [...actuales, ...tanda]);
        setEstado({ tipo: "listo", hayMas, cargandoMas: false });
      })
      .catch(() => {
        if (este === pedido.current) setEstado({ tipo: "error" });
      });
  }, [busqueda, estado, trabajos.length]);

  function alDesplazar(e: React.UIEvent<HTMLDivElement>) {
    const lista = e.currentTarget;
    if (lista.scrollTop + lista.clientHeight >= lista.scrollHeight - MARGEN_PARA_CARGAR) {
      cargarMas();
    }
  }

  function elegir(trabajo: TrabajoConPrecio) {
    onCambio(trabajo);
    setAbierto(false);
    setTexto("");
    disparador.current?.focus();
  }

  const pocasLetras =
    normalizar(texto).length > 0 && normalizar(texto).length < MINIMO_PARA_BUSCAR_TRABAJO;

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
        <span className={cn("truncate", !elegido && "text-ink-3")}>
          {elegido ? elegido.titulo : "Código o título…"}
        </span>
        <ChevronsUpDown data-icon="inline-end" className="text-ink-3" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--anchor-width) min-w-80 p-0">
        <Command shouldFilter={false}>
          <CommandInput
            autoFocus
            value={texto}
            onValueChange={setTexto}
            placeholder="Buscar…"
          />
          <CommandList onScroll={alDesplazar}>
            {estado.tipo === "listo" && trabajos.length === 0 && (
              <p className="px-3 py-6 text-center text-ink-3">
                {busqueda ? "Ningún trabajo coincide con la búsqueda." : "No hay trabajos activos."}
              </p>
            )}
            {trabajos.map((t) => (
              <CommandItem
                key={t.id}
                value={String(t.id)}
                disabled={t.precio === null}
                onSelect={() => elegir(t)}
                data-checked={elegido?.id === String(t.id) ? true : undefined}
              >
                <span className="truncate">{t.titulo}</span>
                <span className="ml-auto flex shrink-0 items-baseline gap-2 text-xs text-ink-3">
                  <span className="font-mono">{t.codigo}</span>
                  <span className="tabular-nums">
                    {t.precio === null ? "sin precio" : formatARS(t.precio)}
                  </span>
                </span>
              </CommandItem>
            ))}
          </CommandList>
          {estado.tipo === "cargando" && <p className="px-3 py-2 text-xs text-ink-3">Cargando…</p>}
          {estado.tipo === "listo" && estado.cargandoMas && (
            <p className="px-3 py-2 text-xs text-ink-3">Cargando más trabajos…</p>
          )}
          {estado.tipo === "error" && (
            <p className="px-3 py-2 text-xs text-danger">
              No se pudieron cargar los trabajos. Revisá la conexión y probá de nuevo.
            </p>
          )}
          {pocasLetras && (
            <p className="px-3 py-2 text-xs text-ink-3">
              Escribí al menos {MINIMO_PARA_BUSCAR_TRABAJO} letras para buscar.
            </p>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
