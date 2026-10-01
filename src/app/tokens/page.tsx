"use client";

import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatFechaCorta, formatOT } from "@/lib/format";
import { formatARS } from "@/lib/money";
import { cn } from "@/lib/utils";

// Página de muestra de E0: los tokens de docs/design-system.md aplicados.

const COLORES = [
  { nombre: "bg", clase: "bg-bg" },
  { nombre: "surface", clase: "bg-surface" },
  { nombre: "surface-alt", clase: "bg-surface-alt" },
  { nombre: "border", clase: "bg-border" },
  { nombre: "border-strong", clase: "bg-border-strong" },
  { nombre: "ink", clase: "bg-ink" },
  { nombre: "ink-2", clase: "bg-ink-2" },
  { nombre: "ink-3", clase: "bg-ink-3" },
  { nombre: "accent", clase: "bg-accent" },
  { nombre: "accent-hover", clase: "bg-accent-hover" },
  { nombre: "accent-soft", clase: "bg-accent-soft" },
  { nombre: "ok", clase: "bg-ok" },
  { nombre: "ok-soft", clase: "bg-ok-soft" },
  { nombre: "warn", clase: "bg-warn" },
  { nombre: "warn-soft", clase: "bg-warn-soft" },
  { nombre: "danger", clase: "bg-danger" },
  { nombre: "danger-soft", clase: "bg-danger-soft" },
  { nombre: "info", clase: "bg-info" },
  { nombre: "info-soft", clase: "bg-info-soft" },
  { nombre: "sidebar", clase: "bg-sidebar" },
];

const TIPOGRAFIA = [
  { rol: "text-2xl · 22px / 600", clase: "text-2xl font-semibold", muestra: "$ 1.284.500,00" },
  { rol: "text-xl · 18px / 600", clase: "text-xl font-semibold", muestra: "Título de página" },
  { rol: "text-lg · 16px / 600", clase: "text-lg font-semibold", muestra: "Título de sección" },
  { rol: "text-base · 14px / 400", clase: "text-base", muestra: "Cuerpo de formularios y campos" },
  { rol: "text-sm · 13px / 400", clase: "text-sm", muestra: "Texto por defecto de la aplicación" },
  { rol: "text-xs · 12px / 400", clase: "text-xs", muestra: "Metadatos, ayudas y notas al pie" },
];

const ESPACIADO = [
  { px: 4, clase: "w-1" },
  { px: 8, clase: "w-2" },
  { px: 12, clase: "w-3" },
  { px: 16, clase: "w-4" },
  { px: 24, clase: "w-6" },
  { px: 32, clase: "w-8" },
  { px: 48, clase: "w-12" },
];

type EstadoOT = "Ingresada" | "En proceso" | "Terminada" | "Entregada" | "Anulada";

const VARIANTE_OT = {
  Ingresada: "neutral",
  "En proceso": "warn",
  Terminada: "info",
  Entregada: "ok",
  Anulada: "danger",
} as const satisfies Record<EstadoOT, string>;

const ORDENES: {
  ot: number;
  fecha: string;
  doctor: string;
  paciente: string;
  estado: EstadoOT;
  saldo: number;
}[] = [
  { ot: 4821, fecha: "2026-09-18", doctor: "Dra. Laura Méndez", paciente: "Rodríguez, Ana María", estado: "En proceso", saldo: 14400000 },
  { ot: 4822, fecha: "2026-09-18", doctor: "Dr. Pablo Ferreyra", paciente: "Gómez, Julio", estado: "Ingresada", saldo: 3850050 },
  { ot: 4815, fecha: "2026-09-16", doctor: "Dra. Silvia Acosta", paciente: "Paz, Martín", estado: "Terminada", saldo: 920000 },
  { ot: 4809, fecha: "2026-09-12", doctor: "Dr. Pablo Ferreyra", paciente: "Luna, Carmen", estado: "Entregada", saldo: -1200000 },
  { ot: 4801, fecha: "2026-09-10", doctor: "Dra. Laura Méndez", paciente: "Sosa, Ricardo", estado: "Anulada", saldo: 0 },
];

function TituloSeccion({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">{children}</h2>;
}

export default function TokensPage() {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <TituloSeccion>Colores</TituloSeccion>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
          {COLORES.map((c) => (
            <div key={c.nombre} className="flex flex-col gap-1">
              <div className={cn("h-12 rounded-md border border-border", c.clase)} />
              <span className="font-mono text-xs text-ink-2">{c.nombre}</span>
            </div>
          ))}
        </div>
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <TituloSeccion>Tipografía</TituloSeccion>
        <div className="flex flex-col gap-2">
          {TIPOGRAFIA.map((t) => (
            <div key={t.rol} className="flex items-baseline gap-4">
              <span className="w-44 shrink-0 font-mono text-xs text-ink-3">{t.rol}</span>
              <span className={t.clase}>{t.muestra}</span>
            </div>
          ))}
          <div className="flex items-baseline gap-4">
            <span className="w-44 shrink-0 font-mono text-xs text-ink-3">mono · OT / remito</span>
            <span className="font-mono">OT {formatOT(4821)}</span>
          </div>
        </div>
      </section>

      <Separator />

      <section className="flex flex-wrap gap-12">
        <div className="flex flex-col gap-3">
          <TituloSeccion>Espaciado</TituloSeccion>
          {ESPACIADO.map((e) => (
            <div key={e.px} className="flex items-center gap-3">
              <span className="w-8 text-right font-mono text-xs text-ink-3 tabular-nums">{e.px}</span>
              <div className={cn("h-3 bg-accent", e.clase)} />
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <TituloSeccion>Radios y sombras</TituloSeccion>
          <div className="flex gap-4">
            <div className="flex size-16 items-end rounded-sm border border-border bg-surface p-1 text-xs text-ink-3">sm</div>
            <div className="flex size-16 items-end rounded-md border border-border bg-surface p-1 text-xs text-ink-3">md</div>
            <div className="flex size-16 items-end rounded-lg border border-border bg-surface p-1 text-xs text-ink-3">lg</div>
            <div className="flex size-16 items-end rounded-md bg-surface p-1 text-xs text-ink-3 shadow-sm">shadow-sm</div>
            <div className="flex size-16 items-end rounded-md bg-surface p-1 text-xs text-ink-3 shadow-md">shadow-md</div>
          </div>
        </div>
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <TituloSeccion>Botones y badges</TituloSeccion>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => toast.success("Orden creada")}>Acción primaria</Button>
          <Button variant="outline">Secundaria</Button>
          <Button variant="ghost">En fila</Button>
          <Button variant="destructive">Anular</Button>
          <Button
            variant="outline"
            onClick={() =>
              toast.error("No se pudo guardar la orden. Revisá la conexión y probá de nuevo.", {
                duration: Infinity,
              })
            }
          >
            Probar error de sistema
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(VARIANTE_OT) as EstadoOT[]).map((estado) => (
            <Badge key={estado} variant={VARIANTE_OT[estado]}>
              {estado}
            </Badge>
          ))}
          <span className="px-2 text-ink-3">·</span>
          <Badge variant="ok">Saldo a favor</Badge>
          <Badge variant="neutral">Al día</Badge>
          <Badge variant="warn">Con deuda</Badge>
          <Badge variant="danger">Vencida +60 días</Badge>
        </div>
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <TituloSeccion>Tabla</TituloSeccion>
        <div className="rounded-md border border-border bg-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>OT</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ORDENES.map((o, i) => (
                <TableRow key={o.ot} data-state={i === 0 ? "selected" : undefined}>
                  <TableCell className="font-mono">{formatOT(o.ot)}</TableCell>
                  <TableCell>{formatFechaCorta(o.fecha)}</TableCell>
                  <TableCell>{o.doctor}</TableCell>
                  <TableCell>{o.paciente}</TableCell>
                  <TableCell>
                    <Badge variant={VARIANTE_OT[o.estado]}>{o.estado}</Badge>
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums", o.saldo < 0 && "text-ok")}>
                    {formatARS(o.saldo)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-ink-3">La primera fila muestra el foco de fila (accent-soft).</p>
      </section>

      <Separator />

      <section className="flex flex-wrap gap-12">
        <div className="flex w-full max-w-[640px] flex-col gap-3">
          <TituloSeccion>Campo de formulario</TituloSeccion>
          <div className="flex flex-col gap-2">
            <Label htmlFor="muestra-paciente">Paciente</Label>
            <Input id="muestra-paciente" placeholder="Apellido, nombre" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="muestra-edad">Edad</Label>
            <Input id="muestra-edad" aria-invalid defaultValue="abc" aria-describedby="muestra-edad-error" />
            <p id="muestra-edad-error" className="text-xs text-danger">
              La edad tiene que ser un número.
            </p>
          </div>
        </div>

        <div className="flex w-full max-w-sm flex-col gap-3">
          <TituloSeccion>Estados</TituloSeccion>
          <div className="flex flex-col gap-1">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-3/4" />
          </div>
          <p className="text-ink-3">Todavía no hay órdenes cargadas para este doctor.</p>
        </div>
      </section>
    </div>
  );
}
