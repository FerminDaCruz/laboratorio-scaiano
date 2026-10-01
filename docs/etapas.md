# Etapas del proyecto

Cada etapa es una unidad de trabajo cerrada, con archivos propios. Las que están en la
misma **ola** no comparten archivos y pueden hacerse en paralelo por agentes distintos.

**Trabajá sobre una sola etapa por vez.** No adelantes trabajo de otra ni arregles cosas
fuera de alcance "ya que estoy".

---

## Orden de ejecución

```
Ola 1   E0 ─→ E1                        secuencial, nada empieza antes
Ola 2   E2 ║ E3 ║ E4                    tres agentes en paralelo
Ola 3   E5
Ola 4   E6 ║ E7                         dos agentes en paralelo
Ola 5   E8
Ola 6   E9
Ola 7   E10 ║ E11                       dos agentes en paralelo

        E12, E13                        bloqueadas (ver pendientes-externos.md)
```

---

## E0 · Fundaciones

**Depende de:** nada · **Paralelo con:** nada

Deja el proyecto listo para que cualquier otra etapa empiece sin decidir nada visual.

- Tokens del design system en `src/app/globals.css`
- `next.config.ts` con `output: 'export'` e `images.unoptimized`
- Layout con sidebar y barra superior según §9 del design system
- Cliente de Supabase en `src/lib/supabase.ts`
- Helpers `money.ts`, `format.ts` con todas las funciones de §8
- Login y guard de rutas del lado del cliente
- Instalar los componentes de shadcn listados en §4

**Archivos:** `src/app/layout.tsx` · `src/app/globals.css` · `src/app/login/**` ·
`src/lib/{supabase,money,format}.ts` · `src/components/ui/**` · `next.config.ts`

**Terminado cuando:** `npm run build` genera el sitio estático sin errores, se puede
iniciar sesión, y una página de ejemplo muestra los tokens aplicados.

---

## E1 · Esquema de base de datos

**Depende de:** E0 · **Paralelo con:** nada

Todas las tablas de una sola vez, porque se referencian entre sí. Las funciones RPC
**no** van acá: cada una se escribe en la etapa que la usa.

Tablas: `doctores`, `obras_sociales`, `trabajos`, `precios_trabajo`, `ordenes`,
`orden_items`, `remitos`, `remito_lineas`, `movimientos_cc`, `imputaciones`,
`periodos`, `usuarios`.

- Migraciones numeradas en `supabase/migrations/`
- **RLS activa en todas las tablas**, con políticas explícitas
- Índices sobre lo que se va a filtrar: doctor, fecha, estado, número de OT
- Secuencias para los números correlativos de OT y remito
- Montos en `numeric(12,2)`
- Seeds con datos de prueba verosímiles (20 doctores, 15 trabajos, 5 obras sociales)
- Generar `src/lib/database.types.ts`

**Archivos:** `supabase/migrations/**` · `supabase/seed.sql` · `src/lib/database.types.ts`

**Terminado cuando:** las migraciones corren limpias sobre una base vacía, los seeds
cargan, y una consulta desde el front devuelve datos.

---

## E2 · Doctores y obras sociales

**Depende de:** E1 · **Paralelo con:** E3, E4

ABM completo de las dos entidades. Patrón de listado (§5A) y formulario (§5C).

- Doctores: ficha, fecha de alta, nombre, domicilio, **piso**, **departamento**,
  localidad, teléfono, obra social habitual, estado
- La ficha es el número que ya usan; es único y editable al crear
- Buscador por nombre y por ficha
- Obras sociales: nombre y código, ABM simple

**Archivos:** `src/app/doctores/**` · `src/app/obras-sociales/**` ·
`src/components/doctores/**`

---

## E3 · Catálogo de trabajos

**Depende de:** E1 · **Paralelo con:** E2, E4

- ABM de trabajos: código corto, título, descripción opcional, precio vigente
- **Historial de precios con fecha de vigencia** — cambiar un precio crea un registro
  nuevo, no pisa el anterior
- Pantalla de actualización masiva: "aumentar todo un X% desde la fecha Y", con vista
  previa antes de aplicar
- Ver el historial de precios de un trabajo

**Archivos:** `src/app/trabajos/**` · `src/components/trabajos/**`

---

## E4 · Odontograma

**Depende de:** E1 · **Paralelo con:** E2, E3

Componente aislado y reutilizable de selección de piezas dentales. Es la pieza más
delicada de la interfaz, por eso va sola.

- Notación FDI: cuadrante 1 superior derecho (1.8→1.1), 2 superior izquierdo,
  3 inferior izquierdo, 4 inferior derecho
- Soporte de temporales (cuadrantes 5-8), activable
- **Cuatro modos de selección:** sin pieza · piezas sueltas · tramo (puente) ·
  arcada completa (superior, inferior o ambas)
- Clickeable **y** tipeable: escribir `2.4-2.6` selecciona el tramo
- Serialización estable a un solo campo, y helpers de formato en `src/lib/fdi.ts`

**Archivos:** `src/components/odontograma/**` · `src/lib/fdi.ts`

**Terminado cuando:** una página de prueba permite seleccionar en los cuatro modos, con
mouse y con teclado, y el valor serializado se lee de vuelta correctamente.

---

## E5 · Carga de órdenes

**Depende de:** E2, E3, E4 · **Paralelo con:** nada

El corazón operativo. **Objetivo medible: cargar una orden en menos de 30 segundos,
sin tocar el mouse.**

- Formulario de una pantalla: doctor (combobox, filtra a las 3 letras), paciente,
  sexo, edad, obra social, color (Vita Classic A1–D4 + campo libre), fecha, indicaciones,
  fecha y hora de entrega
- Ítems: trabajo (por código corto), cantidad, piezas (odontograma de E4)
- Varios ítems por orden
- El catálogo de doctores y trabajos se precarga al abrir la pantalla, así tipear no
  toca la red
- **Un solo viaje al servidor al guardar**, vía `crear_orden`
- Función `crear_orden`: asigna el correlativo y **congela los precios** leyendo el
  catálogo. El cliente nunca manda el precio.

**Archivos:** `src/app/ordenes/nueva/**` · `src/components/ordenes/formulario*` ·
`supabase/migrations/*_crear_orden.sql`

---

## E6 · Listado y estados de órdenes

**Depende de:** E5 · **Paralelo con:** E7

- Listado con el patrón §5A: filtros por doctor, estado, rango de fechas, buscador
- Panel lateral con el detalle de la orden
- Cambio de estado: ingresada → en proceso → terminada
- Vista separada de entregadas y facturadas
- Alerta visual cuando la fecha de entrega comprometida ya pasó

**Archivos:** `src/app/ordenes/page.tsx` · `src/components/ordenes/lista*` ·
`src/components/ordenes/detalle*`

---

## E7 · Comanda

**Depende de:** E5 · **Paralelo con:** E6

El papel chico que sale al cargar la orden. Patrón §5D.

```
OT: 004821
[código de barras Code 128]
dr/a: (nombre)
paci: (paciente)
caso: (trabajo)
cant: (cantidad)
Ctl : (fecha y hora de entrega)
```

- Código de barras con JsBarcode, contenido `OT-004821`
- Vista previa en pantalla y exportable a PDF
- Ancho parametrizable (58 mm / 80 mm) — el valor real se define en E13

**Archivos:** `src/components/documentos/comanda.tsx` · `src/app/ordenes/comanda/**`

---

## E8 · Escaneo y remitos

**Depende de:** E6, E7 · **Paralelo con:** nada

- **Intérprete de escaneos:** campo con foco global que lee lo que llega del lector
  (que se comporta como un teclado) y despacha según prefijo: `OT-` abre una orden,
  `CMD-` ejecuta una acción
- **Bandeja:** se escanean varias comandas, se acumulan, y se valida que sean todas del
  mismo doctor antes de emitir
- Función `emitir_remito`: en una sola transacción crea el remito, sus líneas, el
  asiento contable, marca las OT como entregadas e imputa el saldo a favor si lo hay
- Documento de remito con el bloque de cuenta corriente (saldo anterior, fact/mes,
  pagos del mes, saldo CtaCte, OT entregadas, este ticket, saldo total)
- Lleva la leyenda **"documento no válido como factura"**
- Función `anular_remito`: genera contra-asiento, nunca borra

**Archivos:** `src/app/remitos/**` · `src/components/remitos/**` ·
`src/components/documentos/remito.tsx` · `src/lib/scanner.ts` ·
`supabase/migrations/*_emitir_remito.sql` · `*_anular_remito.sql`

---

## E9 · Cuenta corriente

**Depende de:** E8 · **Paralelo con:** nada

La etapa más delicada del proyecto. Nada acá se edita ni se borra.

- Libro mayor por doctor: asientos con fecha, tipo, monto, referencia
- Registro de pagos con `registrar_pago`
- **Imputación:** automática al remito más viejo primero, con opción manual
- Saldos a favor (pagos sin imputar) y auto-imputación al remito siguiente
- Vista de cuenta por doctor: movimientos, saldo, qué está impago y de qué paciente
- Reporte de antigüedad de deuda: 0-30, 31-60, 61-90, +90 días

**Archivos:** `src/app/cuenta-corriente/**` · `src/app/pagos/**` ·
`src/components/cc/**` · `supabase/migrations/*_registrar_pago.sql`

---

## E10 · Cierre mensual y liquidación

**Depende de:** E9 · **Paralelo con:** E11

- Función `cerrar_periodo`: valida y congela los saldos del mes
- Un movimiento con fecha dentro de un período cerrado exige un ajuste explícito
- Documento de liquidación por doctor (hoja A4): datos del doctor + tabla de
  fecha, ticket, artículo, paciente, obra social, cantidad, precio, total + el bloque
  de saldos
- Generación en lote para todos los doctores con movimientos del mes

**Archivos:** `src/app/liquidaciones/**` · `src/components/documentos/liquidacion.tsx` ·
`supabase/migrations/*_cerrar_periodo.sql`

---

## E11 · Tablero y reportes

**Depende de:** E9 · **Paralelo con:** E10

Lo que Damián hoy no tiene y le va a hacer sentir que valió la pena.

- Facturación del mes y comparación con el anterior
- Deuda total y ranking de deudores
- Órdenes en proceso y atrasadas
- Totales por obra social
- Trabajos más vendidos

**Archivos:** `src/app/page.tsx` (inicio) · `src/app/reportes/**`

---

## E12 · Migración de datos · 🔒 BLOQUEADA

**Bloqueada por:** no se conoce el formato de la base del Denture System.

Cuando se destrabe: scripts de importación de doctores, catálogo, órdenes históricas
y el histórico de pagos. Incluye continuar la numeración de OT y remitos desde donde
quedó el sistema viejo — **no arrancar en 1**.

---

## E13 · Impresión física · 🔒 BLOQUEADA

**Bloqueada por:** no hay impresora ni lectora todavía.

Cuando se destrabe: ancho real del ticket, Chrome en `--kiosk-printing`, y agente
ESC/POS solo si hace falta corte automático de papel.

Mientras tanto, E7 y E8 generan los documentos en pantalla y PDF, que es suficiente
para trabajar y para mostrárselos a Damián.
