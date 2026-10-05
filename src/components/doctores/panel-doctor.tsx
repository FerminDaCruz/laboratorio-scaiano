"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
  AccionesFormulario,
  Campo,
  Dato,
  NotaCamposRequeridos,
  SeccionFormulario,
} from "@/components/formulario/campo";
import { SelectSimple } from "@/components/formulario/select-simple";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { alTeclearEnFormulario } from "@/hooks/use-atajos";
import { useConsulta } from "@/hooks/use-consulta";
import { formatFechaCorta } from "@/lib/format";
import { formatARS, type Centavos } from "@/lib/money";
import type { Doctor, ObraSocial } from "@/lib/tipos";
import {
  CODIGO_DUPLICADO,
  fichaConFormato,
  guardarDoctor,
  proximaFichaLibre,
  saldoDeDoctor,
} from "./datos";

/**
 * La ficha de un doctor nuevo empieza con 100 y tiene seis dígitos. Las fichas
 * viejas (las que ya existían o las que venga a traer la migración de E12) se
 * dejan como están: solo se valida el formato cuando el número cambia.
 */
function crearEsquema(fichaOriginal: number | null) {
  return z.object({
  ficha: z.coerce
    .number({ invalid_type_error: "La ficha tiene que ser un número." })
    .int("La ficha tiene que ser un número entero.")
    .positive("La ficha tiene que ser mayor que cero.")
    .refine(
      (valor) => valor === fichaOriginal || fichaConFormato(valor),
      "La ficha empieza con 100 y tiene seis dígitos, por ejemplo 100102.",
    ),
  nombre: z.string().trim().min(1, "Ingresá el nombre."),
  domicilio: z.string().trim(),
  piso: z.string().trim(),
  departamento: z.string().trim(),
  localidad: z.string().trim(),
  telefono: z.string().trim(),
  obra_social_id: z.string(),
  fecha_alta: z.string().min(1, "Ingresá la fecha de alta."),
  activo: z.boolean(),
  notas: z.string().trim(),
  });
}

type Formulario = z.infer<ReturnType<typeof crearEsquema>>;

const VACIO: Formulario = {
  ficha: "" as unknown as number,
  nombre: "",
  domicilio: "",
  piso: "",
  departamento: "",
  localidad: "",
  telefono: "",
  obra_social_id: "",
  fecha_alta: new Date().toISOString().slice(0, 10),
  activo: true,
  notas: "",
};

function aFormulario(d: Doctor): Formulario {
  return {
    ficha: d.ficha,
    nombre: d.nombre,
    domicilio: d.domicilio ?? "",
    piso: d.piso ?? "",
    departamento: d.departamento ?? "",
    localidad: d.localidad ?? "",
    telefono: d.telefono ?? "",
    obra_social_id: d.obra_social_id ? String(d.obra_social_id) : "",
    fecha_alta: d.fecha_alta,
    activo: d.activo,
    notas: d.notas ?? "",
  };
}

const oNulo = (valor: string) => (valor === "" ? null : valor);

export function PanelDoctor({
  abierto,
  doctor,
  obrasSociales,
  onCerrar,
  onGuardado,
}: {
  abierto: boolean;
  /** null = alta de un doctor nuevo */
  doctor: Doctor | null;
  obrasSociales: ObraSocial[];
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const esAlta = doctor === null;
  const enFormulario = esAlta || editando;

  return (
    <Sheet
      open={abierto}
      onOpenChange={(valor) => {
        if (!valor) {
          setEditando(false);
          onCerrar();
        }
      }}
    >
      <SheetContent className="data-[side=right]:sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {esAlta ? "Nuevo doctor" : editando ? "Editar doctor" : doctor.nombre}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {enFormulario ? (
            <FormularioDoctor
              doctor={doctor}
              obrasSociales={obrasSociales}
              onCancelar={() => {
                if (esAlta) onCerrar();
                else setEditando(false);
              }}
              onGuardado={() => {
                setEditando(false);
                onGuardado();
              }}
            />
          ) : (
            <DetalleDoctor
              doctor={doctor}
              obrasSociales={obrasSociales}
              onEditar={() => setEditando(true)}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetalleDoctor({
  doctor,
  obrasSociales,
  onEditar,
}: {
  doctor: Doctor;
  obrasSociales: ObraSocial[];
  onEditar: () => void;
}) {
  const obra = obrasSociales.find((o) => o.id === doctor.obra_social_id);
  const domicilio = [
    doctor.domicilio,
    doctor.piso ? `Piso ${doctor.piso}` : null,
    doctor.departamento ? `Dto. ${doctor.departamento}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Badge variant={doctor.activo ? "ok" : "neutral"}>
          {doctor.activo ? "Activo" : "Inactivo"}
        </Badge>
        <span className="font-mono text-xs text-ink-2">Ficha {doctor.ficha}</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Dato etiqueta="Domicilio">{domicilio || "—"}</Dato>
        <Dato etiqueta="Localidad">{doctor.localidad || "—"}</Dato>
        <Dato etiqueta="Teléfono">{doctor.telefono || "—"}</Dato>
        <Dato etiqueta="Obra social habitual">{obra?.nombre ?? "—"}</Dato>
        <Dato etiqueta="Fecha de alta">{formatFechaCorta(doctor.fecha_alta)}</Dato>
      </div>

      {doctor.notas && <Dato etiqueta="Notas">{doctor.notas}</Dato>}

      <div className="flex justify-end pt-3">
        <Button variant="outline" onClick={onEditar}>
          Editar
        </Button>
      </div>
    </div>
  );
}

function FormularioDoctor({
  doctor,
  obrasSociales,
  onCancelar,
  onGuardado,
}: {
  doctor: Doctor | null;
  obrasSociales: ObraSocial[];
  onCancelar: () => void;
  onGuardado: () => void;
}) {
  const esquema = useMemo(() => crearEsquema(doctor?.ficha ?? null), [doctor]);
  const [generando, setGenerando] = useState(false);

  // Para avisar si se está dando de baja a un doctor que debe plata.
  const { consulta: consultaSaldo } = useConsulta<Centavos>(
    () => (doctor ? saldoDeDoctor(doctor.id) : Promise.resolve(0)),
    [doctor?.id],
    "No se pudo consultar el saldo del doctor.",
  );
  const saldo = consultaSaldo.estado === "listo" ? consultaSaldo.datos : 0;

  const {
    register,
    handleSubmit,
    control,
    setError,
    setValue,
    clearErrors,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: doctor ? aFormulario(doctor) : VACIO,
  });

  async function generarFicha() {
    setGenerando(true);
    try {
      const ficha = await proximaFichaLibre();
      setValue("ficha", ficha, { shouldDirty: true });
      clearErrors("ficha");
    } catch {
      toast.error("No se pudo generar el número de ficha. Revisá la conexión y probá de nuevo.", {
        duration: Infinity,
      });
    } finally {
      setGenerando(false);
    }
  }

  async function guardar(datos: Formulario) {
    try {
      await guardarDoctor(
        {
          ficha: datos.ficha,
          nombre: datos.nombre,
          domicilio: oNulo(datos.domicilio),
          piso: oNulo(datos.piso),
          departamento: oNulo(datos.departamento),
          localidad: oNulo(datos.localidad),
          telefono: oNulo(datos.telefono),
          obra_social_id: datos.obra_social_id ? Number(datos.obra_social_id) : null,
          fecha_alta: datos.fecha_alta,
          activo: datos.activo,
          notas: oNulo(datos.notas),
        },
        doctor?.id ?? null,
      );
      toast.success(doctor ? "Doctor actualizado" : "Doctor creado");
      onGuardado();
    } catch (error) {
      if ((error as { code?: string }).code === CODIGO_DUPLICADO) {
        setError("ficha", { message: "Ya hay un doctor con esa ficha." });
        return;
      }
      toast.error("No se pudo guardar el doctor. Revisá la conexión y probá de nuevo.", {
        duration: Infinity,
      });
    }
  }

  const sigueActivo = watch("activo");

  const opcionesObra = [
    { valor: "", etiqueta: "Sin obra social" },
    ...obrasSociales.map((o) => ({ valor: String(o.id), etiqueta: o.nombre })),
  ];

  return (
    <form
      className="flex flex-col gap-6"
      noValidate
      onSubmit={handleSubmit(guardar)}
      onKeyDown={alTeclearEnFormulario}
    >
      <SeccionFormulario titulo="Ficha" primera>
        <div className="flex flex-col gap-3">
          <Campo
            id="ficha"
            etiqueta="Número de ficha"
            requerido
            error={errors.ficha?.message}
            ayuda="Empieza con 100 y tiene seis dígitos, por ejemplo 100102."
          >
            <div className="flex items-center gap-2">
              <Input
                id="ficha"
                inputMode="numeric"
                autoFocus
                className="w-40 font-mono"
                aria-invalid={errors.ficha ? true : undefined}
                {...register("ficha")}
              />
              {doctor === null && (
                <Button type="button" variant="outline" onClick={generarFicha} disabled={generando}>
                  {generando ? "Generando…" : "Generar automático"}
                </Button>
              )}
            </div>
          </Campo>
          <Campo id="nombre" etiqueta="Nombre" requerido error={errors.nombre?.message}>
            <Input id="nombre" aria-invalid={errors.nombre ? true : undefined} {...register("nombre")} />
          </Campo>
          <Campo id="fecha_alta" etiqueta="Fecha de alta" requerido error={errors.fecha_alta?.message}>
            <Input id="fecha_alta" type="date" className="w-48" {...register("fecha_alta")} />
          </Campo>
        </div>
      </SeccionFormulario>

      <SeccionFormulario titulo="Domicilio">
        <div className="flex flex-col gap-3">
          <Campo id="domicilio" etiqueta="Calle y número">
            <Input id="domicilio" {...register("domicilio")} />
          </Campo>
          <div className="flex gap-3">
            <Campo id="piso" etiqueta="Piso">
              <Input id="piso" {...register("piso")} />
            </Campo>
            <Campo id="departamento" etiqueta="Departamento">
              <Input id="departamento" {...register("departamento")} />
            </Campo>
          </div>
          <Campo id="localidad" etiqueta="Localidad">
            <Input id="localidad" {...register("localidad")} />
          </Campo>
          <Campo id="telefono" etiqueta="Teléfono">
            <Input id="telefono" {...register("telefono")} />
          </Campo>
        </div>
      </SeccionFormulario>

      <SeccionFormulario titulo="Otros datos">
        <div className="flex flex-col gap-3">
          <Campo id="obra_social_id" etiqueta="Obra social habitual">
            <Controller
              control={control}
              name="obra_social_id"
              render={({ field }) => (
                <SelectSimple
                  id="obra_social_id"
                  valor={field.value}
                  onCambio={field.onChange}
                  opciones={opcionesObra}
                />
              )}
            />
          </Campo>
          <Campo id="notas" etiqueta="Notas">
            <Textarea id="notas" {...register("notas")} />
          </Campo>
          <div className="flex items-center gap-3">
            <Controller
              control={control}
              name="activo"
              render={({ field }) => (
                <Switch
                  id="activo"
                  checked={field.value}
                  onCheckedChange={(valor) => field.onChange(valor)}
                />
              )}
            />
            <label htmlFor="activo" className="text-sm">
              Doctor activo
            </label>
          </div>

          {!sigueActivo && saldo > 0 && (
            <p className="text-xs text-warn">
              Este doctor tiene {formatARS(saldo)} de deuda. Si lo das de baja no vas a poder
              cargarle órdenes nuevas, pero su cuenta corriente se sigue viendo hasta que quede
              en cero.
            </p>
          )}

          {!sigueActivo && saldo < 0 && (
            <p className="text-xs text-warn">
              Este doctor tiene {formatARS(-saldo)} a favor. Si lo das de baja, ese saldo queda
              ahí hasta que se use o se devuelva.
            </p>
          )}
        </div>
      </SeccionFormulario>

      <NotaCamposRequeridos />

      <AccionesFormulario onCancelar={onCancelar} guardando={isSubmitting} />
    </form>
  );
}
