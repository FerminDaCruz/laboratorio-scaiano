@AGENTS.md

# Sistema de gestión — Laboratorio dental

Reemplazo de "Denture System Servidor" (2001). Gestiona órdenes de trabajo de prótesis
dental, remitos y la cuenta corriente de cada odontólogo.

---

## ⛔ REGLAS ABSOLUTAS

### 1. NUNCA hacer commits

**NO ejecutes `git commit` bajo ninguna circunstancia.** Tampoco `git add`, `git push`,
`git merge`, `git rebase`, `git checkout -b` ni ninguna operación que modifique el
historial o el índice de git.

Esto no tiene excepciones. No importa si:
- el cambio parece pequeño o seguro
- terminaste una etapa completa
- el usuario dice "guardá los cambios" (eso significa escribir archivos, no commitear)
- te parece buena práctica hacer un checkpoint

Los commits los hace el usuario, siempre, a mano. Si creés que conviene commitear,
**decilo en tu respuesta** y seguí trabajando. Podés usar `git status` y `git diff`
para leer el estado, nada más.

### 2. Registrar cada avance

Al terminar cualquier tarea con resultado visible, agregá una entrada al final de
`docs/bitacora.md` siguiendo el formato que está ahí. Una entrada por tarea, no una
por sesión. Esto es obligatorio, no opcional.

### 3. No inventar diseño

Todo lo visual sale de `docs/design-system.md`. No inventes colores, espaciados,
tamaños de fuente ni componentes nuevos. Si necesitás un patrón que no está
documentado, **pará y preguntá** antes de escribir el componente.

### 4. La plata nunca es float

Todos los montos se guardan como `numeric(12,2)` en Postgres y se manejan como
**enteros de centavos** en TypeScript. Nunca `float`, nunca `parseFloat` sobre un
monto, nunca aritmética de punto flotante sobre dinero.

### 5. No instalar dependencias sin avisar

Si una tarea parece necesitar un paquete nuevo, decí cuál y por qué, y esperá
confirmación. La lista de dependencias aprobadas está más abajo.

---

## Stack

| Capa | Qué | Notas |
|---|---|---|
| Framework | Next.js 16, App Router | `output: 'export'` — **sitio estático** |
| Lenguaje | TypeScript, modo estricto | |
| Estilos | Tailwind CSS v4 | Tokens en `src/app/globals.css` |
| Componentes | shadcn/ui | Solo los que estén en el design system |
| Base + Auth | Supabase (Postgres) | Plan gratuito |
| Formularios | react-hook-form + zod | |
| Fechas | date-fns, locale `es` | |
| Códigos de barras | JsBarcode (Code 128) | Se generan en el cliente |
| Íconos | lucide-react | |
| Hosting | Cloudflare Pages | Lo despliega el usuario |

### Dependencias aprobadas

```
@supabase/supabase-js  react-hook-form  @hookform/resolvers  zod
date-fns  jsbarcode  lucide-react  clsx  tailwind-merge

# base de shadcn/ui y componentes de §4 del design system
@base-ui/react  class-variance-authority  cn  shadcn  tw-animate-css
sonner  cmdk  next-themes

# desarrollo
supabase (CLI)
```

Cualquier otra cosa se pregunta antes.

---

## Restricciones de arquitectura

### Es un sitio estático — no hay servidor Next

`next.config.ts` tiene `output: 'export'`. Eso implica:

- **No uses** Server Actions, Route Handlers (`app/api/**`), middleware,
  `next/headers`, `cookies()`, ISR, ni `revalidate`.
- **No crees rutas dinámicas** (`app/ordenes/[id]/page.tsx`). Con export estático
  necesitarían `generateStaticParams`, que no sirve para IDs que vienen de la base.
  El detalle de un registro se muestra con **query param** (`/ordenes?ot=4821`) o
  con un panel lateral / modal sobre el listado.
- Todas las páginas que leen datos son `"use client"`.
- Las imágenes usan `<img>`, no `next/image` (o `images.unoptimized: true`).

### El acceso a datos va por Supabase, sin ORM

- Las consultas y los ABM simples van directo con `supabase.from(...)` desde el cliente.
- El esquema vive como SQL puro en `supabase/migrations/`, numerado y en orden.
- Los tipos de TypeScript se generan con `supabase gen types typescript` a
  `src/lib/database.types.ts`. **No los edites a mano.**
- No agregues Drizzle, Prisma ni otro ORM.

### Las operaciones que mueven plata son funciones de base de datos

Estas cinco **nunca** se implementan como una secuencia de inserts desde el cliente.
Van como funciones PL/pgSQL `SECURITY DEFINER` y se llaman con `supabase.rpc(...)`:

1. `crear_orden` — asigna el número correlativo y **congela los precios** leyendo el catálogo
2. `emitir_remito` — remito + líneas + asiento contable + marcar OT + imputar, todo en una transacción
3. `registrar_pago` — asiento + imputación FIFO
4. `anular_remito` — genera un contra-asiento; **nunca borra ni edita**
5. `cerrar_periodo` — valida y congela los saldos del mes

Razón: son transacciones multi-tabla. Si el navegador se cierra a la mitad, quedarían
remitos sin asiento o saldos inconsistentes.

### El libro mayor es append-only

Los asientos de cuenta corriente **no se editan ni se borran, nunca.** Un error se
corrige con un asiento inverso. Si escribís un `UPDATE` o un `DELETE` sobre
`movimientos_cc`, está mal.

### La seguridad real es RLS

El guard de rutas en el front es comodidad, no protección. Toda tabla tiene Row Level
Security activa con políticas explícitas. Una tabla nueva sin RLS es un bug.
Hay datos de pacientes: nombre, edad, sexo, obra social. Tratalos como datos sensibles.

---

## Estructura

```
src/
  app/                    # rutas (todas estáticas)
  components/
    ui/                   # shadcn, ajustados al design system
    <dominio>/            # componentes por área: ordenes/, doctores/, cc/
  lib/
    supabase.ts           # cliente único
    database.types.ts     # generado, no editar
    money.ts              # helpers de centavos y formato ARS
    fdi.ts                # notación dental FDI
  hooks/
supabase/
  migrations/             # SQL numerado
  functions/              # las 5 funciones PL/pgSQL
docs/
  design-system.md        # ← el diseño sale de acá
  etapas.md               # ← el plan de trabajo
  bitacora.md             # ← se actualiza al terminar cada tarea
  pendientes-externos.md  # lo que depende del usuario o de Damián
```

---

## Reglas de dominio que no son obvias

- **La orden tiene ítems.** Una OT puede llevar varios trabajos, cada uno con su
  cantidad, sus piezas dentales y su precio congelado.
- **Notación FDI.** Cuadrante 1 = superior derecho del paciente (1.8→1.1), 2 = superior
  izquierdo, 3 = inferior izquierdo, 4 = inferior derecho. Temporales: cuadrantes 5-8.
  El campo de piezas debe aceptar cuatro formas: sin pieza, piezas sueltas, tramo
  (un puente) y arcada completa. Las sueltas y los tramos se pueden combinar en un mismo
  ítem, separados por coma: `1.1,2.4-2.6`.
- **Un remito agrupa varias OT** del mismo doctor. No es una por una.
- **El precio del catálogo cambia con el tiempo.** El catálogo tiene historial con
  fecha de vigencia; la orden guarda el precio del día en que se cargó.
- **"Ps" y "dto"** en la ficha del doctor son **piso y departamento** — parte del
  domicilio. No son lista de precios ni descuento.
- **"Od/obra"** es obra social. Es tabla propia, no texto libre.

---

## Formatos (Argentina, es-AR)

- Moneda: `$ 144.000,00` — punto para miles, coma para decimales
- Fecha en tablas: `dd/MM/yy` · en documentos: `dd/MM/yyyy`
- Hora: 24 h, `HH:mm`
- Todo el texto de interfaz en **español rioplatense**, sin voseo forzado en botones
  (usar "Guardar", "Cancelar", no "Guardá")

---

## Cómo trabajar

1. Leé `docs/etapas.md` y trabajá **solo** sobre la etapa que el usuario te indique.
2. No adelantes trabajo de otras etapas ni "de paso" arregles cosas fuera de alcance.
3. Cuando termines, actualizá `docs/bitacora.md`.
4. Si te topás con algo bloqueado (ver `docs/pendientes-externos.md`), dejá un `TODO`
   marcado y seguí con lo que sí se puede hacer. No inventes un reemplazo.
5. No hagas commits. (Sí, de nuevo.)
