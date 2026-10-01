"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import {
  deudasPendientes,
  listarPagos,
  registrarPago,
  type DeudaPendiente,
  type PagoListado,
} from "@/components/cc/consultas";
import { listarDoctoresParaCombo } from "@/components/doctores/datos";
import { AccionesFormulario, Campo, SeccionFormulario } from "@/components/formulario/campo";
import { Combobox } from "@/components/formulario/combobox";
import { SelectSimple } from "@/components/formulario/select-simple";
import { ErrorConsulta } from "@/components/listado/pagina-listado";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
import { alTeclearEnFormulario } from "@/hooks/use-atajos";
import { useConsulta } from "@/hooks/use-consulta";
import { formatFechaCorta, formatRemito } from "@/lib/format";
import { centavosDesdeTexto, formatARS } from "@/lib/money";
import { ETIQUETA_MEDIO, MEDIOS_PAGO, type Doctor, type MedioPago } from "@/lib/tipos";

const hoy = () => new Date().toISOString().slice(0, 10);

export default function PagosPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <Pagos />
    </Suspense>
  );
}

function Pagos() {
  const doctorInicial = useSearchParams().get("doctor") ?? "";

  const [doctorId, setDoctorId] = useState(doctorInicial);
  const [importe, setImporte] = useState("");
  const [fecha, setFecha] = useState(hoy());
  const [medio, setMedio] = useState<MedioPago>("efectivo");
  const [referencia, setReferencia] = useState("");
  const [manual, setManual] = useState(false);
  const [elegidas, setElegidas] = useState<number[]>([]);
  const [errores, setErrores] = useState<{ doctor?: string; importe?: string }>({});
  const [guardando, setGuardando] = useState(false);

  const { consulta: consultaDoctores } = useConsulta<Doctor[]>(
    () => listarDoctoresParaCombo(),
    [],
    "No se pudieron cargar los doctores.",
  );
  const doctores = consultaDoctores.estado === "listo" ? consultaDoctores.datos : [];

  const { consulta: consultaDeudas, recargar: recargarDeudas } = useConsulta<DeudaPendiente[]>(
    () => (doctorId ? deudasPendientes(Number(doctorId)) : Promise.resolve([])),
    [doctorId],
    "No se pudieron cargar las deudas del doctor.",
  );
  const deudas = consultaDeudas.estado === "listo" ? consultaDeudas.datos : [];
  const totalPendiente = deudas.reduce((suma, d) => suma + d.pendiente, 0);

  const { consulta: consultaPagos, recargar: recargarPagos } = useConsulta<PagoListado[]>(
    () => listarPagos(),
    [],
    "No se pudieron cargar los pagos. Revisá la conexión y probá de nuevo.",
  );

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    const centavos = centavosDesdeTexto(importe);
    const nuevos: typeof errores = {};
    if (!doctorId) nuevos.doctor = "Elegí el doctor.";
    if (centavos === null) nuevos.importe = "El importe no es un monto válido.";
    else if (centavos <= 0) nuevos.importe = "El importe tiene que ser mayor que cero.";
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0 || centavos === null) return;

    setGuardando(true);
    try {
      const resultado = await registrarPago({
        doctorId: Number(doctorId),
        importe: centavos,
        fecha,
        medio,
        referencia: referencia.trim() === "" ? null : referencia.trim(),
        deudaIds: manual ? elegidas : null,
      });

      toast.success(
        resultado.aFavor > 0
          ? `Pago registrado. Quedan ${formatARS(resultado.aFavor)} a favor del doctor.`
          : "Pago registrado",
      );
      setImporte("");
      setReferencia("");
      setElegidas([]);
      setManual(false);
      recargarPagos();
      recargarDeudas();
    } catch {
      toast.error("No se pudo registrar el pago. Revisá la conexión y probá de nuevo.", {
        duration: Infinity,
      });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form className="flex flex-col gap-6" noValidate onSubmit={guardar} onKeyDown={alTeclearEnFormulario}>
        <SeccionFormulario titulo="Pago" primera>
          <div className="flex max-w-[640px] flex-col gap-3">
            <Campo id="doctor" etiqueta="Doctor" error={errores.doctor}>
              <Combobox
                id="doctor"
                valor={doctorId || null}
                onCambio={(v) => {
                  setDoctorId(v ?? "");
                  setElegidas([]);
                }}
                invalido={Boolean(errores.doctor)}
                placeholder="Buscar por nombre o ficha…"
                opciones={doctores.map((d) => ({
                  valor: String(d.id),
                  etiqueta: d.nombre,
                  busqueda: String(d.ficha),
                  detalle: `ficha ${d.ficha}`,
                }))}
              />
            </Campo>

            <div className="flex flex-wrap gap-3">
              <Campo id="importe" etiqueta="Importe" error={errores.importe} ayuda="Por ejemplo 100.000,50">
                <Input
                  id="importe"
                  inputMode="decimal"
                  className="w-44"
                  value={importe}
                  aria-invalid={errores.importe ? true : undefined}
                  onChange={(e) => setImporte(e.target.value)}
                />
              </Campo>
              <Campo id="fecha" etiqueta="Fecha">
                <Input
                  id="fecha"
                  type="date"
                  className="w-44"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </Campo>
              <Campo id="medio" etiqueta="Medio">
                <SelectSimple
                  id="medio"
                  valor={medio}
                  onCambio={(v) => setMedio(v as MedioPago)}
                  ancho="w-44"
                  opciones={MEDIOS_PAGO.map((m) => ({ valor: m, etiqueta: ETIQUETA_MEDIO[m] }))}
                />
              </Campo>
            </div>

            <Campo id="referencia" etiqueta="Referencia" ayuda="Número de transferencia, cheque o lo que corresponda.">
              <Input id="referencia" value={referencia} onChange={(e) => setReferencia(e.target.value)} />
            </Campo>
          </div>
        </SeccionFormulario>

        <SeccionFormulario titulo="Imputación">
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={manual} onCheckedChange={(v) => setManual(v === true)} />
              Elegir a mano a qué remitos se aplica
            </label>

            {!manual && (
              <p className="text-ink-3">
                Se aplica al remito más viejo primero. Lo que sobre queda como saldo a favor y se usa
                en el próximo remito.
              </p>
            )}

            {doctorId && (
              <div className="overflow-hidden rounded-md border border-border bg-surface">
                {deudas.length === 0 ? (
                  <p className="p-4 text-ink-3">Este doctor no tiene deudas pendientes.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {manual && <TableHead className="w-12" />}
                        <TableHead className="w-24">Fecha</TableHead>
                        <TableHead className="w-28">Remito</TableHead>
                        <TableHead>Pacientes</TableHead>
                        <TableHead className="text-right">Pendiente</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deudas.map((d) => (
                        <TableRow key={d.id}>
                          {manual && (
                            <TableCell>
                              <Checkbox
                                aria-label={`Imputar al remito ${d.remitoNumero ?? d.id}`}
                                checked={elegidas.includes(d.id)}
                                onCheckedChange={(v) =>
                                  setElegidas((actual) =>
                                    v === true ? [...actual, d.id] : actual.filter((id) => id !== d.id),
                                  )
                                }
                              />
                            </TableCell>
                          )}
                          <TableCell>{formatFechaCorta(d.fecha)}</TableCell>
                          <TableCell className="font-mono">
                            {d.remitoNumero ? formatRemito(d.remitoNumero) : "—"}
                          </TableCell>
                          <TableCell>{d.pacientes.join(" · ") || "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatARS(d.pendiente)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            )}

            {doctorId && deudas.length > 0 && (
              <p className="flex justify-end gap-3 text-xs text-ink-2">
                <span className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
                  Deuda total
                </span>
                <span className="text-sm font-semibold text-ink tabular-nums">
                  {formatARS(totalPendiente)}
                </span>
              </p>
            )}
          </div>
        </SeccionFormulario>

        <AccionesFormulario
          onCancelar={() => {
            setImporte("");
            setReferencia("");
            setElegidas([]);
            setErrores({});
          }}
          guardando={guardando}
          etiqueta="Registrar pago"
        />
      </form>

      <Separator />

      <section className="flex flex-col gap-3">
        <h2 className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
          Últimos pagos
        </h2>
        {consultaPagos.estado === "cargando" && <Skeleton className="h-32 w-full" />}
        {consultaPagos.estado === "error" && (
          <ErrorConsulta mensaje={consultaPagos.mensaje} onReintentar={recargarPagos} />
        )}
        {consultaPagos.estado === "listo" && (
          <div className="overflow-hidden rounded-md border border-border bg-surface">
            {consultaPagos.datos.length === 0 ? (
              <p className="p-4 text-ink-3">Todavía no se registraron pagos.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Fecha</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead className="w-36">Medio</TableHead>
                    <TableHead>Referencia</TableHead>
                    <TableHead className="text-right">Importe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consultaPagos.datos.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{formatFechaCorta(p.fecha)}</TableCell>
                      <TableCell>{p.doctor?.nombre ?? "—"}</TableCell>
                      <TableCell>{p.medio ? ETIQUETA_MEDIO[p.medio] : "—"}</TableCell>
                      <TableCell>{p.referencia ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatARS(-p.importe)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
