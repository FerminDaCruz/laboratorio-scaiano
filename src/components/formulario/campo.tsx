"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

/** Campo del patrón §5C: etiqueta arriba, error debajo en danger de 12px. */
export function Campo({
  id,
  etiqueta,
  error,
  ayuda,
  children,
}: {
  id: string;
  etiqueta: string;
  error?: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{etiqueta}</Label>
      {children}
      {!error && ayuda && <p className="text-xs text-ink-3">{ayuda}</p>}
      {error && (
        <p id={`${id}-error`} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function SeccionFormulario({
  titulo,
  children,
  primera = false,
}: {
  titulo: string;
  children: React.ReactNode;
  primera?: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      {!primera && <Separator className="mt-3" />}
      <h2 className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">{titulo}</h2>
      {children}
    </section>
  );
}

/** Acciones abajo a la derecha: Cancelar (outline) y la primaria. */
export function AccionesFormulario({
  onCancelar,
  guardando,
  etiqueta = "Guardar",
}: {
  onCancelar: () => void;
  guardando: boolean;
  etiqueta?: string;
}) {
  return (
    <div className="flex justify-end gap-2 pt-3">
      <Button type="button" variant="outline" onClick={onCancelar} disabled={guardando}>
        Cancelar
      </Button>
      <Button type="submit" disabled={guardando}>
        {guardando ? "Guardando…" : etiqueta}
      </Button>
    </div>
  );
}

/** Dato de solo lectura, para los paneles de detalle. */
export function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">{etiqueta}</span>
      <span className="text-sm">{children ?? "—"}</span>
    </div>
  );
}
