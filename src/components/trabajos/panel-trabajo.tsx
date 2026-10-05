"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { CODIGO_DUPLICADO } from "@/components/doctores/datos";
import { AccionesFormulario, Campo, Dato, SeccionFormulario } from "@/components/formulario/campo";
import { InputMonto } from "@/components/formulario/input-monto";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { alTeclearEnFormulario } from "@/hooks/use-atajos";
import { useConsulta } from "@/hooks/use-consulta";
import { formatFechaCorta, formatFechaLarga } from "@/lib/format";
import { centavosDesdeTexto, formatARS, textoDesdeCentavos, type Centavos } from "@/lib/money";
import { mensajeDeErrorSupabase } from "@/lib/errores";
import type { PrecioTrabajo, TrabajoConPrecio } from "@/lib/tipos";
import { agregarPrecio, corregirPrecio, guardarTrabajo, listarPreciosDe } from "./datos";

const esquemaTrabajo = z.object({
  codigo: z.string().trim().min(1, "Ingresá el código.").max(12, "El código es muy largo."),
  titulo: z.string().trim().min(1, "Ingresá el título."),
  descripcion: z.string().trim(),
  activo: z.boolean(),
});

type FormularioTrabajo = z.infer<typeof esquemaTrabajo>;

const esquemaPrecio = z.object({
  precio: z
    .string()
    .trim()
    .min(1, "Ingresá el precio.")
    .refine((v) => centavosDesdeTexto(v) !== null, "El precio no es un monto válido.")
    .refine((v) => (centavosDesdeTexto(v) ?? -1) >= 0, "El precio no puede ser negativo."),
  vigente_desde: z.string().min(1, "Ingresá desde cuándo rige."),
});

type FormularioPrecio = z.infer<typeof esquemaPrecio>;

const hoy = () => new Date().toISOString().slice(0, 10);

export function PanelTrabajo({
  abierto,
  trabajo,
  onCerrar,
  onGuardado,
}: {
  abierto: boolean;
  trabajo: TrabajoConPrecio | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const esAlta = trabajo === null;

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
            {esAlta ? "Nuevo trabajo" : editando ? "Editar trabajo" : trabajo.titulo}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {esAlta || editando ? (
            <FormularioDeTrabajo
              trabajo={trabajo}
              onCancelar={() => (esAlta ? onCerrar() : setEditando(false))}
              onGuardado={() => {
                setEditando(false);
                onGuardado();
              }}
            />
          ) : (
            <DetalleTrabajo
              trabajo={trabajo}
              onEditar={() => setEditando(true)}
              onPrecioNuevo={onGuardado}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetalleTrabajo({
  trabajo,
  onEditar,
  onPrecioNuevo,
}: {
  trabajo: TrabajoConPrecio;
  onEditar: () => void;
  onPrecioNuevo: () => void;
}) {
  const [agregando, setAgregando] = useState(false);
  const { consulta, recargar } = useConsulta<PrecioTrabajo[]>(
    () => listarPreciosDe(trabajo.id),
    [trabajo.id],
    "No se pudo cargar el historial de precios.",
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Badge variant={trabajo.activo ? "ok" : "neutral"}>
          {trabajo.activo ? "Activo" : "Inactivo"}
        </Badge>
        <span className="font-mono text-xs text-ink-2">{trabajo.codigo}</span>
      </div>

      <Dato etiqueta="Precio vigente">
        <span className="text-lg font-semibold tabular-nums">
          {trabajo.precio === null ? "Sin precio cargado" : formatARS(trabajo.precio)}
        </span>
      </Dato>

      {trabajo.descripcion && <Dato etiqueta="Descripción">{trabajo.descripcion}</Dato>}

      <SeccionFormulario titulo="Historial de precios">
        {consulta.estado === "cargando" && <p className="text-ink-3">Cargando…</p>}
        {consulta.estado === "error" && <p className="text-danger">{consulta.mensaje}</p>}
        {consulta.estado === "listo" &&
          (consulta.datos.length === 0 ? (
            <p className="text-ink-3">Este trabajo todavía no tiene precios cargados.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {consulta.datos.map((p) => (
                <li key={p.id} className="flex justify-between border-b border-border py-2">
                  <span>desde {formatFechaCorta(p.vigente_desde)}</span>
                  <span className="tabular-nums">{formatARS(p.precio)}</span>
                </li>
              ))}
            </ul>
          ))}

        {agregando ? (
          <FormularioDePrecio
            trabajoId={trabajo.id}
            precios={consulta.estado === "listo" ? consulta.datos : []}
            onCancelar={() => setAgregando(false)}
            onGuardado={() => {
              setAgregando(false);
              recargar();
              onPrecioNuevo();
            }}
          />
        ) : (
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onEditar}>
              Editar trabajo
            </Button>
            <Button onClick={() => setAgregando(true)}>Nuevo precio</Button>
          </div>
        )}
      </SeccionFormulario>
    </div>
  );
}

function FormularioDePrecio({
  trabajoId,
  precios,
  onCancelar,
  onGuardado,
}: {
  trabajoId: number;
  precios: PrecioTrabajo[];
  onCancelar: () => void;
  onGuardado: () => void;
}) {
  const {
    control,
    handleSubmit,
    register,
    formState: { errors, isSubmitting },
  } = useForm<FormularioPrecio>({
    resolver: zodResolver(esquemaPrecio),
    defaultValues: { precio: "", vigente_desde: hoy() },
  });

  // Cuando ya hay un precio para esa fecha, se pregunta si se corrige.
  const [aReemplazar, setAReemplazar] = useState<
    { precio: PrecioTrabajo; centavos: Centavos } | null
  >(null);

  async function escribir(centavos: Centavos, fecha: string, existente: PrecioTrabajo | null) {
    try {
      if (existente) {
        await corregirPrecio(existente.id, centavos);
        toast.success("Precio corregido");
      } else {
        await agregarPrecio(trabajoId, centavos, fecha);
        toast.success("Precio agregado");
      }
      setAReemplazar(null);
      onGuardado();
    } catch (error) {
      toast.error(
        mensajeDeErrorSupabase(
          error,
          "No se pudo guardar el precio. Revisá la conexión y probá de nuevo.",
        ),
        { duration: Infinity },
      );
    }
  }

  async function guardar(datos: FormularioPrecio) {
    const centavos = centavosDesdeTexto(datos.precio);
    if (centavos === null) return;

    const existente = precios.find((p) => p.vigente_desde === datos.vigente_desde);
    if (existente) {
      setAReemplazar({ precio: existente, centavos });
      return;
    }
    await escribir(centavos, datos.vigente_desde, null);
  }

  return (
    <form
      className="flex flex-col gap-3 border-t border-border pt-3"
      noValidate
      onSubmit={handleSubmit(guardar)}
      onKeyDown={alTeclearEnFormulario}
    >
      <Campo id="precio" etiqueta="Precio" error={errors.precio?.message} ayuda="Por ejemplo 185.000,50">
        <Controller
          control={control}
          name="precio"
          render={({ field }) => (
            <InputMonto
              id="precio"
              autoFocus
              className="w-48"
              valor={field.value}
              onCambio={field.onChange}
              invalido={Boolean(errors.precio)}
            />
          )}
        />
      </Campo>
      <Campo id="vigente_desde" etiqueta="Vigente desde" error={errors.vigente_desde?.message}>
        <Input id="vigente_desde" type="date" {...register("vigente_desde")} />
      </Campo>
      <AccionesFormulario onCancelar={onCancelar} guardando={isSubmitting} etiqueta="Agregar precio" />

      <AlertDialog open={aReemplazar !== null} onOpenChange={(abierto) => !abierto && setAReemplazar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ya hay un precio para esa fecha</AlertDialogTitle>
            <AlertDialogDescription>
              {aReemplazar &&
                `Desde el ${formatFechaLarga(aReemplazar.precio.vigente_desde)} el precio cargado es ${formatARS(aReemplazar.precio.precio)}. Si seguís, queda ${formatARS(aReemplazar.centavos)}. Los precios de otras fechas y las órdenes ya cargadas no cambian.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (aReemplazar) {
                  void escribir(
                    aReemplazar.centavos,
                    aReemplazar.precio.vigente_desde,
                    aReemplazar.precio,
                  );
                }
              }}
            >
              Corregir el precio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}

function FormularioDeTrabajo({
  trabajo,
  onCancelar,
  onGuardado,
}: {
  trabajo: TrabajoConPrecio | null;
  onCancelar: () => void;
  onGuardado: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormularioTrabajo>({
    resolver: zodResolver(esquemaTrabajo),
    defaultValues: trabajo
      ? {
          codigo: trabajo.codigo,
          titulo: trabajo.titulo,
          descripcion: trabajo.descripcion ?? "",
          activo: trabajo.activo,
        }
      : { codigo: "", titulo: "", descripcion: "", activo: true },
  });

  const [precioInicial, setPrecioInicial] = useState("");
  const [errorPrecio, setErrorPrecio] = useState<string | undefined>();

  async function guardar(datos: FormularioTrabajo) {
    const esAlta = trabajo === null;
    let centavos: number | null = null;

    if (esAlta && precioInicial.trim() !== "") {
      centavos = centavosDesdeTexto(precioInicial);
      if (centavos === null) {
        setErrorPrecio("El precio no es un monto válido.");
        return;
      }
    }

    try {
      const id = await guardarTrabajo(
        {
          codigo: datos.codigo.toUpperCase(),
          titulo: datos.titulo,
          descripcion: datos.descripcion === "" ? null : datos.descripcion,
          activo: datos.activo,
        },
        trabajo?.id ?? null,
      );
      if (centavos !== null) await agregarPrecio(id, centavos, hoy());
      toast.success(esAlta ? "Trabajo creado" : "Trabajo actualizado");
      onGuardado();
    } catch (error) {
      if ((error as { code?: string }).code === CODIGO_DUPLICADO) {
        setError("codigo", { message: "Ya hay un trabajo con ese código." });
        return;
      }
      toast.error("No se pudo guardar el trabajo. Revisá la conexión y probá de nuevo.", {
        duration: Infinity,
      });
    }
  }

  return (
    <form
      className="flex flex-col gap-3"
      noValidate
      onSubmit={handleSubmit(guardar)}
      onKeyDown={alTeclearEnFormulario}
    >
      <Campo
        id="codigo"
        etiqueta="Código"
        error={errors.codigo?.message}
        ayuda="Es lo que se tipea al cargar una orden."
      >
        <Input
          id="codigo"
          autoFocus
          className="font-mono uppercase"
          aria-invalid={errors.codigo ? true : undefined}
          {...register("codigo")}
        />
      </Campo>
      <Campo id="titulo" etiqueta="Título" error={errors.titulo?.message}>
        <Input id="titulo" aria-invalid={errors.titulo ? true : undefined} {...register("titulo")} />
      </Campo>
      <Campo id="descripcion" etiqueta="Descripción">
        <Textarea id="descripcion" {...register("descripcion")} />
      </Campo>

      {trabajo === null && (
        <Campo id="precio_inicial" etiqueta="Precio inicial" error={errorPrecio} ayuda="Opcional. Rige desde hoy.">
          <InputMonto
            id="precio_inicial"
            className="w-48"
            valor={precioInicial}
            invalido={Boolean(errorPrecio)}
            onCambio={(valor) => {
              setPrecioInicial(valor);
              setErrorPrecio(undefined);
            }}
          />
        </Campo>
      )}

      <div className="flex items-center gap-3 pt-1">
        <Controller
          control={control}
          name="activo"
          render={({ field }) => (
            <Switch id="activo" checked={field.value} onCheckedChange={(v) => field.onChange(v)} />
          )}
        />
        <label htmlFor="activo" className="text-sm">
          Trabajo activo
        </label>
      </div>

      <AccionesFormulario onCancelar={onCancelar} guardando={isSubmitting} />
    </form>
  );
}

export { textoDesdeCentavos };
