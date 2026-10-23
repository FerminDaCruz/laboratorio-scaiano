"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  agregarTramo,
  alternarPieza,
  arcadaDePieza,
  describirPiezas,
  esTemporal,
  parsearEntradaPiezas,
  parsearPiezas,
  piezasDesdeSeleccion,
  piezasSeleccionadas,
  secuenciaArcada,
  serializarPiezas,
  SIN_PIEZAS,
  type Arcada,
  type Piezas,
} from "@/lib/fdi";
import { cn } from "@/lib/utils";

/**
 * Modo de edición. No es el valor: una selección puede tener piezas sueltas y
 * tramos a la vez, y el modo solo dice cómo se agrega lo siguiente.
 */
type Modo = "ninguna" | "sueltas" | "tramo" | "arcada";

function modoDeValor(valor: Piezas, actual: Modo = "ninguna"): Modo {
  if (valor.modo === "arcada") return "arcada";
  if (valor.modo === "partes") return actual === "tramo" ? "tramo" : "sueltas";
  return actual === "tramo" || actual === "sueltas" ? actual : "ninguna";
}

const MODOS: { valor: Modo; etiqueta: string }[] = [
  { valor: "ninguna", etiqueta: "Sin pieza" },
  { valor: "sueltas", etiqueta: "Sueltas" },
  { valor: "tramo", etiqueta: "Tramo" },
  { valor: "arcada", etiqueta: "Arcada" },
];

const ARCADAS: { valor: Arcada; etiqueta: string }[] = [
  { valor: "sup", etiqueta: "Superior" },
  { valor: "inf", etiqueta: "Inferior" },
  { valor: "ambas", etiqueta: "Ambas" },
];

/**
 * Selección de piezas dentales en notación FDI (E4). Se opera con mouse y con
 * teclado: el campo de arriba acepta lo mismo que se puede clickear.
 */
export function Odontograma({
  id = "piezas",
  valor,
  onCambio,
  compacto = false,
  mostrarCampo = true,
  mostrarModos = true,
  agruparAlClickear = false,
}: {
  id?: string;
  /** Valor serializado, tal como se guarda en orden_items.piezas. */
  valor: string | null;
  onCambio: (valor: string | null) => void;
  /** Solo el campo tipeable, sin modos ni grilla: para filas de una orden. */
  compacto?: boolean;
  /** Oculta el campo de texto, cuando ya hay uno al lado que escribe el mismo valor. */
  mostrarCampo?: boolean;
  /** Oculta los modos y la arcada: queda solo la grilla para clickear. */
  mostrarModos?: boolean;
  /**
   * Clickear suma o saca una pieza y los tramos se arman solos: tres o más piezas
   * contiguas se agrupan. Es como se cargan las piezas en una orden.
   */
  agruparAlClickear?: boolean;
}) {
  const piezas = parsearPiezas(valor);
  const seleccionadas = piezasSeleccionadas(piezas);

  const [modo, setModo] = useState<Modo>(() => modoDeValor(piezas));
  const [temporales, setTemporales] = useState(() => seleccionadas.some(esTemporal));
  const [texto, setTexto] = useState(() => describirPiezas(piezas));
  const [error, setError] = useState<string>();
  const [extremo, setExtremo] = useState<string | null>(null);
  const ultimoValor = useRef(valor);

  // Si el valor cambia desde afuera (por ejemplo al cargar otra orden), se refleja.
  useEffect(() => {
    if (ultimoValor.current === valor) return;
    ultimoValor.current = valor;
    const nuevo = parsearPiezas(valor);
    setModo((actual) => modoDeValor(nuevo, actual));
    setTexto(describirPiezas(nuevo));
    setError(undefined);
    setExtremo(null);
  }, [valor]);

  function emitir(nuevo: Piezas) {
    const serializado = serializarPiezas(nuevo);
    ultimoValor.current = serializado;
    setModo((actual) => modoDeValor(nuevo, actual));
    setTexto(describirPiezas(nuevo));
    setError(undefined);
    onCambio(serializado);
  }

  function cambiarModo(nuevo: Modo) {
    setExtremo(null);
    setError(undefined);

    if (nuevo === "ninguna") {
      emitir(SIN_PIEZAS);
      return;
    }
    // Los otros modos no borran lo elegido: cambian cómo se agrega lo que sigue.
    setModo(nuevo);
  }

  function clickPieza(pieza: string) {
    if (agruparAlClickear) {
      const elegidas = new Set(seleccionadas);
      if (elegidas.has(pieza)) elegidas.delete(pieza);
      else elegidas.add(pieza);
      emitir(piezasDesdeSeleccion([...elegidas]));
      return;
    }

    if (modo === "arcada") {
      const arcada = arcadaDePieza(pieza);
      if (arcada) emitir({ modo: "arcada", arcada });
      return;
    }

    if (modo === "tramo") {
      if (!extremo) {
        setExtremo(pieza);
        setError(undefined);
        return;
      }
      const conTramo = agregarTramo(piezas, extremo, pieza);
      if (!conTramo) {
        setExtremo(pieza);
        setError("Un tramo va entre piezas de la misma arcada.");
        return;
      }
      setExtremo(null);
      emitir(conTramo);
      return;
    }

    // "ninguna" y "sueltas": clickear una pieza la agrega o la saca. Si la pieza
    // estaba dentro de un tramo, se saca el tramo entero.
    emitir(alternarPieza(piezas, pieza));
    setModo("sueltas");
  }

  function confirmarTexto() {
    const interpretado = parsearEntradaPiezas(texto);
    if (!interpretado) {
      setError("No se entiende. Probá 1.1, 2.4-2.6 o arcada sup.");
      return;
    }
    emitir(interpretado);
    if (piezasSeleccionadas(interpretado).some(esTemporal)) setTemporales(true);
  }

  return (
    <div className="flex flex-col gap-3">
      {mostrarCampo && (
      <Input
        id={id}
        value={texto}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        placeholder="1.1, 2.4-2.6 · arcada sup."
        className="font-mono"
        onChange={(e) => {
          setTexto(e.target.value);
          setError(undefined);
        }}
        onBlur={confirmarTexto}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          e.stopPropagation();
          confirmarTexto();
        }}
      />
      )}
      {mostrarCampo && error && (
        <p id={`${id}-error`} className="text-xs text-danger">
          {error}
        </p>
      )}

      {!compacto && mostrarModos && (
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={modo} onValueChange={(v) => cambiarModo(v as Modo)}>
          <TabsList>
            {MODOS.map((m) => (
              <TabsTrigger key={m.valor} value={m.valor}>
                {m.etiqueta}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {modo === "arcada" && (
          <div className="flex items-center gap-1">
            {ARCADAS.map((a) => (
              <Button
                key={a.valor}
                type="button"
                variant={piezas.modo === "arcada" && piezas.arcada === a.valor ? "default" : "outline"}
                onClick={() => emitir({ modo: "arcada", arcada: a.valor })}
              >
                {a.etiqueta}
              </Button>
            ))}
          </div>
        )}

        {modo === "tramo" && (
          <span className="text-xs text-ink-3">
            {extremo
              ? `Desde ${extremo}: elegí la otra punta.`
              : "Elegí las dos puntas del tramo. Se suma a lo que ya esté elegido."}
          </span>
        )}
      </div>
      )}

      {!compacto && (
      <div className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3">
        <FilaArcada
          arcada="sup"
          temporales={false}
          seleccionadas={seleccionadas}
          extremo={extremo}
          onPieza={clickPieza}
        />
        <FilaArcada
          arcada="inf"
          temporales={false}
          seleccionadas={seleccionadas}
          extremo={extremo}
          onPieza={clickPieza}
        />

        {temporales && (
          <>
            <p className="pt-2 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
              Temporales
            </p>
            <FilaArcada
              arcada="sup"
              temporales
              seleccionadas={seleccionadas}
              extremo={extremo}
              onPieza={clickPieza}
            />
            <FilaArcada
              arcada="inf"
              temporales
              seleccionadas={seleccionadas}
              extremo={extremo}
              onPieza={clickPieza}
            />
          </>
        )}
      </div>
      )}

      {!compacto && (
      <label className="flex items-center gap-2 text-xs text-ink-2">
        <Checkbox
          checked={temporales}
          onCheckedChange={(v) => setTemporales(v === true)}
        />
        Incluir temporales (cuadrantes 5 a 8)
      </label>
      )}
    </div>
  );
}

function FilaArcada({
  arcada,
  temporales,
  seleccionadas,
  extremo,
  onPieza,
}: {
  arcada: "sup" | "inf";
  temporales: boolean;
  seleccionadas: string[];
  extremo: string | null;
  onPieza: (pieza: string) => void;
}) {
  const piezas = secuenciaArcada(arcada, temporales);
  const mitad = piezas.length / 2;

  return (
    <div className="flex items-center gap-1">
      {piezas.map((pieza, i) => (
        <span key={pieza} className="flex items-center gap-1">
          {i === mitad && <span className="mx-1 h-7 w-px bg-border" aria-hidden />}
          <button
            type="button"
            aria-label={`Pieza ${pieza}`}
            aria-pressed={seleccionadas.includes(pieza)}
            onClick={() => onPieza(pieza)}
            className={cn(
              "size-7 rounded-sm border font-mono text-[11px] transition-colors",
              seleccionadas.includes(pieza)
                ? "border-accent bg-accent text-accent-ink"
                : extremo === pieza
                  ? "border-accent bg-accent-soft text-ink"
                  : "border-border bg-surface text-ink-2 hover:bg-surface-alt",
            )}
          >
            {pieza.replace(".", "")}
          </button>
        </span>
      ))}
    </div>
  );
}
