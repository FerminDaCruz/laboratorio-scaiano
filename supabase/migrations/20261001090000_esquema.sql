-- E1 · Esquema base.
-- Convenciones del proyecto (ver CLAUDE.md):
--   * los montos son numeric(12,2), nunca float
--   * el libro mayor (movimientos_cc) es append-only
--   * las operaciones que mueven plata van en funciones SECURITY DEFINER (E5 en adelante)

-- ---------------------------------------------------------------- usuarios
-- Espejo de auth.users con el rol dentro del sistema.
create table public.usuarios (
  id          uuid primary key references auth.users (id) on delete cascade,
  nombre      text not null,
  rol         text not null default 'operador' check (rol in ('operador', 'admin')),
  activo      boolean not null default true,
  creado_en   timestamptz not null default now()
);

comment on table public.usuarios is 'Usuarios del sistema. El alta la hace un admin desde el panel de Supabase.';

-- ------------------------------------------------------- obras sociales
create table public.obras_sociales (
  id         bigint generated always as identity primary key,
  codigo     text not null unique,
  nombre     text not null,
  activa     boolean not null default true,
  creado_en  timestamptz not null default now()
);

-- -------------------------------------------------------------- doctores
create table public.doctores (
  id              bigint generated always as identity primary key,
  ficha           integer not null unique,   -- el número que ya usan en el laboratorio
  nombre          text not null,
  domicilio       text,
  piso            text,                      -- "Ps" en la ficha de papel
  departamento    text,                      -- "dto" en la ficha de papel
  localidad       text,
  telefono        text,
  obra_social_id  bigint references public.obras_sociales (id),
  fecha_alta      date not null default current_date,
  activo          boolean not null default true,
  notas           text,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

comment on column public.doctores.piso is 'Piso del domicilio ("Ps" en la ficha de papel), no es lista de precios.';
comment on column public.doctores.departamento is 'Departamento del domicilio ("dto"), no es descuento.';

create index doctores_nombre_idx on public.doctores (lower(nombre));
create index doctores_activo_idx on public.doctores (activo);

-- -------------------------------------------------------------- trabajos
create table public.trabajos (
  id           bigint generated always as identity primary key,
  codigo       text not null unique,   -- código corto que se tipea al cargar una orden
  titulo       text not null,
  descripcion  text,
  activo       boolean not null default true,
  creado_en    timestamptz not null default now()
);

create index trabajos_titulo_idx on public.trabajos (lower(titulo));

-- Historial de precios: cambiar un precio agrega una fila, nunca pisa la anterior.
create table public.precios_trabajo (
  id             bigint generated always as identity primary key,
  trabajo_id     bigint not null references public.trabajos (id) on delete cascade,
  precio         numeric(12,2) not null check (precio >= 0),
  vigente_desde  date not null,
  creado_por     uuid references public.usuarios (id),
  creado_en      timestamptz not null default now(),
  unique (trabajo_id, vigente_desde)
);

create index precios_trabajo_vigencia_idx
  on public.precios_trabajo (trabajo_id, vigente_desde desc);

-- Precio vigente hoy de cada trabajo.
create view public.v_precios_vigentes
with (security_invoker = on) as
select distinct on (p.trabajo_id)
       p.trabajo_id,
       p.precio,
       p.vigente_desde
  from public.precios_trabajo p
 where p.vigente_desde <= current_date
 order by p.trabajo_id, p.vigente_desde desc;

-- --------------------------------------------------------------- remitos
create table public.remitos (
  id           bigint generated always as identity primary key,
  numero       integer not null unique,
  doctor_id    bigint not null references public.doctores (id),
  fecha        date not null default current_date,
  total        numeric(12,2) not null check (total >= 0),
  anulado_en   timestamptz,
  anulado_por  uuid references public.usuarios (id),
  creado_por   uuid references public.usuarios (id),
  creado_en    timestamptz not null default now()
);

create index remitos_doctor_idx on public.remitos (doctor_id, fecha desc);
create index remitos_fecha_idx on public.remitos (fecha desc);

-- --------------------------------------------------------------- ordenes
create table public.ordenes (
  id              bigint generated always as identity primary key,
  numero          integer not null unique,          -- correlativo de OT
  doctor_id       bigint not null references public.doctores (id),
  paciente        text not null,
  sexo            text check (sexo in ('F', 'M', 'X')),
  edad            smallint check (edad between 0 and 120),
  obra_social_id  bigint references public.obras_sociales (id),
  color           text,                             -- Vita Classic A1-D4 o texto libre
  indicaciones    text,
  fecha           date not null default current_date,
  entrega_at      timestamptz,                      -- fecha y hora comprometida
  estado          text not null default 'ingresada'
                  check (estado in ('ingresada', 'en_proceso', 'terminada', 'entregada', 'anulada')),
  remito_id       bigint references public.remitos (id),
  total           numeric(12,2) not null default 0 check (total >= 0),
  creado_por      uuid references public.usuarios (id),
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

create index ordenes_doctor_idx on public.ordenes (doctor_id, fecha desc);
create index ordenes_estado_idx on public.ordenes (estado);
create index ordenes_fecha_idx on public.ordenes (fecha desc);
create index ordenes_entrega_idx on public.ordenes (entrega_at) where estado in ('ingresada', 'en_proceso');
create index ordenes_remito_idx on public.ordenes (remito_id);
create index ordenes_paciente_idx on public.ordenes (lower(paciente));

create table public.orden_items (
  id               bigint generated always as identity primary key,
  orden_id         bigint not null references public.ordenes (id) on delete cascade,
  trabajo_id       bigint not null references public.trabajos (id),
  cantidad         smallint not null default 1 check (cantidad > 0),
  piezas           text,   -- serialización FDI (ver src/lib/fdi.ts, E4)
  precio_unitario  numeric(12,2) not null check (precio_unitario >= 0),  -- congelado al crear
  subtotal         numeric(12,2) generated always as (precio_unitario * cantidad) stored,
  posicion         smallint not null default 1
);

create index orden_items_orden_idx on public.orden_items (orden_id);
create index orden_items_trabajo_idx on public.orden_items (trabajo_id);

-- Líneas del remito: una por orden entregada.
create table public.remito_lineas (
  id          bigint generated always as identity primary key,
  remito_id   bigint not null references public.remitos (id) on delete cascade,
  orden_id    bigint not null references public.ordenes (id),
  importe     numeric(12,2) not null check (importe >= 0),
  unique (remito_id, orden_id)
);

create index remito_lineas_remito_idx on public.remito_lineas (remito_id);
create index remito_lineas_orden_idx on public.remito_lineas (orden_id);

-- --------------------------------------------------- cuenta corriente
-- Libro mayor. Append-only: no se edita ni se borra ningún asiento.
-- importe > 0 = debe (deuda del doctor) · importe < 0 = haber (pago o crédito)
create table public.movimientos_cc (
  id                   bigint generated always as identity primary key,
  doctor_id            bigint not null references public.doctores (id),
  fecha                date not null default current_date,
  tipo                 text not null check (tipo in ('remito', 'pago', 'nota_credito', 'ajuste')),
  importe              numeric(12,2) not null check (importe <> 0),
  remito_id            bigint references public.remitos (id),
  medio                text check (medio in ('efectivo', 'transferencia', 'cheque', 'otro')),
  referencia           text,
  anula_movimiento_id  bigint references public.movimientos_cc (id),
  creado_por           uuid references public.usuarios (id),
  creado_en            timestamptz not null default now()
);

comment on table public.movimientos_cc is
  'Libro mayor append-only. Un error se corrige con un asiento inverso, nunca con UPDATE ni DELETE.';

create index movimientos_cc_doctor_idx on public.movimientos_cc (doctor_id, fecha desc, id desc);
create index movimientos_cc_remito_idx on public.movimientos_cc (remito_id);
create index movimientos_cc_tipo_idx on public.movimientos_cc (tipo);

-- Qué haber paga qué debe.
create table public.imputaciones (
  id                   bigint generated always as identity primary key,
  movimiento_debe_id   bigint not null references public.movimientos_cc (id),
  movimiento_haber_id  bigint not null references public.movimientos_cc (id),
  importe              numeric(12,2) not null check (importe > 0),
  creado_en            timestamptz not null default now(),
  unique (movimiento_debe_id, movimiento_haber_id)
);

create index imputaciones_debe_idx on public.imputaciones (movimiento_debe_id);
create index imputaciones_haber_idx on public.imputaciones (movimiento_haber_id);

-- --------------------------------------------------------------- periodos
create table public.periodos (
  id           bigint generated always as identity primary key,
  anio         smallint not null check (anio between 2000 and 2100),
  mes          smallint not null check (mes between 1 and 12),
  cerrado_en   timestamptz,
  cerrado_por  uuid references public.usuarios (id),
  unique (anio, mes)
);

-- ------------------------------------------------------------ secuencias
-- TODO(E12): continuar la numeración desde donde quedó el Denture System,
-- con setval(), en vez de arrancar en 1.
create sequence public.ordenes_numero_seq as integer start 1;
create sequence public.remitos_numero_seq as integer start 1;

-- -------------------------------------------------------------- triggers
create or replace function public.tocar_actualizado_en()
returns trigger
language plpgsql
as $fn$
begin
  new.actualizado_en := now();
  return new;
end;
$fn$;

create trigger doctores_actualizado_en
  before update on public.doctores
  for each row execute function public.tocar_actualizado_en();

create trigger ordenes_actualizado_en
  before update on public.ordenes
  for each row execute function public.tocar_actualizado_en();

-- El número, el doctor y el total de una orden no se tocan desde el cliente.
create or replace function public.ordenes_campos_inmutables()
returns trigger
language plpgsql
as $fn$
begin
  if new.numero is distinct from old.numero then
    raise exception 'El número de orden no se puede cambiar';
  end if;
  if new.doctor_id is distinct from old.doctor_id then
    raise exception 'El doctor de una orden no se puede cambiar';
  end if;
  if new.total is distinct from old.total then
    raise exception 'El total de una orden no se puede cambiar: se recalcula desde los ítems';
  end if;
  return new;
end;
$fn$;

create trigger ordenes_inmutables
  before update on public.ordenes
  for each row execute function public.ordenes_campos_inmutables();

-- El libro mayor no se edita ni se borra. Segunda red, además de RLS.
create or replace function public.bloquear_escritura()
returns trigger
language plpgsql
as $fn$
begin
  raise exception 'Los asientos de cuenta corriente no se editan ni se borran. Usá un asiento inverso.';
end;
$fn$;

create trigger movimientos_cc_sin_update
  before update or delete on public.movimientos_cc
  for each row execute function public.bloquear_escritura();
