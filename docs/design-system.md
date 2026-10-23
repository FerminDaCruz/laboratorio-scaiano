# Design System

**Regla única: todo lo visual sale de acá.** No inventes colores, espaciados, tamaños
ni componentes sobre la marcha. Si necesitás un patrón que no está documentado, pará
y preguntá antes de escribirlo.

Esto es software de gestión: se opera todos los días, muchas horas, con teclado y a
velocidad. Se diseña **denso, legible y predecible**, no bonito. Nada de gradientes,
sombras grandes, animaciones de entrada ni tarjetas redondeadas por todos lados.

---

## 1. Tokens

Van en `src/app/globals.css`. Tailwind v4, bloque `@theme`.

```css
@import "tailwindcss";

@theme {
  /* Neutrales — slate con leve sesgo frío */
  --color-bg:           #f7f8fa;   /* fondo de la aplicación */
  --color-surface:      #ffffff;   /* tarjetas, tablas, paneles */
  --color-surface-alt:  #f1f3f6;   /* filas alternas, encabezados de tabla */
  --color-border:       #dfe3e9;
  --color-border-strong:#c2c9d3;

  --color-ink:          #16202e;   /* texto principal */
  --color-ink-2:        #47536b;   /* texto secundario */
  --color-ink-3:        #7b879c;   /* texto terciario, placeholders */

  /* Acento — una sola familia, usada con moderación */
  --color-accent:       #0e7490;
  --color-accent-hover: #0b5f77;
  --color-accent-soft:  #e0f3f8;
  --color-accent-ink:   #ffffff;

  /* Semánticos — estado, NO decoración */
  --color-ok:        #15803d;  --color-ok-soft:      #e6f4ea;
  --color-warn:      #b45309;  --color-warn-soft:    #fdf1dd;
  --color-danger:    #b42318;  --color-danger-soft:  #fdeceb;
  --color-info:      #1d4ed8;  --color-info-soft:    #e8eefc;

  /* Tipografía */
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, Consolas, monospace;

  /* Radios — chicos, esto no es una landing */
  --radius-sm: 3px;
  --radius-md: 5px;
  --radius-lg: 8px;   /* solo modales y paneles */

  /* Sombras — mínimas */
  --shadow-sm: 0 1px 2px rgb(22 32 46 / .06);
  --shadow-md: 0 4px 12px -4px rgb(22 32 46 / .14);
}
```

### Sidebar

El sidebar (§9) tiene tokens propios porque es oscuro en los dos temas. En modo claro
valen lo mismo que `ink` / `border` / `ink-3`.

```css
@theme {
  --color-sidebar:       #16202e;
  --color-sidebar-ink:   #dfe3e9;
  --color-sidebar-ink-2: #7b879c;   /* títulos de grupo */
  --color-sidebar-hover: rgb(255 255 255 / .06);
}
```

### Modo oscuro

El modo claro es el predeterminado. El usuario elige **Claro / Oscuro / Sistema** desde
el menú de usuario de la barra superior; `next-themes` pone la clase `.dark` en `<html>`.

El modo oscuro usa **los mismos nombres de token**. Los componentes nunca preguntan por
el tema: solo usan tokens. Por eso no se escriben clases `dark:` en los componentes.

Los documentos imprimibles (§5D) son blanco y negro puros con cualquier tema.

```css
.dark {
  --color-bg:            #0e141c;
  --color-surface:       #151c26;
  --color-surface-alt:   #1c2531;
  --color-border:        #2a3441;
  --color-border-strong: #3a4655;

  --color-ink:           #e3e8ef;
  --color-ink-2:         #a9b3c2;
  --color-ink-3:         #7d899b;

  --color-accent:        #0e7490;
  --color-accent-hover:  #1285a4;
  --color-accent-soft:   #0d2f3a;
  --color-accent-ink:    #ffffff;

  --color-ok:     #4cae6e;  --color-ok-soft:     #11281a;
  --color-warn:   #d99a3e;  --color-warn-soft:   #33240f;
  --color-danger: #ef6f64;  --color-danger-soft: #3a1613;
  --color-info:   #6f9cf5;  --color-info-soft:   #15213f;

  --color-sidebar: #0a0f15;

  --shadow-sm: 0 1px 2px rgb(0 0 0 / .4);
  --shadow-md: 0 4px 12px -4px rgb(0 0 0 / .6);
}
```

---

## 2. Tipografía

Base **14px**, no 16. Es una aplicación densa con tablas.

| Rol | Tamaño / peso | Uso |
|---|---|---|
| `text-xs` 12px / 400 | metadatos, ayudas, notas al pie |
| `text-sm` 13px / 400 | **texto por defecto de la app** |
| `text-base` 14px / 400 | cuerpo de formularios y campos |
| `text-lg` 16px / 600 | título de sección dentro de una página |
| `text-xl` 18px / 600 | título de página |
| `text-2xl` 22px / 600 | solo cifras destacadas de un tablero |

**Etiquetas de campo y encabezados de tabla:** 11px, peso 600, `uppercase`,
`tracking-wide`, color `ink-3`.

**Números.** Toda columna numérica y todo monto lleva `font-variant-numeric: tabular-nums`
y se alinea a la derecha. Sin excepción.

**Mono** (`--font-mono`) solo para: números de OT, números de remito, ficha del doctor,
códigos de trabajo, códigos de barras y el contenido de los documentos imprimibles.
Son identificadores que se leen y se dictan; el cero con punto de IBM Plex Mono evita
confundirlo con la letra O.

---

## 3. Espaciado

Escala de 4 px: `4 · 8 · 12 · 16 · 24 · 32 · 48`. Nada intermedio.

- Padding de celda de tabla: `8px 12px`
- Padding de tarjeta o panel: `16px`
- Separación entre campos de formulario: `12px`
- Separación entre secciones: `24px`
- Ancho máximo de un formulario de una columna: `640px`
- La aplicación usa **el ancho completo** de la pantalla; los listados no se centran
  en una columna angosta.

---

## 4. Componentes permitidos

Solo estos de shadcn/ui. Están instalados en `src/components/ui/` y **ajustados a este
documento** (radios, alturas, foco, espaciado, colores). Si se reinstala uno con la CLI
de shadcn, hay que volver a ajustarlo:

```
button  input  label  select  textarea  checkbox  switch
table  dialog  sheet  dropdown-menu  popover  command
tabs  badge  separator  skeleton  sonner (toast)  tooltip  alert-dialog
```

Cualquier otro componente de shadcn, o uno propio que no esté acá, **se pregunta antes**.

### Botones

| Variante | Cuándo |
|---|---|
| `default` (acento sólido) | **una sola** acción primaria por pantalla |
| `outline` | acciones secundarias |
| `ghost` | acciones dentro de una fila o una barra de herramientas |
| `destructive` | solo anular o eliminar, y siempre con `alert-dialog` de confirmación |

Altura estándar `32px` (`size="sm"`). Los botones de 40px solo en modales.

### Badges de estado

Fondo `-soft`, texto del color pleno, radio `sm`, 11px, peso 600.

| Estado de la OT | Color |
|---|---|
| Ingresada | neutral (`surface-alt` / `ink-2`) |
| En proceso | `warn` |
| Terminada | `info` |
| Entregada | `ok` |
| Anulada | `danger` |

| Estado de cuenta corriente | Color |
|---|---|
| Saldo a favor | `ok` |
| Al día | neutral |
| Con deuda | `warn` |
| Vencida +60 días | `danger` |

**El color semántico significa estado, nunca decoración.** No pintes de verde un botón
porque "queda bien".

---

## 5. Patrones de página

Solo existen estos cuatro. Toda pantalla es uno de ellos.

### A · Listado

El patrón más usado. Estructura fija, de arriba hacia abajo:

```
┌ Título de la página              [ Acción primaria ] ┐
│ Barra de filtros: buscador + selects + rango fechas  │
├──────────────────────────────────────────────────────┤
│ Tabla                                                │
├──────────────────────────────────────────────────────┤
│ Total de resultados            ← Anterior  Siguiente →│
└──────────────────────────────────────────────────────┘
```

Reglas:
- El buscador toma foco al cargar la página.
- Los filtros se aplican al instante, sin botón "Buscar".
- Paginado de 50 filas.
- Clic en una fila abre el detalle en **panel lateral** (`sheet`), no en una página nueva.
- La fila enfocada se marca con `accent-soft`; las flechas ↑↓ mueven el foco y Enter abre.

### B · Tabla

- Encabezado `surface-alt`, sticky al hacer scroll.
- Filas de 36px. Sin filas alternas de color: se separan con `border`.
- Hover: `surface-alt`.
- Números y montos a la derecha con `tabular-nums`. Texto a la izquierda. Fechas a la izquierda.
- Si la tabla no entra a lo ancho, va en un contenedor con `overflow-x: auto`.
- **Nunca** se trunca un monto ni un nombre de paciente; se trunca la descripción larga.

### C · Formulario

- Una columna, etiqueta arriba del campo.
- Agrupar en secciones con `separator` y un título de sección de 11px en mayúsculas.
- Los errores van **debajo del campo**, en `danger`, 12px. Nunca un toast para un error
  de validación.
- Los campos obligatorios llevan un asterisco en `danger` pegado a la etiqueta, y al pie del
  formulario va la aclaración "* Campos obligatorios". Los opcionales no se marcan.
- Acciones abajo a la derecha: `Cancelar` (outline) y la primaria.
- `Ctrl/Cmd + Enter` guarda desde cualquier campo.

### D · Documento imprimible

Comanda, remito y liquidación. Reglas propias:

- Fuente `--font-mono` completa, tamaño fijo en `mm` o `pt`, **nunca** `rem`.
- Blanco y negro puros. Sin color, sin fondos grises, sin bordes redondeados.
- Cada documento es un componente en `src/components/documentos/`.
- Los estilos de impresión viven en el mismo archivo, dentro de `@media print` con
  `@page { size: ...; margin: ... }`.
- Nada de la interfaz (barra lateral, botones, filtros) se imprime: usar
  `print:hidden` en el layout.

---

## 6. Teclado

Este sistema se opera sin mouse. No es una aspiración, es un requisito.

| Tecla | Acción |
|---|---|
| `Tab` / `Shift+Tab` | avanza y retrocede entre campos, en orden visual |
| `Enter` | en un campo de formulario, avanza al siguiente (no envía) |
| `Ctrl/Cmd + Enter` | guarda el formulario |
| `Esc` | cierra modal o panel; si hay cambios sin guardar, pide confirmación |
| `↑ ↓` | mueven el foco entre filas de una tabla |
| `/` | pone el foco en el buscador de la página |

Reglas duras:
- **Todo elemento enfocable tiene foco visible**: anillo de 2px en `accent`. No borrar
  el outline sin reemplazarlo.
- El orden del DOM es el orden visual. No reordenar con CSS.
- Ningún flujo requiere el mouse para completarse.
- Los `select` de doctor y de trabajo usan `command` (combobox con búsqueda), que filtra
  al tipear tres letras.

---

## 7. Estados

Los tres, siempre. Una pantalla sin estado vacío o sin estado de error está incompleta.

- **Cargando:** `skeleton` con la forma del contenido real. Nunca un spinner centrado
  en toda la página, nunca un salto de layout.
- **Vacío:** un texto en `ink-3` que dice qué falta y, si corresponde, la acción para
  crearlo. Sin ilustraciones ni emojis.
- **Error:** qué pasó y qué hacer, en lenguaje llano. "No se pudo guardar la orden.
  Revisá la conexión y probá de nuevo." Nunca un código de error crudo, nunca "Oops".

### Feedback de acciones

- Éxito: `toast` breve en verbo pasado — "Orden creada", "Pago registrado".
- Error de sistema: `toast` en `danger`, que no se cierra solo.
- Error de validación: debajo del campo, nunca en toast.
- Acción destructiva: `alert-dialog` que nombra lo que se va a hacer.

---

## 8. Formato de datos

Centralizado en `src/lib/money.ts` y `src/lib/format.ts`. **No formatees a mano en un
componente.**

```ts
formatARS(centavos)   // 14400000 → "$ 144.000,00"
formatFechaCorta(d)   // "18/09/26"   ← tablas
formatFechaLarga(d)   // "18/09/2026" ← documentos
formatHora(d)         // "11:42"
formatOT(n)           // 4821 → "004821"  (6 dígitos)
formatRemito(n)       // 12940 → "012940"
formatPieza(p)        // "1.8" · "2.4–2.6" · "arcada sup." · "—"
```

Montos negativos (saldo a favor) en `ok` y entre paréntesis: `($ 12.000,00)`.

Las piezas de un ítem de orden se eligen **clickeando el odontograma**, nunca tipeando: el
trabajo se cobra por cantidad (número escrito) o por piezas (cantidad deducida del
diagrama). Tres o más piezas contiguas se muestran como tramo: `3.3–3.7 · 4.4`.

---

## 9. Layout

```
┌──────────┬───────────────────────────────────────────┐
│ Sidebar  │  Barra superior: título + usuario         │
│ 200px    ├───────────────────────────────────────────┤
│ fijo     │  Contenido, padding 24px, ancho completo  │
└──────────┴───────────────────────────────────────────┘
```

Sidebar: fondo `sidebar` (tokens propios, ver §1), ítems en 13px. Grupos: **Producción** (Órdenes, Remitos),
**Cuentas** (Cuenta corriente, Pagos, Liquidaciones), **Datos** (Doctores, Trabajos,
Obras sociales). El ítem activo lleva fondo `accent`.

En pantallas menores a 1024px el sidebar colapsa a iconos. **No se diseña para
teléfono**: es una aplicación de escritorio de laboratorio.

---

## 10. Lo que no se hace

- Gradientes, glassmorphism, sombras grandes, bordes de más de 8px de radio.
- Animaciones de entrada al hacer scroll. Las transiciones son de 120ms y solo en
  hover y apertura de paneles.
- Emojis en la interfaz.
- Más de un color de acento.
- Iconos sin etiqueta de texto, salvo en una barra de herramientas de fila con `tooltip`
  o en el sidebar colapsado (§9), también con `tooltip`.
- Clases `dark:` en los componentes: el modo oscuro sale solo de los tokens (§1).
- Diseño responsive para teléfono.
