"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import {
  listarPagos,
  registrarPago,
  trabajosDelMes,
  type PagoListado,
  type TrabajoDelMes,
} from "@/components/cc/consultas";
import { TablaTrabajosDelMes } from "@/components/cc/tabla-trabajos-del-mes";
import { listarDoctoresParaCombo, saldoDeDoctor } from "@/components/doctores/datos";
import {
  AccionesFormulario,
  Campo,
  NotaCamposRequeridos,
  SeccionFormulario,
} from "@/components/formulario/campo";
import { Combobox } from "@/components/formulario/combobox";
import { InputMonto } from "@/components/formulario/input-monto";
import { SelectSimple } from "@/components/formulario/select-simple";
import { ErrorConsulta } from "@/components/listado/pagina-listado";
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
import { formatFechaCorta } from "@/lib/format";
import { centavosDesdeTexto, formatARS, type Centavos } from "@/lib/money";
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
  const [errores, setErrores] = useState<{
    doctor?: string;
    importe?: string;
    fecha?: string;
  }>({});
  const [guardando, setGuardando] = useState(false);

  const { consulta: consultaDoctores } = useConsulta<Doctor[]>(
    () => listarDoctoresParaCombo(),
    [],
    "No se pudieron cargar los doctores.",
  );
  const doctores = consultaDoctores.estado === "listo" ? consultaDoctores.datos : [];

  const { consulta: consultaCuenta, recargar: recargarCuenta } = useConsulta<{
    trabajos: TrabajoDelMes[];
    saldo: Centavos;
  } | null>(
    async () => {
      if (!doctorId) return null;
      const [trabajos, saldo] = await Promise.all([
        trabajosDelMes(Number(doctorId)),
        saldoDeDoctor(Number(doctorId)),
      ]);
      return { trabajos, saldo };
    },
    [doctorId],
    "No se pudo cargar la cuenta del doctor. Revisá la conexión y probá de nuevo.",
  );

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
    if (!fecha) nuevos.fecha = "Poné la fecha del pago.";
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
      });

      toast.success(
        resultado.aFavor > 0
          ? `Pago registrado. Quedan ${formatARS(resultado.aFavor)} a favor del doctor.`
          : "Pago registrado",
      );
      setImporte("");
      setReferencia("");
      recargarPagos();
      recargarCuenta();
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
            <Campo id="doctor" etiqueta="Doctor" error={errores.doctor} requerido>
              <Combobox
                id="doctor"
                valor={doctorId || null}
                onCambio={(v) => setDoctorId(v ?? "")}
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
              <Campo
                id="importe"
                etiqueta="Importe"
                error={errores.importe}
                ayuda="Por ejemplo 100.000,50"
                requerido
              >
                <InputMonto
                  id="importe"
                  className="w-44"
                  valor={importe}
                  invalido={Boolean(errores.importe)}
                  onCambio={setImporte}
                />
              </Campo>
              <Campo id="fecha" etiqueta="Fecha" error={errores.fecha} requerido>
                <Input
                  id="fecha"
                  type="date"
                  className="w-44"
                  value={fecha}
                  aria-invalid={errores.fecha ? true : undefined}
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

        <SeccionFormulario titulo="Trabajos del mes">
          <div className="flex flex-col gap-3">
            <p className="text-ink-3">
              El pago se descuenta de la deuda total del doctor, no de un trabajo en particular.
              Si paga de más, lo que sobra queda a su favor para lo próximo que se le facture.
            </p>

            {doctorId === "" && <p className="text-ink-3">Elegí el doctor para ver su cuenta.</p>}
            {doctorId !== "" && consultaCuenta.estado === "cargando" && (
              <Skeleton className="h-32 w-full" />
            )}
            {consultaCuenta.estado === "error" && (
              <ErrorConsulta mensaje={consultaCuenta.mensaje} onReintentar={recargarCuenta} />
            )}
            {consultaCuenta.estado === "listo" && consultaCuenta.datos && (
              <TablaTrabajosDelMes
                trabajos={consultaCuenta.datos.trabajos}
                saldo={consultaCuenta.datos.saldo}
              />
            )}
          </div>
        </SeccionFormulario>

        <NotaCamposRequeridos />

        <AccionesFormulario
          onCancelar={() => {
            setImporte("");
            setReferencia("");
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
