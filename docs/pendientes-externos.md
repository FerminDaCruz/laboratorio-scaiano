# Pendientes externos

Lo que **no** puede resolver un agente escribiendo código. Dos listas: lo que depende
de Fer, y lo que está bloqueado esperando algo de afuera.

---

## Parte 1 · Responsabilidades de Fer

Claude no hace nada de esto. Si una etapa se traba esperando algo de acá, lo dice y
sigue con lo que sí puede hacer.

### Antes de E0

- [ ] **Crear la cuenta y el proyecto de Supabase.** Región **São Paulo (sa-east-1)** —
      no es un detalle, define la latencia contra Bariloche.
- [ ] Copiar `Project URL` y `anon public key` a `.env.local`:
      ```
      NEXT_PUBLIC_SUPABASE_URL=...
      NEXT_PUBLIC_SUPABASE_ANON_KEY=...
      ```
- [ ] Confirmar que `.env.local` está en `.gitignore`.
- [ ] Crear el repositorio en GitHub, privado.

### Antes de E1

- [ ] Instalar la CLI de Supabase y vincular el proyecto (`supabase link`).
- [ ] **Aplicar las migraciones.** Claude escribe el SQL; correrlo contra la base es tuyo,
      sea con `supabase db push` o pegándolo en el editor SQL del panel.
- [ ] Crear el primer usuario del sistema desde el panel de Supabase.

### Durante todo el proyecto

- [ ] **Todos los commits.** Claude no commitea nunca. Revisá el diff y commiteá vos.
- [ ] Regenerar los tipos cuando cambia el esquema:
      `supabase gen types typescript --linked > src/lib/database.types.ts`

### Antes de mostrárselo a Damián

- [ ] Conectar el repo a **Cloudflare Pages**.
      Build: `npm run build` · Directorio de salida: `out`
- [ ] Cargar las dos variables de entorno en Cloudflare Pages.

### Antes de que entren datos reales

- [ ] **Armar el backup automático.** GitHub Actions con un cron que corra `pg_dump`
      y suba a Cloudflare R2. Retención de 30 días, más un dump permanente después de
      cada cierre mensual.
- [ ] **Probar una restauración.** Un backup que nunca restauraste no es un backup.
- [ ] Revisar que las políticas de RLS hagan lo que creés que hacen. Una policy mal
      escrita no tira error, simplemente deja los datos accesibles. Hay datos de
      pacientes de por medio.
- [ ] Ping semanal desde GitHub Actions para que el proyecto de Supabase no se pause
      por inactividad (se pausa a la semana sin uso).

---

## Parte 2 · Bloqueado esperando algo de afuera

Cuando un agente se cruce con algo de esta lista: dejá un `TODO` marcado, seguí con lo
que sí se puede, y anotalo en la bitácora. **No inventes un reemplazo.**

### ✅ Impresora térmica — ya se sabe cuál es (03/10/2026)

Según la etiqueta del equipo (`docs/fuentes/impresora.jpeg`):

| Dato | Valor |
|---|---|
| Modelo | 3nStar RPT005, Thermal Receipt Printer |
| Ancho de papel | **80 mm** |
| Velocidad | 200 mm/s |
| Interfaz | RS232 + USB |
| Comandos | **ESC/POS** |
| Cajón de dinero | 24 V / 1 A |
| Alimentación | 24 V / 2,5 A |

El sistema ya estaba configurado en 80 mm (`ANCHO_TICKET_MM` en `src/lib/impresion.ts`),
así que no hay que cambiar nada para empezar a probar.

Lo que queda de E13: imprimir una comanda y un remito de verdad para ver cómo quedan en el
papel, y recién ahí decidir si alcanza con Chrome en `--kiosk-printing` o si hace falta un
agente ESC/POS para el corte automático. La impresora soporta ESC/POS, así que la opción existe.

### 🔒 Lectora de código de barras — bloquea parte de E8

No está comprada todavía. Se asume que se comporta como un teclado (teclea el código
y manda Enter), que es como funciona prácticamente cualquiera.

Mientras tanto: el intérprete de escaneos se desarrolla y se prueba **tipeando los
códigos a mano** en el campo. Funciona igual. Falta confirmar si la lectora agrega
algún prefijo o sufijo propio.

### 🔒 Formato de la base del Denture System — bloquea E12

Es un programa de PC de 2001, no se sabe en qué formato guarda. Para destrabarlo hay
que mirar la carpeta de instalación:

| Extensiones | Qué es | Dificultad |
|---|---|---|
| `.DBF` + `.CDX` / `.FPT` | Visual FoxPro o dBase | fácil, lo más probable |
| `.MDB` / `.ACCDB` | Access | fácil |
| `.DB` + `.PX` | Paradox | media |
| `.DAT` + `.NTX` | Clipper | media |
| un solo archivo grande sin extensión conocida | propietario | difícil |

**Plan B:** casi todos estos programas tienen alguna opción de "listados", "informes" o
"exportar" que manda los datos a texto o a Excel. Buscá esa opción **antes** de
intentar cualquier ingeniería inversa.

Mientras tanto: se trabaja con los datos de prueba de los seeds.

### ❔ Datos que faltan de Damián

- Cuántas órdenes entran por día y **cuántas personas cargan al sistema**
  (el programa viejo se llama "Servidor", así que probablemente hay más de un puesto).
  Define permisos y concurrencia.
- Cómo es la conexión a internet del laboratorio, y si se les corta seguido.
- Si alguna vez corrige o anula una orden ya facturada. Define si `anular_remito` y las
  notas de crédito hacen falta en la v1 o pueden esperar.
- El número de OT y de remito en el que quedó el sistema viejo, para continuar la
  numeración desde ahí.
- Foto o escaneo de los tres papeles reales (orden, comanda, remito, liquidación) para
  confirmar el formato exacto antes de programar los documentos.
