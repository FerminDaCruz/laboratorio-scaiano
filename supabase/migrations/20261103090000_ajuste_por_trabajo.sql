-- E14 · El precio se modifica por trabajo, no sobre el total de la orden.
--
-- Pedido de Fer (03/11/2026): el descuento o el plus sobre el total de la orden se va.
-- Ahora cada trabajo de la orden arranca con su precio de catálogo × cantidad, y sobre ese
-- subtotal se puede:
--
--   precio      → escribir directamente lo que se va a cobrar (25.000 → 8.000)
--   porcentaje  → sumar o restar un porcentaje (+10 % por entrega rápida, -10 % de descuento)
--   monto       → sumar o restar un monto fijo (+10.000, -5.000)
--
-- El motivo es opcional. El precio del catálogo sigue congelado en `precio_unitario` y el
-- `subtotal` sigue siendo catálogo × cantidad: la diferencia queda en `ajuste` y lo que se
-- cobra en `importe`. Así el ítem dice a la vez cuánto valía y cuánto se cobró.
--
-- Las columnas de ajuste de `ordenes` quedan, porque las órdenes ya facturadas con un ajuste
-- sobre el total lo siguen mostrando. Ninguna orden nueva o editada las usa: quedan en cero.

-- ------------------------------------------------------------------ columnas

alter table public.orden_items
  add column if not exists ajuste_tipo   text,
  add column if not exists ajuste_valor  numeric(12,2),
  add column if not exists ajuste        numeric(12,2) not null default 0,
  add column if not exists ajuste_motivo text;

alter table public.orden_items
  add column if not exists importe numeric(12,2)
  generated always as (precio_unitario * cantidad + ajuste) stored;

alter table public.orden_items drop constraint if exists orden_items_ajuste_tipo_check;
alter table public.orden_items
  add constraint orden_items_ajuste_tipo_check
  check (ajuste_tipo in ('precio', 'porcentaje', 'monto'));

alter table public.orden_items drop constraint if exists orden_items_importe_check;
alter table public.orden_items
  add constraint orden_items_importe_check
  check (precio_unitario * cantidad + ajuste >= 0);

comment on column public.orden_items.subtotal is
  'Precio de catálogo × cantidad, sin modificar.';
comment on column public.orden_items.ajuste is
  'Diferencia entre lo que se cobra y el subtotal de catálogo. Negativo descuenta, positivo suma.';
comment on column public.orden_items.ajuste_tipo is
  'Cómo se pactó la modificación: precio (se escribió el importe final), porcentaje o monto.';
comment on column public.orden_items.ajuste_valor is
  'Lo que se escribió: el importe final, el porcentaje con signo o el monto con signo.';
comment on column public.orden_items.importe is
  'Lo que se cobra por este trabajo: subtotal + ajuste.';
comment on column public.ordenes.ajuste is
  'Ajuste sobre el total de la orden. Solo en órdenes viejas: desde el 03/11/2026 el ajuste va por trabajo.';

-- --------------------------------------------------------------- el ajuste

/** Cuánta plata mueve la modificación de un trabajo, a partir de su subtotal de catálogo. */
create or replace function public.ajuste_de_item(
  p_base  numeric,
  p_tipo  text,
  p_valor numeric
)
returns numeric
language plpgsql
immutable
as $fn$
begin
  if p_tipo is null or p_valor is null then
    return 0;
  end if;

  if p_tipo = 'precio' then
    if p_valor < 0 then
      raise exception 'El precio de un trabajo no puede ser negativo';
    end if;
    return round(p_valor - p_base, 2);
  end if;

  if p_tipo = 'porcentaje' then
    if p_valor < -100 then
      raise exception 'Un descuento no puede ser de más del 100 %%';
    end if;
    return round(p_base * p_valor / 100, 2);
  end if;

  if p_tipo = 'monto' then
    return round(p_valor, 2);
  end if;

  raise exception 'La modificación tiene que ser "precio", "porcentaje" o "monto", no "%"', p_tipo;
end;
$fn$;

revoke execute on function public.ajuste_de_item(numeric, text, numeric) from public;

/**
 * Inserta los ítems de una orden y devuelve el total. Lo usan crear_orden y editar_orden,
 * para que las dos congelen el precio y resuelvan la modificación igual.
 */
create or replace function public.cargar_items_de_orden(
  p_orden_id bigint,
  p_fecha    date,
  p_items    jsonb
)
returns numeric
language plpgsql
set search_path = public
as $fn$
declare
  v_item      jsonb;
  v_trabajo   bigint;
  v_cantidad  smallint;
  v_precio    numeric(12,2);
  v_base      numeric(12,2);
  v_tipo      text;
  v_valor     numeric(12,2);
  v_ajuste    numeric(12,2);
  v_total     numeric(12,2) := 0;
  v_posicion  smallint := 0;
begin
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_posicion := v_posicion + 1;
    v_trabajo  := (v_item ->> 'trabajo_id')::bigint;
    v_cantidad := coalesce((v_item ->> 'cantidad')::smallint, 1);

    if v_cantidad < 1 then
      raise exception 'La cantidad del trabajo % tiene que ser mayor que cero', v_trabajo;
    end if;

    -- El precio del catálogo a la fecha de la orden. Nunca se escribe a mano.
    select p.precio
      into v_precio
      from public.precios_trabajo p
     where p.trabajo_id = v_trabajo
       and p.vigente_desde <= p_fecha
     order by p.vigente_desde desc
     limit 1;

    if v_precio is null then
      raise exception 'El trabajo % no tiene precio vigente al %', v_trabajo, p_fecha;
    end if;

    v_base   := v_precio * v_cantidad;
    v_tipo   := nullif(btrim(coalesce(v_item ->> 'ajuste_tipo', '')), '');
    v_valor  := nullif(v_item ->> 'ajuste_valor', '')::numeric(12,2);
    v_ajuste := public.ajuste_de_item(v_base, v_tipo, v_valor);

    if v_base + v_ajuste < 0 then
      raise exception 'El descuento de un trabajo no puede ser mayor que su precio';
    end if;

    insert into public.orden_items (
      orden_id, trabajo_id, cantidad, piezas, precio_unitario, posicion,
      ajuste_tipo, ajuste_valor, ajuste, ajuste_motivo
    ) values (
      p_orden_id, v_trabajo, v_cantidad, nullif(btrim(coalesce(v_item ->> 'piezas', '')), ''),
      v_precio, v_posicion,
      case when v_ajuste <> 0 then v_tipo end,
      case when v_ajuste <> 0 then v_valor end,
      v_ajuste,
      case when v_ajuste <> 0 then nullif(btrim(coalesce(v_item ->> 'ajuste_motivo', '')), '') end
    );

    v_total := v_total + v_base + v_ajuste;
  end loop;

  return v_total;
end;
$fn$;

-- Solo la llaman crear_orden y editar_orden, que ya validaron el permiso y corren como
-- dueñas (SECURITY DEFINER). Desde la API no se puede llamar.
revoke execute on function public.cargar_items_de_orden(bigint, date, jsonb) from public;
revoke execute on function public.cargar_items_de_orden(bigint, date, jsonb) from anon;
revoke execute on function public.cargar_items_de_orden(bigint, date, jsonb) from authenticated;

-- ----------------------------------------------------------------- crear_orden
-- Vuelve a la firma sin ajuste de la orden: la modificación viaja dentro de cada ítem.

drop function if exists public.crear_orden(
  bigint, text, jsonb, text, smallint, bigint, text, text, date, timestamptz,
  text, numeric, text);
drop function if exists public.crear_orden(
  bigint, text, jsonb, text, smallint, bigint, text, text, date, timestamptz);

create function public.crear_orden(
  p_doctor_id      bigint,
  p_paciente       text,
  p_items          jsonb,
  p_sexo           text        default null,
  p_edad           smallint    default null,
  p_obra_social_id bigint      default null,
  p_color          text        default null,
  p_indicaciones   text        default null,
  p_fecha          date        default null,
  p_entrega_at     timestamptz default null
)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_orden_id  bigint;
  v_numero    integer;
  v_fecha     date := coalesce(p_fecha, current_date);
  v_total     numeric(12,2);
begin
  if not public.es_staff() then
    raise exception 'No tenés permiso para cargar órdenes' using errcode = '42501';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La orden necesita al menos un trabajo';
  end if;
  if coalesce(btrim(p_paciente), '') = '' then
    raise exception 'La orden necesita el nombre del paciente';
  end if;

  v_numero := nextval('public.ordenes_numero_seq');

  insert into public.ordenes (
    numero, doctor_id, paciente, sexo, edad, obra_social_id,
    color, indicaciones, fecha, entrega_at, estado, total, creado_por
  ) values (
    v_numero, p_doctor_id, btrim(p_paciente), p_sexo, p_edad, p_obra_social_id,
    p_color, p_indicaciones, v_fecha, p_entrega_at, 'ingresada', 0, auth.uid()
  )
  returning id into v_orden_id;

  v_total := public.cargar_items_de_orden(v_orden_id, v_fecha, p_items);

  update public.ordenes set total = v_total where id = v_orden_id;

  return json_build_object('id', v_orden_id, 'numero', v_numero, 'total', v_total);
end;
$fn$;

-- ---------------------------------------------------------------- editar_orden
-- Si la orden tenía un ajuste sobre el total (de antes de este cambio), se va al
-- guardar: la pantalla avisa y lo que corresponda se carga en el trabajo.

drop function if exists public.editar_orden(
  bigint, text, jsonb, text, smallint, bigint, text, text, timestamptz,
  text, numeric, text);
drop function if exists public.editar_orden(
  bigint, text, jsonb, text, smallint, bigint, text, text, timestamptz);

create function public.editar_orden(
  p_orden_id       bigint,
  p_paciente       text,
  p_items          jsonb,
  p_sexo           text        default null,
  p_edad           smallint    default null,
  p_obra_social_id bigint      default null,
  p_color          text        default null,
  p_indicaciones   text        default null,
  p_entrega_at     timestamptz default null
)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_orden  record;
  v_total  numeric(12,2);
begin
  if not public.es_staff() then
    raise exception 'No tenés permiso para editar órdenes' using errcode = '42501';
  end if;

  select * into v_orden from public.ordenes where id = p_orden_id for update;
  if v_orden is null then
    raise exception 'No existe esa orden';
  end if;
  if v_orden.remito_id is not null then
    raise exception 'La orden ya está en un remito: para cambiarla hay que corregir el remito';
  end if;
  if v_orden.estado = 'anulada' then
    raise exception 'La orden está anulada';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La orden necesita al menos un trabajo';
  end if;
  if coalesce(btrim(p_paciente), '') = '' then
    raise exception 'La orden necesita el nombre del paciente';
  end if;

  delete from public.orden_items where orden_id = p_orden_id;

  -- El precio del día en que se cargó la orden, no el de hoy.
  v_total := public.cargar_items_de_orden(p_orden_id, v_orden.fecha, p_items);

  update public.ordenes
     set paciente       = btrim(p_paciente),
         sexo           = p_sexo,
         edad           = p_edad,
         obra_social_id = p_obra_social_id,
         color          = p_color,
         indicaciones   = p_indicaciones,
         entrega_at     = p_entrega_at,
         total          = v_total,
         ajuste         = 0,
         ajuste_pct     = null,
         ajuste_motivo  = null
   where id = p_orden_id;

  return json_build_object('id', p_orden_id, 'numero', v_orden.numero, 'total', v_total);
end;
$fn$;

-- El ajuste sobre el total ya no lo usa nadie.
drop function if exists public.ajuste_de_orden(numeric, text, numeric);

-- -------------------------------------------------------------------- permisos

revoke execute on function public.crear_orden(
  bigint, text, jsonb, text, smallint, bigint, text, text, date, timestamptz) from public;
revoke execute on function public.editar_orden(
  bigint, text, jsonb, text, smallint, bigint, text, text, timestamptz) from public;

grant execute on function public.crear_orden(
  bigint, text, jsonb, text, smallint, bigint, text, text, date, timestamptz) to authenticated;
grant execute on function public.editar_orden(
  bigint, text, jsonb, text, smallint, bigint, text, text, timestamptz) to authenticated;

-- ------------------------------------------------------- trabajos nuevos del catálogo
-- "Modelo impreso" y "Envío". El envío no tiene un precio fijo: arranca en $ 0 y lo que
-- se cobra se escribe en la orden, con la modificación de precio del trabajo.
-- Si ya existe un trabajo con el mismo título (en la nube se cargó a mano "MODELO IMPRESO",
-- código MOD, $ 25.000) no se duplica.

insert into public.trabajos (codigo, titulo, descripcion)
select v.codigo, v.titulo, v.descripcion
  from (values
    ('MOD',  'Modelo impreso', null),
    ('ENV',  'Envío',          'El importe se escribe en cada orden')
  ) as v (codigo, titulo, descripcion)
 where not exists (
   select 1 from public.trabajos t
    where t.codigo = v.codigo or lower(t.titulo) = lower(v.titulo)
 );

insert into public.precios_trabajo (trabajo_id, precio, vigente_desde)
select t.id, 0, date '2026-01-01'
  from public.trabajos t
 where t.codigo = 'ENV'
   and not exists (select 1 from public.precios_trabajo p where p.trabajo_id = t.id);

notify pgrst, 'reload schema';
