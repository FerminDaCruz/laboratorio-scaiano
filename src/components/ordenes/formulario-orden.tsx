"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, X } from "lucide-react";
import { useEffect, useRef } from "react";
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
  centavosDesdeTexto,
  formatARS,
  textoDesdeCentavos,
  type Centavos,
} from "@/lib/money";
import type { Doctor, ObraSocial, TrabajoConPrecio } from "@/lib/tipos";
import { armarEntrega, crearOrden, editarOrden, type AjusteOrden } from "./datos";

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
          cantidad: z.string(),
          piezas: z.string().nullable(),
          /** "cantidad" | "piezas" | "arcada": de dónde sale la cantidad. */
          modo_piezas: z.string(),
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
            return;
          }

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
        }),
    )
    .min(1, "La orden necesita al menos un trabajo."),
  // Descuento o plus de la orden. El precio del trabajo no se toca.
  ajuste_tipo: z.string(),
  ajuste_modo: z.string(),
  ajuste_valor: z.string(),
  ajuste_motivo: z.string(),
}).superRefine((valores, ctx) => {
  if (valores.ajuste_tipo === "") return;

  if (valores.ajuste_modo === "porcentaje") {
    const pct = porcentajeDesdeTexto(valores.ajuste_valor);
    if (pct === null || pct <= 0 || pct > 100) {
      ctx.addIssue({
        code: "custom",
        path: ["ajuste_valor"],
        message: "Poné un porcentaje mayor que cero y hasta 100.",
      });
    }
  } else {
    const monto = centavosDesdeTexto(valores.ajuste_valor);
    if (monto === null || monto <= 0) {
      ctx.addIssue({ code: "custom", path: ["ajuste_valor"], message: "Poné el importe." });
    }
  }

  if (valores.ajuste_motivo.trim() === "") {
    ctx.addIssue({
      code: "custom",
      path: ["ajuste_motivo"],
      message: "Un descuento o un plus necesita un motivo.",
    });
  }
});

/** "12,5", "12.5" o "12,5%" → 12.5. Null si no es un porcentaje. */
function porcentajeDesdeTexto(texto: string): number | null {
  const limpio = texto.trim().replace("%", "").replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(limpio)) return null;
  return Number(limpio);
}

/** Lo que suma o resta el ajuste sobre la suma de los trabajos. */
function calcularAjuste(base: Centavos, tipo: string, modo: string, valor: string): Centavos {
  if (tipo === "") return 0;
  const signo = tipo === "descuento" ? -1 : 1;

  if (modo === "porcentaje") {
    const pct = porcentajeDesdeTexto(valor);
    return pct === null ? 0 : signo * (aplicarPorcentaje(base, pct) - base);
  }

  const monto = centavosDesdeTexto(valor);
  return monto === null ? 0 : signo * monto;
}

type Formulario = z.infer<typeof esquema>;

const hoy = () => new Date().toISOString().slice(0, 10);

const ITEM_VACIO = { trabajo_id: "", cantidad: "1", piezas: null, modo_piezas: "cantidad" };

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
  items: { trabajo_id: number; cantidad: number; piezas: string | null }[];
  ajuste: Centavos;
  ajuste_pct: number | null;
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
      cantidad: String(i.cantidad),
      piezas: i.piezas,
      modo_piezas: modoDeItem(i.piezas),
    })),
    ajuste_tipo: orden.ajuste === 0 ? "" : orden.ajuste < 0 ? "descuento" : "plus",
    ajuste_modo: orden.ajuste_pct !== null ? "porcentaje" : "monto",
    ajuste_valor:
      orden.ajuste === 0
        ? ""
        : orden.ajuste_pct !== null
          ? String(Math.abs(orden.ajuste_pct))
          : textoDesdeCentavos(Math.abs(orden.ajuste)),
    ajuste_motivo: orden.ajuste_motivo ?? "",
  };
}

/** De dónde sale la cantidad de un ítem ya guardado. */
function modoDeItem(piezas: string | null): string {
  const valor = parsearPiezas(piezas);
  if (valor.modo === "arcada") return "arcada";
  return valor.modo === "partes" ? "piezas" : "cantidad";
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

/** El precio del catálogo: es el único que se cobra por el trabajo. */
function precioDelItem(
  item: { trabajo_id: string } | undefined,
  porId: Map<string, TrabajoConPrecio>,
): Centavos | null {
  if (!item) return null;
  return porId.get(item.trabajo_id)?.precio ?? null;
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
    ajuste_tipo: "",
    ajuste_modo: "porcentaje",
    ajuste_valor: "",
    ajuste_motivo: "",
  };
}

export function FormularioOrden({
  doctores,
  trabajos,
  obrasSociales,
  orden = null,
  onCreada,
  onGuardada,
  onCancelar,
}: {
  doctores: Doctor[];
  trabajos: TrabajoConPrecio[];
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

  const porId = new Map(trabajos.map((t) => [String(t.id), t]));
  const totalTrabajos = itemsMirados.reduce((suma, item) => {
    const precio = precioDelItem(item, porId);
    const cantidad = cantidadDelItem(item);
    if (precio === null || cantidad === null) return suma;
    return suma + precio * cantidad;
  }, 0);

  const ajusteTipo = watch("ajuste_tipo");
  const ajusteModo = watch("ajuste_modo");
  const ajusteValor = watch("ajuste_valor");
  const ajuste = calcularAjuste(totalTrabajos, ajusteTipo, ajusteModo, ajusteValor);
  const total = totalTrabajos + ajuste;

  function ajusteParaGuardar(datos: Formulario): AjusteOrden | null {
    if (datos.ajuste_tipo === "") return null;

    const signo = datos.ajuste_tipo === "descuento" ? -1 : 1;
    const motivo = datos.ajuste_motivo.trim();

    return datos.ajuste_modo === "porcentaje"
      ? { tipo: "porcentaje", porcentaje: signo * (porcentajeDesdeTexto(datos.ajuste_valor) ?? 0), motivo }
      : { tipo: "monto", monto: signo * (centavosDesdeTexto(datos.ajuste_valor) ?? 0), motivo };
  }

  async function guardar(datos: Formulario) {
    const comunes = {
      paciente: datos.paciente,
      items: datos.items.map((i) => ({
        trabajo_id: Number(i.trabajo_id),
        cantidad: cantidadDelItem(i) ?? 1,
        piezas: i.piezas,
      })),
      ajuste: ajusteParaGuardar(datos),
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
      toast.error(
        (error as { message?: string }).message?.includes("precio vigente")
          ? "Hay un trabajo sin precio vigente. Cargale el precio antes de usarlo en una orden."
          : (error as { message?: string }).message?.includes("remito")
            ? "La orden ya está en un remito: para cambiarla hay que corregir el remito."
            : /descuento|plus|motivo|porcentaje/.test(
                  (error as { message?: string }).message ?? "",
                )
              ? ((error as { message?: string }).message as string)
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
              trabajos={trabajos}
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

          <div className="flex flex-wrap items-start gap-3 border-t border-border pt-4">
            <Campo id="ajuste_tipo" etiqueta="Descuento o plus">
              <Controller
                control={control}
                name="ajuste_tipo"
                render={({ field }) => (
                  <SelectSimple
                    id="ajuste_tipo"
                    valor={field.value}
                    onCambio={field.onChange}
                    ancho="w-40"
                    placeholder="Sin ajuste"
                    opciones={[
                      { valor: "", etiqueta: "Sin ajuste" },
                      { valor: "descuento", etiqueta: "Descuento" },
                      { valor: "plus", etiqueta: "Plus" },
                    ]}
                  />
                )}
              />
            </Campo>

            {ajusteTipo !== "" && (
              <>
                <Campo id="ajuste_modo" etiqueta="Calculado">
                  <Controller
                    control={control}
                    name="ajuste_modo"
                    render={({ field }) => (
                      <SelectSimple
                        id="ajuste_modo"
                        valor={field.value}
                        onCambio={field.onChange}
                        ancho="w-40"
                        opciones={[
                          { valor: "porcentaje", etiqueta: "Porcentaje" },
                          { valor: "monto", etiqueta: "Monto fijo" },
                        ]}
                      />
                    )}
                  />
                </Campo>

                <Campo
                  id="ajuste_valor"
                  etiqueta={ajusteModo === "porcentaje" ? "Porcentaje" : "Importe"}
                  requerido
                  error={errors.ajuste_valor?.message}
                >
                  {ajusteModo === "porcentaje" ? (
                    <Input
                      id="ajuste_valor"
                      inputMode="decimal"
                      className="w-28"
                      placeholder="10"
                      aria-invalid={Boolean(errors.ajuste_valor)}
                      {...register("ajuste_valor")}
                    />
                  ) : (
                    <Controller
                      control={control}
                      name="ajuste_valor"
                      render={({ field }) => (
                        <InputMonto
                          id="ajuste_valor"
                          className="w-40"
                          valor={field.value}
                          onCambio={field.onChange}
                          invalido={Boolean(errors.ajuste_valor)}
                        />
                      )}
                    />
                  )}
                </Campo>

                <Campo
                  id="ajuste_motivo"
                  etiqueta="Motivo"
                  requerido
                  error={errors.ajuste_motivo?.message}
                >
                  <Input
                    id="ajuste_motivo"
                    className="w-72"
                    placeholder="Urgente, descuento acordado…"
                    aria-invalid={Boolean(errors.ajuste_motivo)}
                    {...register("ajuste_motivo")}
                  />
                </Campo>
              </>
            )}

            <div className="ml-auto flex flex-col items-end gap-1">
              {ajuste !== 0 && (
                <>
                  <p className="flex items-baseline gap-3 text-xs text-ink-2">
                    <span>Trabajos</span>
                    <span className="tabular-nums">{formatARS(totalTrabajos)}</span>
                  </p>
                  <p className="flex items-baseline gap-3 text-xs text-ink-2">
                    <span>{ajuste < 0 ? "Descuento" : "Plus"}</span>
                    <span className="tabular-nums">{formatARS(ajuste)}</span>
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
          </div>

          <p className="text-xs text-ink-3">
            Los precios salen del catálogo y los congela el servidor al guardar. Lo que se
            acuerde de más o de menos va en el descuento o el plus.
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
  trabajos,
  onQuitar,
}: {
  indice: number;
  formulario: UseFormReturn<Formulario>;
  trabajos: TrabajoConPrecio[];
  onQuitar?: () => void;
}) {
  const {
    control,
    register,
    setValue,
    watch,
    formState: { errors },
  } = formulario;

  const porId = new Map(trabajos.map((t) => [String(t.id), t]));
  const item = watch(`items.${indice}`);
  const modo = item?.modo_piezas ?? "cantidad";
  const precio = precioDelItem(item, porId);
  const cantidad = cantidadDelItem(item);
  const subtotal = precio !== null && cantidad !== null ? precio * cantidad : null;
  const erroresItem = errors.items?.[indice];
  const piezas = parsearPiezas(item?.piezas);
  const elegidas = piezasSeleccionadas(piezas).length;

  /** Cambiar de modo limpia lo que ya no corresponde, para no dejar datos colgados. */
  function cambiarModo(nuevo: string) {
    setValue(`items.${indice}.modo_piezas`, nuevo);
    setValue(`items.${indice}.piezas`, nuevo === "arcada" ? "arcada:sup" : null);
    if (nuevo !== "cantidad") setValue(`items.${indice}.cantidad`, nuevo === "arcada" ? "1" : "");
    else setValue(`items.${indice}.cantidad`, "1");
  }

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
              <Combobox
                id={`items.${indice}.trabajo_id`}
                valor={field.value || null}
                onCambio={(v) => field.onChange(v ?? "")}
                ancho="w-72"
                invalido={Boolean(erroresItem?.trabajo_id)}
                placeholder="Código o título…"
                opciones={trabajos.map((t) => ({
                  valor: String(t.id),
                  etiqueta: t.titulo,
                  busqueda: t.codigo,
                  detalle: t.codigo,
                }))}
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
          <p className="flex flex-col items-end">
            <span className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
              Subtotal
            </span>
            <span className="tabular-nums">{subtotal === null ? "—" : formatARS(subtotal)}</span>
          </p>
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
