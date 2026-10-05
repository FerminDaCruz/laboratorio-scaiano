"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Controller, useFieldArray, useForm, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Campo, SeccionFormulario } from "@/components/formulario/campo";
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
import { formatARS } from "@/lib/money";
import { COLORES_VITA, type Doctor, type ObraSocial, type TrabajoConPrecio } from "@/lib/tipos";
import { armarEntrega, crearOrden } from "./datos";

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
      z.object({
        trabajo_id: z.string().min(1, "Elegí el trabajo."),
        cantidad: z
          .string()
          .refine((v) => /^\d+$/.test(v) && Number(v) > 0, "La cantidad tiene que ser mayor que cero."),
        piezas: z.string().nullable(),
      }),
    )
    .min(1, "La orden necesita al menos un trabajo."),
});

type Formulario = z.infer<typeof esquema>;

const hoy = () => new Date().toISOString().slice(0, 10);

const ITEM_VACIO = { trabajo_id: "", cantidad: "1", piezas: null };

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
  trabajos,
  obrasSociales,
  onCreada,
}: {
  doctores: Doctor[];
  trabajos: TrabajoConPrecio[];
  obrasSociales: ObraSocial[];
  onCreada: (orden: { id: number; numero: number }) => void;
}) {
  const formulario = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: valoresIniciales(),
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
  const total = itemsMirados.reduce((suma, item) => {
    const trabajo = porId.get(item.trabajo_id);
    const cantidad = Number(item.cantidad);
    if (!trabajo?.precio || !Number.isInteger(cantidad)) return suma;
    return suma + trabajo.precio * cantidad;
  }, 0);

  async function guardar(datos: Formulario) {
    try {
      const creada = await crearOrden({
        doctor_id: Number(datos.doctor_id),
        paciente: datos.paciente,
        items: datos.items.map((i) => ({
          trabajo_id: Number(i.trabajo_id),
          cantidad: Number(i.cantidad),
          piezas: i.piezas,
        })),
        sexo: datos.sexo || null,
        edad: datos.edad === "" ? null : Number(datos.edad),
        obra_social_id: datos.obra_social_id ? Number(datos.obra_social_id) : null,
        color: datos.color || null,
        indicaciones: datos.indicaciones || null,
        fecha: datos.fecha,
        entrega_at: armarEntrega(datos.entrega_fecha, datos.entrega_hora),
      });

      toast.success(`Orden creada: OT ${formatOT(creada.numero)}`);
      onCreada(creada);

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
          <Campo id="doctor_id" etiqueta="Doctor" error={errors.doctor_id?.message}>
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
          </Campo>

          <Campo id="paciente" etiqueta="Paciente" error={errors.paciente?.message}>
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
              <Controller
                control={control}
                name="color"
                render={({ field }) => (
                  <Combobox
                    id="color"
                    valor={field.value || null}
                    onCambio={(v) => field.onChange(v ?? "")}
                    ancho="w-32"
                    placeholder="Elegir…"
                    opciones={COLORES_VITA.map((c) => ({ valor: c, etiqueta: c }))}
                  />
                )}
              />
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

          <div className="flex items-center justify-between gap-4">
            <Button type="button" variant="outline" onClick={() => items.append({ ...ITEM_VACIO })}>
              <Plus data-icon="inline-start" />
              Agregar trabajo
            </Button>
            <p className="flex items-baseline gap-3">
              <span className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
                Total estimado
              </span>
              <span className="text-lg font-semibold tabular-nums">{formatARS(total)}</span>
            </p>
          </div>
          <p className="text-xs text-ink-3">
            El precio definitivo lo congela el servidor al guardar, con el catálogo del día.
          </p>
        </div>
      </SeccionFormulario>

      <SeccionFormulario titulo="Entrega e indicaciones">
        <div className="flex max-w-[640px] flex-col gap-3">
          <div className="flex gap-3">
            <Campo id="fecha" etiqueta="Fecha de la orden" error={errors.fecha?.message}>
              <Input id="fecha" type="date" className="w-44" {...register("fecha")} />
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

      <div className="flex justify-end gap-2 pt-3">
        <Button type="button" variant="outline" onClick={() => reset(valoresIniciales())} disabled={isSubmitting}>
          Limpiar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Guardando…" : "Guardar orden"}
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
  const [abierto, setAbierto] = useState(false);
  const {
    control,
    register,
    watch,
    formState: { errors },
  } = formulario;

  const item = watch(`items.${indice}`);
  const trabajo = trabajos.find((t) => String(t.id) === item?.trabajo_id);
  const cantidad = Number(item?.cantidad);
  const subtotal = trabajo?.precio && Number.isInteger(cantidad) ? trabajo.precio * cantidad : null;
  const erroresItem = errors.items?.[indice];

  // Para los trabajos que se hacen pieza por pieza, la cantidad y las piezas elegidas
  // tienen que dar lo mismo. No aplica a una arcada completa ni a un trabajo sin pieza
  // (una prótesis completa es cantidad 1 y una arcada entera).
  const piezas = parsearPiezas(item?.piezas);
  const piezasElegidas =
    piezas.modo === "partes" ? piezasSeleccionadas(piezas).length : null;
  const noCoinciden =
    piezasElegidas !== null && Number.isInteger(cantidad) && cantidad > 0 && piezasElegidas !== cantidad;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4">
      <div className="flex flex-wrap items-end gap-3">
        <Campo
          id={`items.${indice}.trabajo_id`}
          etiqueta="Trabajo"
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

        <Campo
          id={`items.${indice}.cantidad`}
          etiqueta="Cantidad"
          error={erroresItem?.cantidad?.message}
        >
          <Input
            id={`items.${indice}.cantidad`}
            inputMode="numeric"
            className="w-24"
            {...register(`items.${indice}.cantidad`)}
          />
        </Campo>

        <Campo id={`items.${indice}.piezas`} etiqueta="Piezas">
          <div className="flex items-center gap-2">
            <Controller
              control={control}
              name={`items.${indice}.piezas`}
              render={({ field }) => (
                <div className="w-64">
                  <Odontograma
                    id={`items.${indice}.piezas`}
                    compacto
                    valor={field.value}
                    onCambio={field.onChange}
                  />
                </div>
              )}
            />
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-expanded={abierto}
                    onClick={() => setAbierto((v) => !v)}
                  />
                }
              >
                <ChevronDown />
              </TooltipTrigger>
              <TooltipContent>Elegir piezas en el odontograma</TooltipContent>
            </Tooltip>
          </div>
        </Campo>

        <div className="ml-auto flex items-center gap-3">
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

      {abierto && (
        <Controller
          control={control}
          name={`items.${indice}.piezas`}
          render={({ field }) => (
            <Odontograma
              id={`items.${indice}.piezas.grilla`}
              mostrarCampo={false}
              valor={field.value}
              onCambio={field.onChange}
            />
          )}
        />
      )}

      {!abierto && item?.piezas && (
        <p className="text-xs text-ink-3">
          Piezas: {formatPieza(item.piezas)}
          {piezasElegidas !== null && ` · ${piezasElegidas} ${piezasElegidas === 1 ? "pieza" : "piezas"}`}
        </p>
      )}

      {noCoinciden && (
        <p className="text-xs text-warn">
          La cantidad dice {cantidad} y elegiste {piezasElegidas}{" "}
          {piezasElegidas === 1 ? "pieza" : "piezas"}. Si es un trabajo que se hace pieza por
          pieza, revisá antes de guardar.
        </p>
      )}
    </div>
  );
}
