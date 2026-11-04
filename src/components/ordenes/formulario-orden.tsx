"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Controller, useFieldArray, useForm, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Campo, NotaCamposRequeridos, SeccionFormulario } from "@/components/formulario/campo";
import { InputMonto } from "@/components/formulario/input-monto";
import { Combobox } from "@/components/formulario/combobox";
import { SelectSimple } from "@/components/formulario/select-simple";
import { Odontograma } from "@/components/odontograma/odontograma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { alTeclearEnFormulario } from "@/hooks/use-atajos";
import { formatPieza, parsearPiezas, piezasSeleccionadas } from "@/lib/fdi";
import { formatOT } from "@/lib/format";
import {
  aplicarPorcentaje,
  centavosDesdeNumeric,
  centavosDesdeTexto,
  formatARS,
  formatearEntradaMonto,
  textoDesdeCentavos,
  type Centavos,
} from "@/lib/money";
import type { Doctor, ObraSocial, TipoAjusteItem } from "@/lib/tipos";
import { ComboboxTrabajo } from "./combobox-trabajo";
import { armarEntrega, crearOrden, editarOrden, type AjusteItem } from "./datos";

/**
 * Cómo se modifica el precio de un trabajo, sobre su subtotal de catálogo. "" es sin
 * modificar. El signo del porcentaje y del monto sale de la opción, no de lo que se tipea.
 */
const MODIFICACIONES = [
  { valor: "", etiqueta: "Sin modificar" },
  { valor: "precio", etiqueta: "Precio final" },
  { valor: "descuento_pct", etiqueta: "Descuento en %" },
  { valor: "plus_pct", etiqueta: "Plus en %" },
  { valor: "descuento_monto", etiqueta: "Descuento en $" },
  { valor: "plus_monto", etiqueta: "Plus en $" },
];

const esPorcentaje = (modo: string) => modo === "descuento_pct" || modo === "plus_pct";

const esquema = z.object({
  doctor_id: z.string().min(1, "Elegí el doctor."),
  paciente: z.string().trim().min(1, "Ingresá el nombre del paciente."),
  sexo: z.string(),
  edad: z
    .string()
    .refine((v) => v === "" || /^\d{1,3}$/.test(v), "La edad tiene que ser un número.")
    .refine((v) => v === "" || Number(v) <= 120, "Esa edad no parece correcta."),
  obra_social_id: z.string(),
  color: z.string(),
  fecha: z.string().min(1, "Ingresá la fecha."),
  entrega_fecha: z.string(),
  entrega_hora: z.string(),
  indicaciones: z.string(),
  items: z
    .array(
      z
        .object({
          trabajo_id: z.string().min(1, "Elegí el trabajo."),
          /** Lo que muestra el combo, para no volver a pedir el trabajo a la base. */
          trabajo_titulo: z.string(),
          /** Precio unitario de catálogo, en centavos. */
          precio: z.number().nullable(),
          cantidad: z.string(),
          piezas: z.string().nullable(),
          /** "cantidad" | "piezas" | "arcada": de dónde sale la cantidad. */
          modo_piezas: z.string(),
          /** Ver MODIFICACIONES. */
          ajuste_modo: z.string(),
          ajuste_valor: z.string(),
          /** Opcional. */
          ajuste_motivo: z.string(),
        })
        .superRefine((item, ctx) => {
          if (item.modo_piezas === "piezas") {
            if (piezasSeleccionadas(parsearPiezas(item.piezas)).length === 0) {
              ctx.addIssue({
                code: "custom",
                path: ["piezas"],
                message: "Elegí las piezas en el diagrama.",
              });
            }
          } else {
            if (item.modo_piezas === "arcada" && parsearPiezas(item.piezas).modo !== "arcada") {
              ctx.addIssue({ code: "custom", path: ["piezas"], message: "Elegí la arcada." });
            }
            if (!/^\d+$/.test(item.cantidad) || Number(item.cantidad) <= 0) {
              ctx.addIssue({
                code: "custom",
                path: ["cantidad"],
                message: "La cantidad tiene que ser mayor que cero.",
              });
            }
          }

          const error = errorDeModificacion(item);
          if (error) ctx.addIssue({ code: "custom", path: ["ajuste_valor"], message: error });
        }),
    )
    .min(1, "La orden necesita al menos un trabajo."),
});

type Formulario = z.infer<typeof esquema>;
type ItemFormulario = Formulario["items"][number];

/** "12,5", "12.5" o "12,5%" → 12.5. Null si no es un porcentaje. */
function porcentajeDesdeTexto(texto: string): number | null {
  const limpio = texto.trim().replace("%", "").replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(limpio)) return null;
  return Number(limpio);
}

/**
 * La cantidad que se cobra. Si el trabajo se carga por piezas, la cantidad es el
 * número de piezas elegidas y no se escribe a mano.
 */
function cantidadDelItem(
  item: { cantidad: string; piezas: string | null; modo_piezas: string } | undefined,
): number | null {
  if (!item) return null;

  if (item.modo_piezas === "piezas") {
    const elegidas = piezasSeleccionadas(parsearPiezas(item.piezas)).length;
    return elegidas === 0 ? null : elegidas;
  }

  return /^\d+$/.test(item.cantidad) && Number(item.cantidad) > 0 ? Number(item.cantidad) : null;
}

/** Precio de catálogo × cantidad, sin modificar. */
function subtotalDelItem(item: ItemFormulario | undefined): Centavos | null {
  if (!item || item.precio === null) return null;
  const cantidad = cantidadDelItem(item);
  return cantidad === null ? null : item.precio * cantidad;
}

/** Lo que se cobra por el ítem: el subtotal de catálogo con su modificación. */
function importeDelItem(item: ItemFormulario | undefined): Centavos | null {
  const base = subtotalDelItem(item);
  if (!item || base === null || item.ajuste_modo === "") return base;

  const modo = item.ajuste_modo;
  if (modo === "precio") return centavosDesdeTexto(item.ajuste_valor) ?? base;

  if (esPorcentaje(modo)) {
    const pct = porcentajeDesdeTexto(item.ajuste_valor);
    if (pct === null) return base;
    return aplicarPorcentaje(base, modo === "descuento_pct" ? -pct : pct);
  }

  const monto = centavosDesdeTexto(item.ajuste_valor);
  if (monto === null) return base;
  return modo === "descuento_monto" ? base - monto : base + monto;
}

/** Lo que está mal en la modificación de precio de un ítem, o null. */
function errorDeModificacion(item: ItemFormulario): string | null {
  const modo = item.ajuste_modo;
  if (modo === "") return null;

  if (esPorcentaje(modo)) {
    const pct = porcentajeDesdeTexto(item.ajuste_valor);
    if (pct === null || pct <= 0) return "Poné un porcentaje mayor que cero.";
    if (modo === "descuento_pct" && pct > 100) return "Un descuento no puede pasar del 100 %.";
    return null;
  }

  const monto = centavosDesdeTexto(item.ajuste_valor);
  if (modo === "precio") {
    return monto === null || monto < 0 ? "Poné el precio que se cobra." : null;
  }
  if (monto === null || monto <= 0) return "Poné el importe.";

  const base = subtotalDelItem(item);
  if (modo === "descuento_monto" && base !== null && monto > base) {
    return "El descuento no puede ser mayor que el precio del trabajo.";
  }
  return null;
}

/** La modificación como la espera el servidor, o null si se cobra el precio de catálogo. */
function ajusteParaGuardar(item: ItemFormulario): AjusteItem | null {
  const modo = item.ajuste_modo;
  const motivo = item.ajuste_motivo.trim();
  if (modo === "") return null;

  if (modo === "precio") {
    return { tipo: "precio", importe: centavosDesdeTexto(item.ajuste_valor) ?? 0, motivo };
  }
  if (esPorcentaje(modo)) {
    const pct = porcentajeDesdeTexto(item.ajuste_valor) ?? 0;
    return { tipo: "porcentaje", porcentaje: modo === "descuento_pct" ? -pct : pct, motivo };
  }
  const monto = centavosDesdeTexto(item.ajuste_valor) ?? 0;
  return { tipo: "monto", monto: modo === "descuento_monto" ? -monto : monto, motivo };
}

/** De la modificación guardada en la base a lo que muestra el formulario. */
function modificacionGuardada(
  tipo: TipoAjusteItem | null,
  valor: number | null,
): { ajuste_modo: string; ajuste_valor: string } {
  if (tipo === null || valor === null) return { ajuste_modo: "", ajuste_valor: "" };

  const negativo = valor < 0;
  if (tipo === "porcentaje") {
    return {
      ajuste_modo: negativo ? "descuento_pct" : "plus_pct",
      ajuste_valor: String(Math.abs(valor)).replace(".", ","),
    };
  }

  const texto = formatearEntradaMonto(textoDesdeCentavos(Math.abs(centavosDesdeNumeric(valor))));
  if (tipo === "precio") return { ajuste_modo: "precio", ajuste_valor: texto };
  return { ajuste_modo: negativo ? "descuento_monto" : "plus_monto", ajuste_valor: texto };
}

const hoy = () => new Date().toISOString().slice(0, 10);

const ITEM_VACIO: ItemFormulario = {
  trabajo_id: "",
  trabajo_titulo: "",
  precio: null,
  cantidad: "1",
  piezas: null,
  modo_piezas: "cantidad",
  ajuste_modo: "",
  ajuste_valor: "",
  ajuste_motivo: "",
};

/** Una orden que se está editando. Los precios ya están congelados en el servidor. */
export type OrdenEditable = {
  id: number;
  numero: number;
  doctor_id: number;
  paciente: string;
  sexo: string | null;
  edad: number | null;
  obra_social_id: number | null;
  color: string | null;
  fecha: string;
  entrega_at: string | null;
  indicaciones: string | null;
  items: {
    trabajo_id: number;
    titulo: string;
    /** El precio unitario congelado en la orden. */
    precio_unitario: Centavos;
    cantidad: number;
    piezas: string | null;
    ajuste_tipo: TipoAjusteItem | null;
    ajuste_valor: number | null;
    ajuste_motivo: string | null;
  }[];
  /** Ajuste sobre el total, de antes de que el precio se modificara por trabajo. */
  ajuste: Centavos;
  ajuste_motivo: string | null;
};

function valoresDeOrden(orden: OrdenEditable): Formulario {
  const entrega = orden.entrega_at ? new Date(orden.entrega_at) : null;
  const dosDigitos = (n: number) => String(n).padStart(2, "0");
  return {
    doctor_id: String(orden.doctor_id),
    paciente: orden.paciente,
    sexo: orden.sexo ?? "",
    edad: orden.edad === null ? "" : String(orden.edad),
    obra_social_id: orden.obra_social_id ? String(orden.obra_social_id) : "",
    color: orden.color ?? "",
    fecha: orden.fecha,
    entrega_fecha: entrega
      ? [
          entrega.getFullYear(),
          dosDigitos(entrega.getMonth() + 1),
          dosDigitos(entrega.getDate()),
        ].join("-")
      : "",
    entrega_hora: entrega
      ? [dosDigitos(entrega.getHours()), dosDigitos(entrega.getMinutes())].join(":")
      : "",
    indicaciones: orden.indicaciones ?? "",
    items: orden.items.map((i) => ({
      trabajo_id: String(i.trabajo_id),
      trabajo_titulo: i.titulo,
      precio: i.precio_unitario,
      cantidad: String(i.cantidad),
      piezas: i.piezas,
      modo_piezas: modoDeItem(i.piezas),
      ...modificacionGuardada(i.ajuste_tipo, i.ajuste_valor),
      ajuste_motivo: i.ajuste_motivo ?? "",
    })),
  };
}

/** De dónde sale la cantidad de un ítem ya guardado. */
function modoDeItem(piezas: string | null): string {
  const valor = parsearPiezas(piezas);
  if (valor.modo === "arcada") return "arcada";
  return valor.modo === "partes" ? "piezas" : "cantidad";
}

function valoresIniciales(): Formulario {
  return {
    doctor_id: "",
    paciente: "",
    sexo: "",
    edad: "",
    obra_social_id: "",
    color: "",
    fecha: hoy(),
    entrega_fecha: "",
    entrega_hora: "",
    indicaciones: "",
    items: [{ ...ITEM_VACIO }],
  };
}

export function FormularioOrden({
  doctores,
  obrasSociales,
  orden = null,
  onCreada,
  onGuardada,
  onCancelar,
}: {
  doctores: Doctor[];
  obrasSociales: ObraSocial[];
  /** Si viene una orden, el formulario la edita en vez de crear una nueva. */
  orden?: OrdenEditable | null;
  onCreada?: (orden: { id: number; numero: number }) => void;
  onGuardada?: (orden: { id: number; numero: number }) => void;
  onCancelar?: () => void;
}) {
  const editando = orden !== null;

  const formulario = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: orden ? valoresDeOrden(orden) : valoresIniciales(),
  });
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    reset,
    formState: { errors, isSubmitting },
  } = formulario;

  const items = useFieldArray({ control, name: "items" });
  const paciente = useRef<HTMLInputElement | null>(null);

  const doctorId = watch("doctor_id");
  const itemsMirados = watch("items");

  // Al elegir el doctor se propone su obra social habitual.
  useEffect(() => {
    if (!doctorId) return;
    const doctor = doctores.find((d) => String(d.id) === doctorId);
    if (doctor?.obra_social_id && getValues("obra_social_id") === "") {
      setValue("obra_social_id", String(doctor.obra_social_id));
    }
  }, [doctorId, doctores, getValues, setValue]);

  const totalCatalogo = itemsMirados.reduce((suma, item) => suma + (subtotalDelItem(item) ?? 0), 0);
  const total = itemsMirados.reduce((suma, item) => suma + (importeDelItem(item) ?? 0), 0);
  const diferencia = total - totalCatalogo;

  async function guardar(datos: Formulario) {
    const comunes = {
      paciente: datos.paciente,
      items: datos.items.map((i) => ({
        trabajo_id: Number(i.trabajo_id),
        cantidad: cantidadDelItem(i) ?? 1,
        piezas: i.piezas,
        ajuste: ajusteParaGuardar(i),
      })),
      sexo: datos.sexo || null,
      edad: datos.edad === "" ? null : Number(datos.edad),
      obra_social_id: datos.obra_social_id ? Number(datos.obra_social_id) : null,
      color: datos.color || null,
      indicaciones: datos.indicaciones || null,
      entrega_at: armarEntrega(datos.entrega_fecha, datos.entrega_hora),
    };

    try {
      if (orden) {
        const guardada = await editarOrden(orden.id, comunes);
        toast.success(`Orden actualizada: OT ${formatOT(guardada.numero)}`);
        onGuardada?.(guardada);
        return;
      }

      const creada = await crearOrden({
        ...comunes,
        doctor_id: Number(datos.doctor_id),
        fecha: datos.fecha,
      });

      toast.success(`Orden creada: OT ${formatOT(creada.numero)}`);
      onCreada?.(creada);

      // Se deja listo para la orden siguiente, con el mismo doctor y la misma fecha.
      reset({
        ...valoresIniciales(),
        doctor_id: datos.doctor_id,
        fecha: datos.fecha,
        entrega_fecha: datos.entrega_fecha,
        entrega_hora: datos.entrega_hora,
      });
      paciente.current?.focus();
    } catch (error) {
      const mensaje = (error as { message?: string }).message ?? "";
      toast.error(
        mensaje.includes("precio vigente")
          ? "Hay un trabajo sin precio vigente. Cargale el precio antes de usarlo en una orden."
          : mensaje.includes("remito")
            ? "La orden ya está en un remito: para cambiarla hay que corregir el remito."
            : /descuento|precio de un trabajo|100 %/.test(mensaje)
              ? mensaje
              : "No se pudo guardar la orden. Revisá la conexión y probá de nuevo.",
        { duration: Infinity },
      );
    }
  }

  const registroPaciente = register("paciente");

  return (
    <form
      className="flex flex-col gap-6"
      noValidate
      onSubmit={handleSubmit(guardar)}
      onKeyDown={alTeclearEnFormulario}
    >
      <SeccionFormulario titulo="Orden" primera>
        <div className="flex max-w-[640px] flex-col gap-3">
          <Campo
            id="doctor_id"
            etiqueta="Doctor"
            requerido
            error={errors.doctor_id?.message}
            ayuda={editando ? "El doctor de una orden ya cargada no se cambia." : undefined}
          >
            {editando ? (
              <Input
                id="doctor_id"
                readOnly
                value={doctores.find((d) => String(d.id) === watch("doctor_id"))?.nombre ?? ""}
              />
            ) : (
            <Controller
              control={control}
              name="doctor_id"
              render={({ field }) => (
                <Combobox
                  id="doctor_id"
                  valor={field.value || null}
                  onCambio={(v) => field.onChange(v ?? "")}
                  invalido={Boolean(errors.doctor_id)}
                  placeholder="Buscar por nombre o ficha…"
                  opciones={doctores.map((d) => ({
                    valor: String(d.id),
                    etiqueta: d.nombre,
                    busqueda: String(d.ficha),
                    detalle: `ficha ${d.ficha}`,
                  }))}
                />
              )}
            />
            )}
          </Campo>

          <Campo id="paciente" etiqueta="Paciente" requerido error={errors.paciente?.message}>
            <Input
              id="paciente"
              aria-invalid={errors.paciente ? true : undefined}
              {...registroPaciente}
              ref={(el) => {
                registroPaciente.ref(el);
                paciente.current = el;
              }}
            />
          </Campo>

          <div className="flex gap-3">
            <Campo id="sexo" etiqueta="Sexo">
              <Controller
                control={control}
                name="sexo"
                render={({ field }) => (
                  <SelectSimple
                    id="sexo"
                    valor={field.value}
                    onCambio={field.onChange}
                    ancho="w-40"
                    placeholder="Sin especificar"
                    opciones={[
                      { valor: "", etiqueta: "Sin especificar" },
                      { valor: "F", etiqueta: "Femenino" },
                      { valor: "M", etiqueta: "Masculino" },
                    ]}
                  />
                )}
              />
            </Campo>
            <Campo id="edad" etiqueta="Edad" error={errors.edad?.message}>
              <Input id="edad" inputMode="numeric" className="w-24" {...register("edad")} />
            </Campo>
            <Campo id="color" etiqueta="Color">
              {/* Texto libre: el laboratorio usa varias guías y no todas son Vita. */}
              <Input id="color" className="w-40" placeholder="A2, 3M2, BL3…" {...register("color")} />
            </Campo>
          </div>

          <Campo id="obra_social_id" etiqueta="Obra social">
            <Controller
              control={control}
              name="obra_social_id"
              render={({ field }) => (
                <SelectSimple
                  id="obra_social_id"
                  valor={field.value}
                  onCambio={field.onChange}
                  placeholder="Sin obra social"
                  opciones={[
                    { valor: "", etiqueta: "Sin obra social" },
                    ...obrasSociales.map((o) => ({ valor: String(o.id), etiqueta: o.nombre })),
                  ]}
                />
              )}
            />
          </Campo>
        </div>
      </SeccionFormulario>

      <SeccionFormulario titulo="Trabajos">
        <div className="flex flex-col gap-3">
          {errors.items?.message && <p className="text-xs text-danger">{errors.items.message}</p>}

          {items.fields.map((campo, i) => (
            <FilaItem
              key={campo.id}
              indice={i}
              formulario={formulario}
              onQuitar={items.fields.length > 1 ? () => items.remove(i) : undefined}
            />
          ))}

          <Button
            type="button"
            variant="outline"
            className="self-start"
            onClick={() => items.append({ ...ITEM_VACIO })}
          >
            <Plus data-icon="inline-start" />
            Agregar trabajo
          </Button>

          {orden !== null && orden.ajuste !== 0 && (
            <p className="text-xs text-warn">
              Esta orden tenía {orden.ajuste < 0 ? "un descuento" : "un plus"} de{" "}
              {formatARS(Math.abs(orden.ajuste))} sobre el total
              {orden.ajuste_motivo ? ` (${orden.ajuste_motivo})` : ""}. Ahora el precio se
              modifica en cada trabajo: al guardar, ese ajuste se quita. Si corresponde,
              cargalo en el trabajo.
            </p>
          )}

          <div className="flex flex-col items-end gap-1 border-t border-border pt-4">
            {diferencia !== 0 && (
              <>
                <p className="flex items-baseline gap-3 text-xs text-ink-2">
                  <span>Precio de catálogo</span>
                  <span className="tabular-nums">{formatARS(totalCatalogo)}</span>
                </p>
                <p className="flex items-baseline gap-3 text-xs text-ink-2">
                  <span>Modificaciones</span>
                  <span className="tabular-nums">{formatARS(diferencia)}</span>
                </p>
              </>
            )}
            <p className="flex items-baseline gap-3">
              <span className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
                Total estimado
              </span>
              <span className="text-lg font-semibold tabular-nums">{formatARS(total)}</span>
            </p>
          </div>

          <p className="text-xs text-ink-3">
            Los precios salen del catálogo y los congela el servidor al guardar. Para cobrar
            otro importe por un trabajo, clickeá su subtotal.
          </p>
        </div>
      </SeccionFormulario>

      <SeccionFormulario titulo="Entrega e indicaciones">
        <div className="flex max-w-[640px] flex-col gap-3">
          <div className="flex gap-3">
            <Campo
              id="fecha"
              etiqueta="Fecha de la orden"
              requerido
              error={errors.fecha?.message}
            >
              <Input
                id="fecha"
                type="date"
                className="w-44"
                readOnly={editando}
                {...register("fecha")}
              />
            </Campo>
            <Campo id="entrega_fecha" etiqueta="Entrega">
              <Input id="entrega_fecha" type="date" className="w-44" {...register("entrega_fecha")} />
            </Campo>
            <Campo id="entrega_hora" etiqueta="Hora">
              <Input id="entrega_hora" type="time" className="w-32" {...register("entrega_hora")} />
            </Campo>
          </div>
          <Campo id="indicaciones" etiqueta="Indicaciones">
            <Textarea id="indicaciones" {...register("indicaciones")} />
          </Campo>
        </div>
      </SeccionFormulario>

      <NotaCamposRequeridos />

      <div className="flex justify-end gap-2 pt-3">
        <Button
          type="button"
          variant="outline"
          disabled={isSubmitting}
          onClick={() => (editando ? onCancelar?.() : reset(valoresIniciales()))}
        >
          {editando ? "Cancelar" : "Limpiar"}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Guardando…" : editando ? "Guardar cambios" : "Guardar orden"}
        </Button>
      </div>
    </form>
  );
}

function FilaItem({
  indice,
  formulario,
  onQuitar,
}: {
  indice: number;
  formulario: UseFormReturn<Formulario>;
  onQuitar?: () => void;
}) {
  const {
    control,
    register,
    setValue,
    watch,
    formState: { errors },
  } = formulario;

  const item = watch(`items.${indice}`);
  const modo = item?.modo_piezas ?? "cantidad";
  const modificacion = item?.ajuste_modo ?? "";
  const subtotal = subtotalDelItem(item);
  const importe = importeDelItem(item);
  const erroresItem = errors.items?.[indice];
  const piezas = parsearPiezas(item?.piezas);
  const elegidas = piezasSeleccionadas(piezas).length;

  // La fila de la modificación se abre al clickear el subtotal y queda abierta mientras haya una.
  const [editandoPrecio, setEditandoPrecio] = useState(modificacion !== "");
  const mostrarModificacion = editandoPrecio || modificacion !== "";

  /** Cambiar de modo limpia lo que ya no corresponde, para no dejar datos colgados. */
  function cambiarModo(nuevo: string) {
    setValue(`items.${indice}.modo_piezas`, nuevo);
    setValue(`items.${indice}.piezas`, nuevo === "arcada" ? "arcada:sup" : null);
    if (nuevo !== "cantidad") setValue(`items.${indice}.cantidad`, nuevo === "arcada" ? "1" : "");
    else setValue(`items.${indice}.cantidad`, "1");
  }

  /** El subtotal es el atajo: abre la modificación con el precio final ya escrito. */
  function modificarPrecio() {
    if (modificacion === "") {
      setValue(`items.${indice}.ajuste_modo`, "precio");
      setValue(
        `items.${indice}.ajuste_valor`,
        subtotal === null ? "" : formatearEntradaMonto(textoDesdeCentavos(subtotal)),
      );
    }
    setEditandoPrecio(true);
  }

  function cambiarModificacion(nueva: string) {
    setValue(`items.${indice}.ajuste_modo`, nueva, { shouldValidate: false });
    if (nueva === "") {
      setValue(`items.${indice}.ajuste_valor`, "");
      setValue(`items.${indice}.ajuste_motivo`, "");
      setEditandoPrecio(false);
      return;
    }
    // El precio final arranca en el subtotal; el porcentaje y el monto, vacíos.
    setValue(
      `items.${indice}.ajuste_valor`,
      nueva === "precio" && subtotal !== null
        ? formatearEntradaMonto(textoDesdeCentavos(subtotal))
        : "",
    );
  }

  const idValor = `items.${indice}.ajuste_valor`;

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start gap-3">
        <Campo
          id={`items.${indice}.trabajo_id`}
          etiqueta="Trabajo"
          requerido
          error={erroresItem?.trabajo_id?.message}
        >
          <Controller
            control={control}
            name={`items.${indice}.trabajo_id`}
            render={({ field }) => (
              <ComboboxTrabajo
                id={`items.${indice}.trabajo_id`}
                elegido={
                  field.value ? { id: field.value, titulo: item?.trabajo_titulo ?? "" } : null
                }
                onCambio={(trabajo) => {
                  field.onChange(String(trabajo.id));
                  setValue(`items.${indice}.trabajo_titulo`, trabajo.titulo);
                  setValue(`items.${indice}.precio`, trabajo.precio);
                  // El precio final escrito era para el trabajo anterior.
                  if (modificacion === "precio") {
                    setValue(`items.${indice}.ajuste_modo`, "");
                    setValue(`items.${indice}.ajuste_valor`, "");
                    setEditandoPrecio(false);
                  }
                }}
                ancho="w-72"
                invalido={Boolean(erroresItem?.trabajo_id)}
              />
            )}
          />
        </Campo>

        <Campo id={`items.${indice}.modo_piezas`} etiqueta="Se cobra por">
          <Controller
            control={control}
            name={`items.${indice}.modo_piezas`}
            render={({ field }) => (
              <SelectSimple
                id={`items.${indice}.modo_piezas`}
                valor={field.value}
                onCambio={(v) => cambiarModo(v ?? "cantidad")}
                ancho="w-40"
                opciones={[
                  { valor: "cantidad", etiqueta: "Cantidad" },
                  { valor: "piezas", etiqueta: "Piezas" },
                  { valor: "arcada", etiqueta: "Arcada" },
                ]}
              />
            )}
          />
        </Campo>

        {modo === "arcada" && (
          <Campo
            id={`items.${indice}.piezas`}
            etiqueta="Arcada"
            requerido
            error={erroresItem?.piezas?.message}
          >
            <Controller
              control={control}
              name={`items.${indice}.piezas`}
              render={({ field }) => (
                <SelectSimple
                  id={`items.${indice}.piezas`}
                  valor={piezas.modo === "arcada" ? piezas.arcada : ""}
                  onCambio={(v) => field.onChange(v ? `arcada:${v}` : null)}
                  ancho="w-40"
                  placeholder="Elegí la arcada"
                  opciones={[
                    { valor: "sup", etiqueta: "Superior" },
                    { valor: "inf", etiqueta: "Inferior" },
                    { valor: "ambas", etiqueta: "Ambas" },
                  ]}
                />
              )}
            />
          </Campo>
        )}

        {modo === "piezas" ? (
          <Campo id={`items.${indice}.cantidad`} etiqueta="Cantidad">
            <p className="flex h-9 items-center text-sm tabular-nums">
              {elegidas === 0 ? "—" : `${elegidas} ${elegidas === 1 ? "pieza" : "piezas"}`}
            </p>
          </Campo>
        ) : (
          <Campo
            id={`items.${indice}.cantidad`}
            etiqueta="Cantidad"
            requerido
            error={erroresItem?.cantidad?.message}
          >
            <Input
              id={`items.${indice}.cantidad`}
              inputMode="numeric"
              className="w-24"
              aria-invalid={Boolean(erroresItem?.cantidad)}
              {...register(`items.${indice}.cantidad`)}
            />
          </Campo>
        )}

        <div className="ml-auto flex items-start gap-3">
          <div className="flex flex-col items-end">
            <span className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
              Subtotal
            </span>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    className="tabular-nums"
                    disabled={subtotal === null}
                    onClick={modificarPrecio}
                  />
                }
              >
                {importe === null ? "—" : formatARS(importe)}
              </TooltipTrigger>
              <TooltipContent>Modificar el precio de este trabajo</TooltipContent>
            </Tooltip>
            {modificacion !== "" && subtotal !== null && importe !== subtotal && (
              <span className="text-xs text-ink-3 tabular-nums">
                catálogo {formatARS(subtotal)}
              </span>
            )}
          </div>
          {onQuitar && (
            <Tooltip>
              <TooltipTrigger
                render={<Button type="button" variant="ghost" size="icon-sm" onClick={onQuitar} />}
              >
                <X />
              </TooltipTrigger>
              <TooltipContent>Quitar este trabajo</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {mostrarModificacion && (
        <div className="flex flex-wrap items-start gap-3 border-t border-border pt-3">
          <Campo id={`items.${indice}.ajuste_modo`} etiqueta="Modificar precio">
            <Controller
              control={control}
              name={`items.${indice}.ajuste_modo`}
              render={({ field }) => (
                <SelectSimple
                  id={`items.${indice}.ajuste_modo`}
                  valor={field.value}
                  onCambio={(v) => cambiarModificacion(v ?? "")}
                  ancho="w-44"
                  opciones={MODIFICACIONES}
                />
              )}
            />
          </Campo>

          {modificacion !== "" && (
            <>
              <Campo
                id={idValor}
                etiqueta={
                  modificacion === "precio"
                    ? "Se cobra"
                    : esPorcentaje(modificacion)
                      ? "Porcentaje"
                      : "Importe"
                }
                requerido
                error={erroresItem?.ajuste_valor?.message}
              >
                {esPorcentaje(modificacion) ? (
                  <Input
                    id={idValor}
                    inputMode="decimal"
                    className="w-28 text-right tabular-nums"
                    placeholder="10"
                    autoFocus={editandoPrecio}
                    aria-invalid={Boolean(erroresItem?.ajuste_valor)}
                    {...register(`items.${indice}.ajuste_valor`)}
                  />
                ) : (
                  <Controller
                    control={control}
                    name={`items.${indice}.ajuste_valor`}
                    render={({ field }) => (
                      <InputMonto
                        id={idValor}
                        className="w-40"
                        autoFocus={editandoPrecio}
                        valor={field.value}
                        onCambio={field.onChange}
                        invalido={Boolean(erroresItem?.ajuste_valor)}
                      />
                    )}
                  />
                )}
              </Campo>

              <Campo id={`items.${indice}.ajuste_motivo`} etiqueta="Motivo">
                <Input
                  id={`items.${indice}.ajuste_motivo`}
                  className="w-72"
                  placeholder="Opcional: urgente, precio acordado…"
                  {...register(`items.${indice}.ajuste_motivo`)}
                />
              </Campo>
            </>
          )}
        </div>
      )}

      {modo === "piezas" && (
        <>
          <Campo
            id={`items.${indice}.piezas.grilla`}
            etiqueta="Piezas"
            requerido
            error={erroresItem?.piezas?.message}
            ayuda={
              elegidas === 0
                ? "Clickeá las piezas en el diagrama. Tres o más seguidas se agrupan en un tramo."
                : `${formatPieza(item?.piezas)} · ${elegidas} ${elegidas === 1 ? "pieza" : "piezas"}`
            }
          >
            <Controller
              control={control}
              name={`items.${indice}.piezas`}
              render={({ field }) => (
                <Odontograma
                  id={`items.${indice}.piezas.grilla`}
                  valor={field.value}
                  onCambio={field.onChange}
                  mostrarCampo={false}
                  mostrarModos={false}
                  agruparAlClickear
                />
              )}
            />
          </Campo>
        </>
      )}
    </div>
  );
}
