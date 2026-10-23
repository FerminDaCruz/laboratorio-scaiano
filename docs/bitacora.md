# Bitácora

Registro de avance del proyecto. **Se agrega una entrada al terminar cada tarea con
resultado visible**, no una por sesión. Las entradas nuevas van al final.

## Formato

```
### [AAAA-MM-DD] Etapa EN · Título corto de lo hecho

**Hecho**
- qué quedó funcionando, en una línea por cosa

**Archivos**
- ruta/del/archivo.ts — qué hace

**Decisiones**
- cualquier cosa que se resolvió de una manera y podría haberse resuelto de otra,
  con el porqué en una línea

**Pendiente / bloqueado**
- lo que quedó sin hacer y por qué

**Para el usuario**
- lo que necesita que alguien haga a mano: correr una migración, cargar una variable
  de entorno, revisar algo, commitear
```

Reglas:
- Si no hubo decisiones o pendientes, borrá esa sección en vez de escribir "ninguno".
- No copies código en la bitácora, solo rutas y descripciones.
- Si una tarea se abandonó a la mitad, registrala igual diciendo dónde quedó.

---

### [2026-09-15] Etapa E0 · Arranque del proyecto

**Hecho**
- Proyecto creado con `create-next-app`
- Documentación inicial: `CLAUDE.md`, `design-system.md`, `etapas.md`,
  `pendientes-externos.md`

**Pendiente / bloqueado**
- Todo E0: tokens, layout, cliente de Supabase, helpers, login

**Para el usuario**
- Crear el proyecto en Supabase (región São Paulo) y cargar las claves en `.env.local`

---

### [2026-09-15] Etapa E0 · Fundaciones

**Hecho**
- `npm run build` genera el sitio estático en `out/` (`/`, `/login`, `/tokens`) sin errores
- Tokens del design system en `globals.css`, en modo claro y oscuro
- Layout de §9: sidebar de 200px que debajo de 1024px colapsa a iconos con tooltip, y
  barra superior con el título y el menú de usuario (tema y cerrar sesión)
- Login con email y contraseña, y guard de rutas en el cliente que redirige a `/login?next=...`
- Helpers de §8 en `money.ts` y `format.ts` (salvo `formatPieza`), verificados con 27 casos
- Los 20 componentes de §4 instalados y ajustados al design system
- Página de muestra `/tokens`: colores, tipografía, espaciado, radios, botones, badges,
  tabla, campos con error y estados
- Probado en el navegador con credenciales falsas de Supabase: redirección al login,
  validación con Ctrl+Enter, Enter que avanza de campo, toast de error que no se cierra
  solo, `/tokens` con una sesión simulada, modo oscuro, y sidebar a 958px y a 1440px

**Archivos**
- `next.config.ts` — export estático e imágenes sin optimizar
- `src/app/globals.css` — tokens claros y oscuros, nombres de shadcn apuntados a los tokens, foco visible
- `src/app/layout.tsx` — fuentes Inter e IBM Plex Mono, providers y layout
- `src/app/page.tsx` — redirige a `/tokens` hasta que E11 haga el tablero
- `src/app/login/page.tsx` — formulario de inicio de sesión
- `src/app/tokens/page.tsx` — página de muestra de los tokens
- `src/components/layout/providers.tsx` — tema, sesión, tooltips y toasts
- `src/components/layout/session.tsx` — estado de la sesión de Supabase (`useSesion`)
- `src/components/layout/app-shell.tsx` — layout de §9 y guard de rutas
- `src/components/layout/sidebar.tsx` · `topbar.tsx` · `nav.ts` — navegación, barra superior y título por ruta
- `src/lib/supabase.ts` — cliente único, creado al primer uso
- `src/lib/money.ts` — `formatARS`, `centavosDesdeNumeric`, `centavosANumeric`
- `src/lib/format.ts` — fechas, hora, `formatOT`, `formatRemito`
- `src/components/ui/**` — componentes de shadcn ajustados (más `input-group`, que lo usa `command`)
- `docs/design-system.md` — modo oscuro, tokens del sidebar, componentes ajustados, tooltip del sidebar colapsado

**Decisiones**
- Los componentes de shadcn se modificaron para cumplir el design system, a pedido del
  usuario: radios, 32px en `sm`, foco de 2px en accent, espaciado en escala de 4px,
  sin clases `dark:` y textos en español
- `bg-accent` es el cyan sólido; el resaltado en menús y en `command` usa `accent-soft`
- Button quedó con las cuatro variantes de §4. Badge usa una variante por color de estado
  (`neutral`, `ok`, `warn`, `danger`, `info`) en lugar de las variantes de shadcn
- Se sumó el modo oscuro, con la paleta aprobada por el usuario; el tema predeterminado es el claro
- Tokens nuevos `sidebar*`: §9 pinta el sidebar con `ink`, que en modo oscuro es un color claro
- El body usa 13px (`text-sm`, "texto por defecto"); los campos usan 14px (`text-base`)
- Las sombras del modo oscuro se aplican sobre las utilidades `shadow-sm` y `shadow-md`,
  porque Tailwind copia el valor del token dentro de la utilidad al compilar
- El cliente de Supabase se crea al primer uso, así el build no falla sin `.env.local`;
  sin las variables, la app muestra un mensaje de configuración en vez de romperse
- Las fechas sin hora se leen con `parseISO`, para que no se corran un día por la zona UTC
- `numeric` de Postgres pasa a centavos a través del texto, sin multiplicar floats
- Login: credenciales incorrectas debajo del campo de contraseña; un fallo de red va en
  un toast danger que no se cierra solo
- Iconos del sidebar (lucide): ClipboardList, Truck, BookOpenText, Banknote, FileText,
  Stethoscope, Tags, ShieldCheck
- Dependencias nuevas, con aprobación: `sonner`, `cmdk`, `next-themes`. Aprobadas después
  de instaladas: `@base-ui/react`, `class-variance-authority`, `cn`, `shadcn`,
  `tw-animate-css` y la CLI `supabase`

**Pendiente / bloqueado**
- `formatPieza` queda como `TODO(E4)`: depende de la serialización FDI que define E4
- El tipado del cliente con `database.types.ts` queda como `TODO(E1)`
- El inicio de sesión contra Supabase real no se probó porque no hay proyecto ni `.env.local`

**Para el usuario**
- Crear el proyecto de Supabase, cargar `.env.local` y crear un usuario desde el panel
  para probar el login real
- `CLAUDE.md` quedó desactualizado en tres puntos: perdió la línea `@AGENTS.md`, dice
  Next.js 15 (está instalado 16.3.5) y dice que `ui/` es "shadcn, sin modificar"
- Revisar el diff y commitear

---

### [2026-09-15] Etapa E0 · CLAUDE.md al día

**Hecho**
- `CLAUDE.md` refleja cómo quedó el proyecto después de E0

**Archivos**
- `CLAUDE.md` — vuelve la línea `@AGENTS.md`, Next.js 16, `ui/` ajustados al design system,
  lista de dependencias aprobadas ampliada

**Decisiones**
- Las dependencias que se aprobaron durante E0 pasan a la lista de aprobadas, para que
  las próximas etapas no vuelvan a preguntar por ellas

**Para el usuario**
- Commitear junto con el resto de E0

---

### [2026-10-01] Etapa E1 · Esquema de base de datos

**Hecho**
- Las 12 tablas, con RLS activa y políticas explícitas en todas
- Índices sobre doctor, fecha, estado, número de OT y paciente; secuencias de OT y remito
- Montos en `numeric(12,2)`; `movimientos_cc` protegida contra UPDATE y DELETE por trigger
- Vista `v_precios_vigentes` con el precio del día de cada trabajo
- Seeds: 5 obras sociales, 15 trabajos con 30 precios (uno inicial y un aumento) y 20 doctores
- Verificado con Supabase local: `supabase db reset` aplica migraciones y seeds limpio
- `src/lib/database.types.ts` generado, y el cliente de Supabase ya va tipado

**Archivos**
- `supabase/migrations/20261001090000_esquema.sql` — tablas, índices, secuencias y triggers
- `supabase/migrations/20261001090100_rls.sql` — `es_staff()`, `es_admin()` y políticas
- `supabase/seed.sql` — datos de prueba
- `supabase/crear-usuario-local.sh` — crea un usuario en la base local y su fila en `usuarios`
- `src/lib/tipos.ts` — tipos de dominio y etiquetas de estado
- `src/lib/database.types.ts` — generado, no editar

**Decisiones**
- El personal del laboratorio es quien tiene fila en `usuarios` con `activo = true`, y ve todo.
  `es_staff()` y `es_admin()` son SECURITY DEFINER para que la política de `usuarios` no se recurse
- Las tablas que mueven plata solo tienen política de lectura: se escriben desde las funciones
  SECURITY DEFINER de las etapas siguientes. `ordenes` suma update para el cambio de estado (E6),
  con un trigger que protege número, doctor y total
- No hay políticas de DELETE en ninguna tabla: las bajas son lógicas (`activo = false`)
- `movimientos_cc` usa importe con signo: positivo es deuda, negativo es pago o crédito
- `periodo_saldos` no se creó todavía: va con `cerrar_periodo` en E10

**Para el usuario**
- Aplicar las dos migraciones y los seeds en el proyecto de Supabase (`supabase db push`
  o pegando el SQL en el editor del panel), y crear tu fila en `usuarios` con rol `admin`

---

### [2026-10-01] Etapa E2 · Doctores y obras sociales

**Hecho**
- Listado de doctores con el patrón §5A: buscador por nombre o ficha (atajo `/`), filtros de
  estado y obra social, paginado de 50 y navegación con ↑ ↓ y Enter
- Panel lateral con la ficha del doctor y edición en el mismo panel
- Alta de doctores con ficha única, piso y departamento como parte del domicilio
- ABM de obras sociales con el mismo patrón
- Probado en el navegador contra la base local: login, listado de los 20 doctores, búsqueda y panel

**Archivos**
- `src/app/doctores/page.tsx` · `src/app/obras-sociales/page.tsx` — listados
- `src/components/doctores/datos.ts` — consultas y alta/edición
- `src/components/doctores/panel-doctor.tsx` · `src/components/obras-sociales/panel-obra-social.tsx`
- `src/components/listado/pagina-listado.tsx` · `tabla-navegable.tsx` — patrón §5A y §5B reutilizables
- `src/components/formulario/campo.tsx` · `select-simple.tsx` · `combobox.tsx` — piezas de §5C y §6
- `src/hooks/use-consulta.ts` · `use-atajos.ts` · `use-debounce.ts`
- `src/lib/texto.ts` — normalización para buscar

**Decisiones**
- El título de la página lo muestra la barra superior (§9), así que el encabezado del listado
  solo lleva la acción primaria y los filtros, para no repetirlo
- El buscador espera 250 ms antes de consultar, así no se pide una consulta por tecla
- La ficha duplicada se detecta por el código 23505 de Postgres y se muestra debajo del campo

---

### [2026-10-01] Etapa E3 · Catálogo de trabajos

**Hecho**
- Listado de trabajos con código, título, descripción y precio vigente
- Alta y edición de trabajos, con precio inicial opcional al crear
- Historial de precios en el panel, y alta de un precio nuevo con su fecha de vigencia
- Pantalla de actualización masiva: porcentaje y fecha, vista previa de los 15 precios y
  confirmación con `alert-dialog` antes de aplicar
- Probado en el navegador: +12,5% sobre $93.600 da $105.300

**Archivos**
- `src/app/trabajos/page.tsx` · `src/app/trabajos/precios/page.tsx`
- `src/components/trabajos/datos.ts` · `panel-trabajo.tsx`

**Decisiones**
- Los porcentajes se aplican con aritmética entera (puntos básicos) en `aplicarPorcentaje`,
  nunca multiplicando floats
- Los montos viajan a Postgres como texto a través de `numericParaPostgres`, porque los tipos
  generados declaran `number` y no se quiere pasar por un float
- Cambiar un precio siempre agrega una fila: `precios_trabajo` no tiene política de update

---

### [2026-10-01] Etapa E4 · Odontograma

**Hecho**
- `src/lib/fdi.ts`: notación FDI completa, con temporales, tramos que cruzan la línea media,
  serialización a un solo campo y `formatPieza` de §8
- Componente de odontograma con los cuatro modos: sin pieza, sueltas, tramo y arcada
- Se opera clickeando o tipeando: `2.4-2.6`, `18 24`, `arcada sup`
- Página de prueba `/odontograma` que muestra el valor serializado y el formateado
- 39 casos de prueba de `fdi.ts` (ida y vuelta de la serialización, tramos imposibles, formatos)
- Probado en el navegador: los cuatro modos, con mouse y con teclado

**Archivos**
- `src/lib/fdi.ts` · `src/components/odontograma/odontograma.tsx` · `src/app/odontograma/page.tsx`
- `src/lib/format.ts` — ahora reexporta `formatPieza` desde `fdi`

**Decisiones**
- Formato guardado: `null` · `"1.8,2.4"` · `"2.4-2.6"` · `"arcada:sup"`. Un solo campo de texto,
  legible a simple vista en la base
- Los cuatro modos son excluyentes: una pieza suelta no se mezcla con un tramo
- Varias piezas sueltas se muestran separadas por `·`, que §8 no define para ese caso
- El componente tiene modo compacto (solo el campo tipeable) para las filas de la orden

**Pendiente / bloqueado**
- Un bug encontrado y corregido durante la prueba: al cambiar de modo, el componente se
  reseteaba solo porque el efecto de sincronización pisaba el modo elegido

---

### [2026-10-01] Etapa E5 · Carga de órdenes

**Hecho**
- Función `crear_orden`: asigna el correlativo, congela los precios leyendo el catálogo y
  arma orden e ítems en una sola transacción
- Pantalla de carga en una sola página, con doctor y trabajos precargados (tipear no toca la red)
- Varios ítems por orden, con cantidad y piezas; total estimado en vivo
- Un solo viaje al servidor al guardar; después queda listo para la orden siguiente, con el
  mismo doctor y el foco en Paciente
- Al elegir el doctor se propone su obra social habitual
- 10 pruebas en SQL: numeración, precios congelados, aumento posterior que no afecta a la
  orden ya cargada, total que el cliente no puede tocar, orden sin ítems, trabajo sin precio
  (no deja la orden a medias) y libro mayor que no se deja editar
- Probado en el navegador de punta a punta: la orden quedó en la base con el precio congelado

**Archivos**
- `supabase/migrations/20261001100000_crear_orden.sql`
- `src/app/ordenes/nueva/page.tsx` · `src/components/ordenes/formulario-orden.tsx` · `datos.ts`

**Decisiones**
- El trigger de campos inmutables ahora solo aplica al rol `authenticated`: las funciones que
  mueven plata corren como dueñas de la base y sí recalculan el total
- Los ítems viajan como un `jsonb` con `trabajo_id`, `cantidad` y `piezas`; el precio nunca
- El formulario usa 640px de ancho para los campos, pero la tabla de trabajos ocupa el ancho
  completo: con tres columnas y el odontograma no entra en una columna angosta
- Si falla por falta de precio vigente, el mensaje lo dice con nombre propio en vez del error crudo

**Para el usuario**
- Aplicar también la migración de `crear_orden` cuando pongas el esquema en tu proyecto

---

### [2026-10-01] Etapa E6 · Listado y estados de órdenes

**Hecho**
- Listado de órdenes con filtros de doctor, estado, rango de fechas y buscador por OT o paciente
- Panel lateral con el detalle completo: datos del paciente, trabajos con sus precios congelados y total
- Cambio de estado: ingresada → en proceso → terminada (la entrega la hace el remito en E8)
- Las órdenes atrasadas se marcan con un badge `danger` y la fecha de entrega en rojo
- El filtro de estado incluye una vista "En curso" (ingresadas, en proceso y terminadas) y
  vistas separadas de entregadas y anuladas

**Archivos**
- `src/app/ordenes/page.tsx` · `src/components/ordenes/consultas.ts` · `panel-orden.tsx`

**Decisiones**
- Las consultas traen el doctor y la obra social embebidos (`doctores(...)`, `obras_sociales(...)`),
  así el listado se arma con una sola consulta
- "Atrasada" se calcula en el cliente comparando la fecha comprometida con el momento actual

---

### [2026-10-01] Etapa E7 · Comanda

**Hecho**
- Documento de comanda con el formato del papel: OT, código de barras, dr/a, paci, caso, cant y Ctl
- Código de barras Code 128 con JsBarcode, contenido `OT-000003`
- Vista previa en pantalla y botón para imprimir o guardar en PDF
- Estilos de impresión en el mismo archivo, con `@page` y el ancho de ticket parametrizado
- Probado en el navegador con una orden real

**Archivos**
- `src/components/documentos/comanda.tsx` · `src/app/ordenes/comanda/page.tsx` · `src/lib/impresion.ts`

**Decisiones**
- Una comanda por orden, con una línea `caso:`/`cant:` por trabajo, en vez de una comanda por trabajo
- El ancho del ticket es una sola constante (`ANCHO_TICKET_MM`), para que E13 lo cambie en un solo lugar
- El detalle se direcciona con query param (`?ot=3`), porque el sitio es estático y no hay rutas dinámicas

**Pendiente / bloqueado**
- 🔒 El ancho real (58 u 80 mm) y el corte de papel dependen de la impresora, que es E13

---

### [2026-10-01] Etapa E8 · Escaneo y remitos

**Hecho**
- `emitir_remito`: remito, líneas, asiento contable, OT marcadas como entregadas e imputación
  del saldo a favor, todo en una transacción
- `anular_remito`: contra-asiento por el mismo importe, el remito queda marcado como anulado y
  las órdenes vuelven a estado terminada. No se borra ni se edita ningún asiento
- Bandeja de escaneo: campo con foco permanente que lee lo que manda la lectora, acumula las
  OT y valida que sean todas del mismo doctor, sin remitir y no anuladas
- Intérprete de escaneos con prefijos `OT-` y `CMD-` (CMD-EMITIR, CMD-LIMPIAR)
- Listado de remitos con panel de detalle y anulación con `alert-dialog` y motivo
- Documento de remito con el bloque de cuenta corriente y la leyenda "documento no válido como factura"
- 8 pruebas en SQL y prueba de punta a punta en el navegador: escaneo, emisión y documento

**Archivos**
- `supabase/migrations/20261001110000_emitir_remito.sql` — funciones y vistas de saldos
- `src/lib/scanner.ts` · `src/app/remitos/**` · `src/components/remitos/**`
- `src/components/documentos/remito.tsx`

**Decisiones**
- Vistas `v_saldos_doctor`, `v_deudas_pendientes` y `v_creditos_disponibles`: el saldo sale de
  sumar el libro mayor, nunca de un campo que haya que mantener al día
- Al anular se borran las imputaciones de esa deuda, para que los pagos vuelvan a quedar
  disponibles. Las imputaciones son una asignación, no el libro mayor
- El bloque de cuenta corriente del remito toma "saldo anterior" como el cierre del mes anterior,
  y "este ticket" aparte del "saldo cta cte"

**Pendiente / bloqueado**
- 🔒 Falta confirmar si la lectora agrega prefijo o sufijo propio (E13). Mientras tanto se prueba
  tipeando los códigos, que es equivalente

---

### [2026-10-01] Etapa E9 · Cuenta corriente

**Hecho**
- `registrar_pago`: asiento del pago e imputación FIFO, o a las deudas que se elijan a mano
- Lo que sobra de un pago queda como saldo a favor y se imputa solo al remito siguiente
- Listado de cuentas con saldo, estado (a favor, al día, con deuda, vencida +60) y el reporte
  de antigüedad 0-30 / 31-60 / 61-90 / +90 en columnas
- Vista por doctor: deudas impagas con los pacientes de cada remito y el libro mayor con saldo acumulado
- Pantalla de pagos con imputación automática o manual, y lista de los últimos pagos
- 6 pruebas en SQL y prueba en el navegador: pago de $100.000 imputado al remito y saldo actualizado

**Archivos**
- `supabase/migrations/20261001120000_registrar_pago.sql` — función y vista de antigüedad
- `src/app/cuenta-corriente/page.tsx` · `src/app/pagos/page.tsx` · `src/components/cc/consultas.ts`

**Decisiones**
- El importe del pago viaja como texto (`numericParaPostgres`), nunca como float
- La vista por doctor usa query param (`?doctor=12`) en vez de ruta dinámica, por el export estático
- "Vencida" se decide por la deuda más vieja con más de 60 días, no por el saldo total

---

### [2026-10-01] Etapa E10 · Cierre mensual y liquidación

**Hecho**
- `cerrar_periodo`: congela por doctor el saldo anterior, lo facturado, lo pagado y el saldo
  final del mes en `periodo_saldos`. Solo lo puede correr un administrador
- Un movimiento con fecha dentro de un período cerrado se rechaza salvo que sea un ajuste
  (trigger `movimientos_cc_periodo_cerrado`)
- Documento de liquidación en hoja A4 por doctor: fecha, ticket, OT, artículo, paciente,
  obra social, cantidad, precio y total, más el bloque de saldos
- Generación en lote: se arman todas las liquidaciones del mes y se imprimen juntas,
  una hoja por doctor
- 6 pruebas en SQL (permisos, congelado, bloqueo del período, ajuste permitido, doble cierre)

**Archivos**
- `supabase/migrations/20261001130000_cerrar_periodo.sql` — tabla `periodo_saldos`, trigger y función
- `src/app/liquidaciones/page.tsx` · `src/components/liquidaciones/consultas.ts`
- `src/components/documentos/liquidacion.tsx`

**Decisiones**
- `periodo_saldos` se creó recién acá y no en E1, porque es parte del cierre
- Los remitos anulados no entran en la liquidación, pero sí quedan sus dos asientos en el libro mayor
- El cierre informa cuántas órdenes del mes quedaron sin entregar, sin bloquear por eso

---

### [2026-10-01] Etapa E11 · Tablero y reportes

**Hecho**
- Tablero de inicio con facturación del mes y comparación contra el mes anterior, deuda total,
  órdenes en curso y órdenes atrasadas
- Ranking de doctores con más deuda, con enlace a su cuenta corriente
- Órdenes por estado
- Reportes del mes: totales por obra social, trabajos más vendidos y antigüedad de la deuda
- Probado en el navegador con los datos reales de la base local

**Archivos**
- `src/app/page.tsx` — tablero de inicio (antes redirigía a la página de tokens)
- `src/app/reportes/page.tsx` · `src/components/reportes/consultas.ts`

**Decisiones**
- Las tarjetas del tablero siguen el patrón aprobado: etiqueta de 11px, cifra en `text-2xl`
  y una línea de comparación de 12px
- Los totales por obra social y por trabajo se agrupan en el cliente: PostgREST no agrupa y
  el volumen de un mes es chico
- El nombre del laboratorio en el sidebar ahora lleva al tablero

---

### [2026-10-01] MVP · Pruebas guardadas y estado general

**Hecho**
- Las cuatro suites de prueba en SQL quedaron en `supabase/tests/`, en vez de en un directorio
  temporal. Se corren contra la base local así:
  `docker exec -i supabase_db_laboratorio-scaiano psql -U postgres < supabase/tests/remitos.sql`
  Cada una abre una transacción, crea su propio usuario y termina en `rollback`: no dejan datos
- `supabase db reset` aplica las seis migraciones y los seeds limpio, y las cuatro suites pasan
  sobre esa base recién creada
- `npm run build` genera las 21 páginas estáticas sin errores

**Para el usuario**
- Aplicar las seis migraciones en el proyecto de Supabase y crear tu fila en `usuarios` con rol
  `admin`, si no la app muestra "Tu usuario todavía no está habilitado"
- El Supabase local sigue corriendo; se apaga con `npx supabase stop`

---

### [2026-10-03] Interfaz · Separador de miles en los campos de monto

**Hecho**
- Campo de monto reutilizable que formatea mientras se escribe: `1234567,894` queda
  `1.234.567,89`, alineado a la derecha y con `tabular-nums`
- El cursor se mantiene donde estaba al editar en el medio del número, no salta al final
- Se usa en los tres lugares donde se carga plata: precio nuevo de un trabajo, precio inicial
  al crear un trabajo e importe del pago
- Los conteos grandes (resultados del paginado, órdenes y cantidades de los reportes, cifras
  del tablero) ahora también separan miles con `formatNumero`
- 16 casos de prueba del formateo, incluido el ida y vuelta a centavos
- Probado en el navegador en el precio de un trabajo y en el importe de un pago

**Archivos**
- `src/components/formulario/input-monto.tsx` — el campo
- `src/lib/money.ts` — `formatearEntradaMonto`
- `src/lib/format.ts` — `formatNumero`
- `src/components/trabajos/panel-trabajo.tsx` · `src/app/pagos/page.tsx` — pasan a usarlo
- `src/components/listado/pagina-listado.tsx` · `src/app/reportes/page.tsx` ·
  `src/app/page.tsx` · `src/app/remitos/page.tsx` — conteos con separador

**Decisiones**
- Los códigos siguen sin separador: número de OT, de remito y ficha del doctor. Son
  identificadores, no cantidades, y van en monoespaciada con ceros a la izquierda
- La edad, la cantidad de un ítem y el porcentaje del aumento tampoco se formatean: son
  números de dos o tres dígitos y el punto solo confundiría
- El valor del campo sigue siendo texto; el paso a centavos lo sigue haciendo
  `centavosDesdeTexto`, que ya aceptaba el formato con puntos

---

### [2026-10-03] Etapa E2 · Campos obligatorios y ficha con formato

**Hecho**
- Los campos obligatorios del formulario de doctor (ficha, nombre y fecha de alta) llevan
  asterisco, y al pie está la aclaración "* Campos obligatorios"
- La ficha de un doctor nuevo tiene que empezar con 100 y tener seis dígitos (100102, 100304):
  se valida al guardar, con un mensaje que muestra el formato
- Botón **Generar automático** en el alta: toma la última ficha con ese formato y suma uno.
  Si todavía no hay ninguna, arranca en 100101
- Los seeds pasaron a usar fichas 100101 a 100120, y las pruebas SQL se actualizaron
- Probado en el navegador: el botón genera 100101, una ficha `55` se rechaza con el mensaje
  del formato, y editar un doctor viejo (ficha 101) sigue guardando sin pedir renumerar

**Archivos**
- `src/components/formulario/campo.tsx` — `requerido` y `NotaCamposRequeridos`
- `src/components/doctores/panel-doctor.tsx` · `src/components/doctores/datos.ts`
- `supabase/seed.sql` · `supabase/tests/*.sql` · `docs/design-system.md` (§5C)

**Decisiones**
- El formato se valida **solo cuando la ficha cambia**: las fichas viejas, y las que traiga la
  migración de E12 desde el Denture System, se editan sin tener que renumerarlas
- La validación vive en el formulario y no como `check` en la base, justamente para no
  bloquear la importación de E12. Si se quiere la garantía en la base, es una migración más
- El generador no reserva el número: si dos personas lo piden a la vez, la segunda recibe el
  error de ficha duplicada al guardar y vuelve a generar

---

### [2026-10-03] Etapa E3 · Corregir un precio ya cargado

**Hecho**
- Cargar un precio con una fecha que ya tiene precio ahora pregunta si se corrige, mostrando
  el precio actual y el nuevo, en vez de fallar
- Al confirmar, se corrige esa fila del historial: no se duplica ni se tocan las otras fechas
- Los errores de Supabase se traducen a mensajes legibles (permisos, valor duplicado, sin
  conexión) en vez del "revisá la conexión" genérico para todo

**Archivos**
- `supabase/migrations/20261003090000_precios_corregibles.sql` — política de update en `precios_trabajo`
- `src/lib/errores.ts` — traducción de errores
- `src/components/trabajos/datos.ts` · `panel-trabajo.tsx`

**Decisiones**
- Se mantiene una sola fila por fecha de vigencia: dos precios para el mismo día no significan
  nada y romperían la pregunta "¿cuál era el precio ese día?"
- Corregir el precio de una fecha no cambia ninguna orden ya cargada, porque la orden guarda
  su propio precio congelado. Por eso es seguro permitirlo
- `precios_trabajo` pasa a tener update, pero sigue sin delete: una fila cargada con la fecha
  equivocada se corrige cargando la fecha correcta, no borrando

**Pendiente**
- Si hace falta borrar una fila de precio cargada con la fecha equivocada, hoy no se puede
  desde la app

---

### [2026-10-03] Etapa E5 · Aviso cuando la cantidad no coincide con las piezas

**Hecho**
- En cada ítem de la orden, debajo de la fila, se muestra cuántas piezas quedaron elegidas
- Si el trabajo tiene piezas sueltas o un tramo y la cantidad no coincide con esas piezas,
  aparece un aviso en `warn`: "La cantidad dice 4 y elegiste 3 piezas…"
- Probado en el navegador: 4 coronas con el tramo 2.4-2.6 muestran el aviso

**Archivos**
- `src/components/ordenes/formulario-orden.tsx`

**Decisiones**
- Es un aviso y no un error que bloquee: la regla "una pieza por unidad" vale para coronas,
  incrustaciones y puente por elemento, pero no para una prótesis completa (cantidad 1 y una
  arcada entera) ni para un modelo o una cubeta, que no llevan pieza
- No se controla nada cuando la selección es una arcada completa o cuando no hay piezas
- El aviso usa `warn` (estado, no decoración); el rojo de §5C queda para los errores que
  impiden guardar

**Pendiente**
- Para que sea un error duro habría que marcar en el catálogo qué trabajos se hacen pieza por
  pieza (una columna `por_pieza` en `trabajos`). Queda a decisión del usuario

---

### [2026-10-23] Etapa E14 · La cantidad sale de las piezas

Pedido de Fer: en un ítem no se carga la cantidad y las piezas por separado. O se escribe
una cantidad fija, o se eligen las piezas en el diagrama y la cantidad se deduce.

**Hecho**
- Cada trabajo de la orden tiene ahora **Se cobra por**: Cantidad, Piezas o Arcada
  - Cantidad: un número escrito, sin piezas
  - Piezas: la grilla clickeable, sin teclado, y la cantidad es el número de piezas
  - Arcada: superior, inferior o ambas, con cantidad escrita (no son piezas exactas)
- `agruparEnPartes` en `src/lib/fdi.ts`: las corridas de tres o más piezas contiguas se
  vuelven un tramo y el resto queda suelto. `3.3 3.4 3.5 3.6 3.7 4.4 4.7` → `3.3-3.7,4.4,4.7`
- Las partes se ordenan por número de pieza, no por el orden del dibujo: `3.3-3.7,4.3-4.7`
  y no `4.3-4.7,3.3-3.7`. Es como se dicta y como se lee en la comanda
- El odontograma acepta dos props nuevas: `mostrarModos` (oculta pestañas y arcada) y
  `agruparAlClickear` (clickear suma o saca una pieza y los tramos se arman solos)
- Se fue el input de texto de piezas de la fila, y con él la advertencia de cantidad que no
  coincidía: ya no puede pasar
- Probado con node sobre el módulo compilado: 11 casos de agrupado, todos pasan, incluidos
  los dos ejemplos que dio Fer

**Archivos**
- `src/lib/fdi.ts` · `src/components/odontograma/odontograma.tsx` ·
  `src/components/ordenes/formulario-orden.tsx`
- `docs/design-system.md` (§8) · `CLAUDE.md` (regla de dominio nueva)

**Decisiones**
- El umbral del tramo es tres piezas: con dos se muestran sueltas. Es lo que pidió Fer y es
  como se dicta un puente
- Un tramo puede cruzar la línea media (4.1 y 3.1 son vecinos) pero nunca mezcla arcadas ni
  permanentes con temporales
- La arcada completa sigue existiendo como tercer modo: la cantidad ahí se escribe, porque
  no son piezas exactas
- Sin cambios en la base: `orden_items.piezas` guarda el mismo texto de siempre

**Pendiente**
- Sigue sin probarse en el navegador: Docker apagado, y las dos migraciones de E14 sin aplicar

---

### [2026-10-20] Etapa E14 · El descuento es una línea, no otro precio

Devolución de Fer sobre la primera versión: el input de precio por ítem desalineaba la fila
(el texto "Catálogo: $X" empujaba el campo hacia arriba) y, sobre todo, mezclaba dos cosas
distintas: lo que vale el trabajo y lo que se acordó cobrar por esa orden.

**Hecho**
- Se fue el precio por ítem. El precio sale del catálogo, siempre, congelado a la fecha
  de la orden
- La orden tiene un **ajuste**: descuento o plus, en porcentaje o en monto fijo, con motivo
  obligatorio. Columnas nuevas `ajuste`, `ajuste_pct` y `ajuste_motivo`
- `crear_orden` y `editar_orden` reciben el ajuste y recalculan el total; el trigger de
  campos inmutables ahora también protege esas tres columnas
- El formulario muestra el desglose en vivo: Trabajos, Descuento o Plus, Total estimado
- El panel de la orden y el remito imprimen el desglose por orden: el trabajo, la línea de
  descuento o plus con su motivo, y el subtotal
- Pruebas reescritas: `supabase/tests/ajustes.sql`, 15 comprobaciones

**Archivos**
- `supabase/migrations/20261020090000_ajuste_en_la_orden.sql`
- `src/components/ordenes/formulario-orden.tsx` · `datos.ts` · `consultas.ts` ·
  `panel-orden.tsx` · `src/app/ordenes/editar/page.tsx`
- `src/components/remitos/consultas.ts` · `src/components/documentos/remito.tsx`
- `src/lib/tipos.ts` · `CLAUDE.md` · `docs/etapas.md`

**Decisiones**
- El ajuste se guarda resuelto en pesos y, si se pactó en porcentaje, también se guarda el
  porcentaje: así el ticket puede decir "descuento 10%" sin recalcular nada
- El signo lleva la intención: negativo descuenta, positivo suma. Una sola columna
- La fila del ajuste usa `items-start`, no `items-end`: un campo con error o ayuda ya no
  corre a los demás de lugar. Era el origen de lo que se veía feo
- La regla de `CLAUDE.md` volvió a "el precio sale del catálogo", con el ajuste como la
  única forma de mover plata en una orden

**Pendiente / bloqueado**
- Docker sigue apagado: ni esta migración ni la anterior se aplicaron, y las pruebas no
  corrieron
- Falta regenerar `database.types.ts` y borrar `rpcNueva` de `src/lib/supabase.ts`
- Falta probar las pantallas en el navegador

---

### [2026-10-19] Etapa E8 · El remito lleva el domicilio del doctor

**Hecho**
- El remito imprime, debajo del nombre del doctor, su domicilio con piso y departamento y
  la localidad. Es el papel que lleva el cadete al entregar
- Las consultas de remitos traen esos campos; si el doctor no tiene domicilio cargado, no
  se imprime ninguna línea vacía

**Archivos**
- `src/components/documentos/remito.tsx` · `src/components/remitos/consultas.ts`

**Decisiones**
- El domicilio va con sangría debajo del nombre, para que se lea como un bloque de entrega
  y no se confunda con los trabajos
- La comanda no cambia: es el papel que acompaña al trabajo dentro del laboratorio

**Pendiente**
- Sin probar en pantalla: Docker sigue apagado

---

### [2026-10-19] Etapa E14 · Ajustes, correcciones y acciones visibles

Nace de la devolución de Damián después de probar la aplicación desplegada: no encontraba
cómo facturar ni los botones de estado, y necesitaba poder cambiar importes.

**Hecho**
- Precio por ítem editable en la orden: el catálogo lo propone y se puede pisar con el
  precio acordado (un descuento o un plus). Si se cambia, el campo muestra el de catálogo
- `editar_orden`: cambia trabajos, cantidades, piezas, precios y datos del paciente mientras
  la orden no esté facturada. Pantalla nueva en `/ordenes/editar?ot=N`
- `anular_orden`: solo administradores, solo si la orden no entró en un remito, con motivo
- La pantalla ya no puede poner una orden en "entregada" ni "anulada" a mano: eso lo hacen
  las funciones
- `emitir_remito` acepta un descuento o un recargo con motivo; el documento lo imprime como
  subtotal, descuento y total
- **Facturar** desde el panel de la orden y desde el listado, además de la bandeja de escaneo
- Acciones visibles en cada fila del listado, con tooltip, y vuelta atrás de estado en el panel
- **Corregir remito**: lo anula (contra-asiento) y vuelve a la bandeja con las mismas OT
- Suite de pruebas nueva en `supabase/tests/ajustes.sql`, con 12 comprobaciones

**Archivos**
- `supabase/migrations/20261019090000_ajustes_y_correcciones.sql`
- `src/app/ordenes/editar/page.tsx` · `src/components/ordenes/formulario-orden.tsx` ·
  `panel-orden.tsx` · `datos.ts` · `src/app/ordenes/page.tsx`
- `src/app/remitos/nuevo/page.tsx` · `src/components/remitos/consultas.ts` ·
  `panel-remito.tsx` · `src/components/documentos/remito.tsx`
- `src/lib/supabase.ts` — `rpcNueva`, temporal
- `CLAUDE.md` y `docs/etapas.md` — la regla del precio y la etapa nueva

**Decisiones**
- El precio del catálogo pasa a ser el valor por defecto y no una imposición: si quien carga
  escribe otro, se congela ese. La regla de CLAUDE.md se actualizó para decir eso
- Corregir un remito emitido es anularlo y rehacerlo, no editarlo: es lo que el laboratorio
  ya hacía a mano y lo único que deja los saldos cerrados
- Anular órdenes queda para administradores; cambiar el estado de producción, para todos
- El descuento o recargo exige un motivo: sin eso, un número suelto en el ticket no se explica

**Pendiente / bloqueado**
- Docker estaba apagado: la migración no se aplicó y `supabase/tests/ajustes.sql` no se corrió
- Falta regenerar `database.types.ts` y borrar el ayudante `rpcNueva` de `src/lib/supabase.ts`
- Falta probar las pantallas nuevas en el navegador

---

### [2026-10-05] Etapa E0 · Modo demo: entrar sin pantalla de login

**Hecho**
- Si están cargadas `NEXT_PUBLIC_DEMO_EMAIL` y `NEXT_PUBLIC_DEMO_PASSWORD`, la app inicia
  sesión sola con esa cuenta y nadie ve la pantalla de login
- Si el ingreso automático falla, se muestra el login normal: no queda en un bucle
- La barra superior muestra un badge **Modo demo** para que no se confunda con una sesión propia
- Sin esas variables, todo sigue exactamente igual que antes

**Archivos**
- `src/components/layout/session.tsx` · `src/components/layout/topbar.tsx`

**Decisiones**
- Se hace con una cuenta real y no abriendo RLS a anónimos: los datos siguen protegidos por
  la base, y el corte es desactivar ese usuario o sacar las variables
- La contraseña de la cuenta demo queda dentro del JavaScript que descarga el navegador: es
  pública para cualquiera que tenga el link. Por eso va una cuenta hecha para eso, con rol
  `operador`, y no una cuenta de una persona

**Pendiente**
- Falta probarlo: Docker estaba apagado y la base local no respondía. Se prueba creando la
  cuenta demo en el proyecto de Supabase y cargando las dos variables

---

### [2026-10-05] Etapa E0 · El login dejaba al usuario sin habilitar en silencio

**Hecho**
- Si alguien entraba con datos correctos pero no tenía fila en `usuarios`, la pantalla de
  login se quedaba quieta, sin error y sin pasar a la aplicación: la sesión existía, pero
  el guard no redirige hasta que el usuario está habilitado
- Ahora el login muestra qué pasó, con el email de la cuenta, y ofrece salir para probar con otra

**Archivos**
- `src/app/login/page.tsx`

**Decisiones**
- El mensaje va en el login y no en un toast: es una condición permanente de esa cuenta,
  no un error pasajero
- El caso se descubrió al conectar la app al proyecto de Supabase de producción, donde el
  usuario estaba creado en Auth pero faltaba el alta en `usuarios`

---

### [2026-10-03] Etapa E9 · Un doctor dado de baja no esconde su deuda

**Hecho**
- Cuenta corriente dejaba afuera a los doctores inactivos, así que dar de baja a un doctor
  hacía desaparecer su deuda de la pantalla donde se la busca. Ahora se muestran siempre que
  su saldo no esté en cero, con la aclaración "· inactivo" al lado del nombre
- Al apagar "Doctor activo" en la ficha, si el doctor tiene saldo aparece un aviso que dice
  cuánto debe (o cuánto tiene a favor) y qué implica la baja. Es un aviso, no un bloqueo
- Probado en el navegador con un saldo de prueba, que después se borró

**Archivos**
- `src/components/cc/consultas.ts` · `src/app/cuenta-corriente/page.tsx`
- `src/components/doctores/datos.ts` — `saldoDeDoctor`
- `src/components/doctores/panel-doctor.tsx` — el aviso

**Decisiones**
- La baja sigue siendo lógica y sin bloqueos: lo que cambia es que la información no se
  esconde. Un doctor inactivo con saldo cero sí desaparece de Cuenta corriente
- Lo que la baja sigue haciendo: el doctor no aparece en los combos, así que no se le pueden
  cargar órdenes, remitos ni pagos nuevos

---

### [2026-10-03] Datos reales · El reset carga el catálogo y los doctores de verdad

**Hecho**
- `supabase/seed.sql` pasó a tener los datos reales: 64 trabajos con los códigos cortos
  asignados a partir del nombre (CMC, BAN4, FRZR25…) y 52 precios de la lista de marzo de 2026
- Los importes del papel estaban en miles: 150 se cargó como $ 150.000
- Los 66 odontólogos del listado quedaron en `supabase/seed.doctores.local.sql`, que **no se
  versiona**, y `config.toml` carga `./seed.*.local.sql` en cada `db reset`
- `supabase db reset` deja la base siempre igual: 66 doctores, 64 trabajos, 52 con precio,
  5 obras sociales. Verificado, y las cuatro suites SQL pasan sobre esa base
- Las pruebas pasaron a usar fichas y códigos que existen de verdad (100101, 100103, CMC, CZRM)
- El script de usuario local ahora también actualiza la contraseña si el usuario ya existía
- Probado en el navegador: el listado muestra los doctores reales con sus fichas 100xxx

**Archivos**
- `supabase/seed.sql` — catálogo real, sin datos personales, va a git
- `supabase/seed.doctores.local.sql` — odontólogos, fuera de git
- `supabase/config.toml` · `.gitignore` · `supabase/tests/*.sql` · `supabase/crear-usuario-local.sh`

**Decisiones**
- Los datos personales de los odontólogos no viajan en el repositorio: van en un seed aparte
  que el reset carga igual. Si se prefiere tener todo en git, se mueve el contenido a `seed.sql`
- Como el listado no trae fecha de alta, se usa la del reporte (25/02/2026) para que el reset
  sea siempre idéntico
- Las localidades quedan como en el papel: "Bariloche" y "San Carlos de Bariloche" conviven
- El piso y el departamento quedan dentro del domicilio, porque las columnas Ps y Dto del
  listado están vacías
- Los trabajos sin precio en el papel se cargan igual, sin precio: aparecen en el catálogo pero
  el sistema no deja usarlos en una orden hasta que se les cargue uno
- OPAM, Puridént y Dental Bariloche son clínicas: no se cargaron como doctores

**Pendiente**
- Falta la columna de precios que quedó cortada a la derecha de las fotos (parece otro mes)
- Las obras sociales siguen siendo las cinco de prueba: el listado en papel no trae esa columna
- Tres odontólogos anotados a mano (Iturrieta, Volpi y Painemil) no se cargaron: no tienen ficha
- Hay teléfonos y apellidos marcados con ⚠️ en la transcripción, para verificar contra el papel

---

### [2026-10-03] Fuentes · Fotos del laboratorio leídas

**Hecho**
- Se leyeron las cinco fotos de `docs/fuentes/`: la etiqueta de la impresora, dos páginas del
  listado de odontólogos y dos de la lista de precios
- **La impresora ya está**: 3nStar RPT005, papel de **80 mm**, 200 mm/s, RS232 + USB, ESC/POS
  y cajón de dinero. El sistema ya estaba configurado en 80 mm, así que no hubo que cambiar nada
- La transcripción del listado de odontólogos (67 fichas, de 100089 a 100308) quedó en
  `docs/fuentes/transcripcion-odontologos.md`
- La transcripción de la lista de precios de marzo de 2026 quedó en
  `docs/fuentes/transcripcion-precios.md`
- El listado confirma el formato de ficha: todas son 100xxx, igual que la regla que se cargó
  en el formulario de doctores

**Archivos**
- `docs/fuentes/transcripcion-odontologos.md` · `transcripcion-precios.md` — fuera de git
- `docs/pendientes-externos.md` — la impresora pasa de bloqueante a resuelta, con sus datos
- `docs/etapas.md` — E13 ya solo espera la lectora de códigos
- `src/lib/impresion.ts` — el comentario deja de decir que falta saber el modelo

**Decisiones**
- Las transcripciones viven en `docs/fuentes/`, que está fuera de git, porque tienen nombres,
  domicilios y teléfonos de gente real
- No se cargó todavía nada en los seeds: las dos listas están incompletas y los importes
  escritos a mano necesitan confirmación

**Pendiente / bloqueado**
- Falta la parte del listado entre la H y la K (al menos Iturrieta, que figura a mano)
- De la lista de precios faltan las letras D a M, la columna de la derecha que quedó cortada
  y lo que siga después de "Teflón"
- Hay que confirmar si los precios están en miles de pesos
- Los trabajos del papel no tienen código corto y el sistema necesita uno por trabajo
- Sigue faltando la lectora de códigos de barras para cerrar E13

---

### [2026-10-03] Etapa E4 · Sueltas y tramos combinados

**Hecho**
- Una selección ahora puede tener piezas sueltas y tramos a la vez: `1.1,2.4-2.6`
- El campo acepta cualquier orden y con o sin espacios (`2.4-2.6, 1.1`), y lo deja ordenado
  como se ve en la boca
- En la grilla, elegir un tramo se suma a lo que ya estaba; clickear una pieza que está
  dentro de un tramo saca ese tramo entero
- Cambiar de modo (sueltas ↔ tramo) ya no borra lo elegido
- 47 casos de prueba, incluidos los valores viejos: `1.8,2.4` y `2.4-2.6` se siguen leyendo igual
- Probado en el navegador: `2.4-2.6, 1.1` queda `1.1, 2.4-2.6` con cuatro piezas resaltadas,
  y agregando el tramo 4.4-4.6 con el mouse queda `1.1,2.4-2.6,4.4-4.6`

**Archivos**
- `src/lib/fdi.ts` — el valor pasa a ser una lista de partes (pieza o tramo)
- `src/components/odontograma/odontograma.tsx` — el modo es de edición, no del valor
- `src/components/ordenes/formulario-orden.tsx` — el conteo de piezas usa las partes
- `CLAUDE.md` y `docs/etapas.md` — la regla de dominio dice que se pueden combinar

**Decisiones**
- El formato guardado no cambió para los valores que ya existían: `1.8,2.4` ahora se lee como
  dos partes sueltas y `2.4-2.6` como un tramo, sin migrar nada
- Las puntas de un tramo se guardan ordenadas por número de pieza ("4.5-4.7"), que es como se
  dicta, aunque en la arcada inferior el dibujo vaya al revés (4.8 → 4.1)
- Una pieza suelta que queda adentro de un tramo se descarta: la selección no repite piezas
- La arcada completa sigue siendo excluyente: ya incluye todas las piezas de esa arcada

---

### [2026-10-03] Etapa E4 · Un solo campo de piezas por ítem

**Hecho**
- Al desplegar el odontograma dentro de una orden ya no aparece un segundo campo de piezas:
  queda el de la fila, y abajo solo los modos, la grilla y la casilla de temporales
- El componente tiene una prop `mostrarCampo` para eso; en la página de prueba y en cualquier
  uso suelto sigue trayendo su propio campo
- Probado en el navegador: se tipea `2.4-2.6` en la fila, se despliega la grilla y quedan
  resaltadas 24, 25 y 26, con un único campo de texto

**Archivos**
- `src/components/odontograma/odontograma.tsx` · `src/components/ordenes/formulario-orden.tsx`

**Decisiones**
- Era un error de armado, no una función: el campo compacto de la fila y el odontograma
  completo escriben el mismo valor, así que se veían dos campos iguales uno encima del otro
- Se dejó el campo en la fila (y no el del odontograma) para que no cambie de lugar al
  desplegar y el foco del teclado quede siempre en el mismo sitio

---

### [2026-10-03] Design system · La ficha del doctor usa monoespaciada

**Hecho**
- §2 suma la ficha del doctor a la lista de lo que va en `--font-mono`, que ya era lo que
  hacía el código en el formulario, los listados de doctores y cuenta corriente, el panel
  del doctor y el ranking del tablero

**Decisiones**
- La ficha es un identificador que se lee y se dicta, igual que la OT y el remito: el cero
  con punto de IBM Plex Mono evita confundirlo con la letra O, y las columnas de códigos
  quedan alineadas entre sí

---
