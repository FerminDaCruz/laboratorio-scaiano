"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { AccionesFormulario, Campo } from "@/components/formulario/campo";
import { CODIGO_DUPLICADO, guardarObraSocial } from "@/components/doctores/datos";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { alTeclearEnFormulario } from "@/hooks/use-atajos";
import type { ObraSocial } from "@/lib/tipos";

const esquema = z.object({
  codigo: z.string().trim().min(1, "Ingresá el código.").max(16, "El código es muy largo."),
  nombre: z.string().trim().min(1, "Ingresá el nombre."),
  activa: z.boolean(),
});

type Formulario = z.infer<typeof esquema>;

export function PanelObraSocial({
  abierto,
  obraSocial,
  onCerrar,
  onGuardado,
}: {
  abierto: boolean;
  obraSocial: ObraSocial | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  return (
    <Sheet open={abierto} onOpenChange={(valor) => !valor && onCerrar()}>
      <SheetContent className="data-[side=right]:sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{obraSocial ? "Editar obra social" : "Nueva obra social"}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {abierto && (
            <FormularioObraSocial
              key={obraSocial?.id ?? "nueva"}
              obraSocial={obraSocial}
              onCancelar={onCerrar}
              onGuardado={onGuardado}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FormularioObraSocial({
  obraSocial,
  onCancelar,
  onGuardado,
}: {
  obraSocial: ObraSocial | null;
  onCancelar: () => void;
  onGuardado: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: obraSocial
      ? { codigo: obraSocial.codigo, nombre: obraSocial.nombre, activa: obraSocial.activa }
      : { codigo: "", nombre: "", activa: true },
  });

  async function guardar(datos: Formulario) {
    try {
      await guardarObraSocial(datos, obraSocial?.id ?? null);
      toast.success(obraSocial ? "Obra social actualizada" : "Obra social creada");
      onGuardado();
    } catch (error) {
      if ((error as { code?: string }).code === CODIGO_DUPLICADO) {
        setError("codigo", { message: "Ya hay una obra social con ese código." });
        return;
      }
      toast.error("No se pudo guardar la obra social. Revisá la conexión y probá de nuevo.", {
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
      <Campo id="codigo" etiqueta="Código" error={errors.codigo?.message} ayuda="Corto, como OSDE o IOMA.">
        <Input id="codigo" autoFocus aria-invalid={errors.codigo ? true : undefined} {...register("codigo")} />
      </Campo>
      <Campo id="nombre" etiqueta="Nombre" error={errors.nombre?.message}>
        <Input id="nombre" aria-invalid={errors.nombre ? true : undefined} {...register("nombre")} />
      </Campo>
      <div className="flex items-center gap-3 pt-1">
        <Controller
          control={control}
          name="activa"
          render={({ field }) => (
            <Switch id="activa" checked={field.value} onCheckedChange={(v) => field.onChange(v)} />
          )}
        />
        <label htmlFor="activa" className="text-sm">
          Obra social activa
        </label>
      </div>

      <AccionesFormulario onCancelar={onCancelar} guardando={isSubmitting} />
    </form>
  );
}
