-- E14 · El descuento y el plus de una orden son una línea aparte.
--
-- Antes (migración anterior de E14) el descuento se hacía escribiendo otro precio en el
-- ítem. Eso mezclaba dos cosas distintas: lo que vale el trabajo y lo que se acordó
-- cobrar por esta orden. Ahora el precio del ítem vuelve a salir siempre del catálogo y
-- el acuerdo va como un ajuste sobre el total de la orden, en porcentaje o en monto
-- fijo, con su motivo. El remito lo imprime como una línea propia.

alter table public.ordenes
  add column if not exists ajuste        numeric(12,2) not null default 0,
  add column if not exists ajuste_pct    numeric(6,2),
  add column if not exists ajuste_motivo text;

comment on column public.ordenes.ajuste is
  'Descuento (negativo) o plus (positivo) sobre la suma de los ítems. El total ya lo incluye.';
comment on column public.ordenes.ajuste_pct is
  'El porcentaje acordado, cuando el ajuste se pactó así. Null si fue un monto fijo.';

-- ----------------------------------------------------------- campos inmutables
-- El ajuste mueve el total, así que tampoco se toca desde el cliente: lo escriben
-- crear_orden y editar_orden.

create or replace function public.ordenes_campos_inmutables()
returns trigger
language plpgsql
as $fn$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if new.numero is distinct from old.numero then
    raise exception 'El número de orden no se puede cambiar';
  end if;
  if new.doctor_id is distinct from old.doctor_id then
    raise exception 'El doctor de una orden no se puede cambiar';
  end if;
  if new.total is distinct from old.total then
    raise exception 'El total de una orden no se puede cambiar: se recalcula desde los ítems';
  end if;
  if new.ajuste is distinct from old.ajuste
     or new.ajuste_pct is distinct from old.ajuste_pct
     or new.ajuste_motivo is distinct from old.ajuste_motivo then
    raise exception 'El descuento o el plus de una orden se cambian editando la orden';
  end if;
  if new.estado is distinct from old.estado and new.estado in ('entregada', 'anulada') then
    raise exception 'El estado "%" no se cambia a mano: se pone al emitir el remito o al anular', new.estado;
  end if;
  if old.estado = 'entregada' and new.estado is distinct from old.estado then
    raise exception 'La orden ya se entregó en un remito: primero hay que corregir el remito';
  end if;
  return new;
end;
$fn$;

-- ------------------------------------------------------------------- el ajuste
-- Un solo lugar donde se resuelve cuánta plata es el ajuste. El signo lo trae el
-- valor: negativo es descuento, positivo es un plus.

create or replace function public.ajuste_de_orden(
  p_base  numeric,
  p_tipo  text,
  p_valor numeric
)
returns numeric
language plpgsql
immutable
as $fn$
begin
  if p_valor is null or p_valor = 0 then
    return 0;
  end if;

  if p_tipo = 'porcentaje' then
    if abs(p_valor) > 100 then
      raise exception 'El porcentaje del ajuste tiene que estar entre -100 y 100';
    end if;
    return round(p_base * p_valor / 100, 2);
  end if;

  if p_tipo = 'monto' then
    return round(p_valor, 2);
  end if;

  raise exception 'El tipo de ajuste tiene que ser "porcentaje" o "monto", no "%"', p_tipo;
end;
$fn$;

-- ----------------------------------------------------------------- crear_orden
-- El precio sale del catálogo, siempre. Lo que se acuerda va en el ajuste.

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
  p_entrega_at     timestamptz default null,
  p_ajuste_tipo    text        default null,
  p_ajuste_valor   numeric     default 0,
  p_ajuste_motivo  text        default null
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
  v_item      jsonb;
  v_trabajo   bigint;
  v_cantidad  smallint;
  v_precio    numeric(12,2);
  v_total     numeric(12,2) := 0;
  v_ajuste    numeric(12,2);
  v_posicion  smallint := 0;
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

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_posicion := v_posicion + 1;
    v_trabajo  := (v_item ->> 'trabajo_id')::bigint;
    v_cantidad := coalesce((v_item ->> 'cantidad')::smallint, 1);

    if v_cantidad < 1 then
      raise exception 'La cantidad del trabajo % tiene que ser mayor que cero', v_trabajo;
    end if;

    select p.precio
      into v_precio
      from public.precios_trabajo p
     where p.trabajo_id = v_trabajo
       and p.vigente_desde <= v_fecha
     order by p.vigente_desde desc
     limit 1;

    if v_precio is null then
      raise exception 'El trabajo % no tiene precio vigente al %', v_trabajo, v_fecha;
    end if;

    insert into public.orden_items (
      orden_id, trabajo_id, cantidad, piezas, precio_unitario, posicion
    ) values (
      v_orden_id, v_trabajo, v_cantidad, nullif(btrim(coalesce(v_item ->> 'piezas', '')), ''),
      v_precio, v_posicion
    );

    v_total := v_total + v_precio * v_cantidad;
  end loop;

  v_ajuste := public.ajuste_de_orden(v_total, p_ajuste_tipo, p_ajuste_valor);

  if v_ajuste <> 0 and coalesce(btrim(p_ajuste_motivo), '') = '' then
    raise exception 'Un descuento o un plus necesita un motivo';
  end if;
  if v_total + v_ajuste < 0 then
    raise exception 'El descuento no puede ser mayor que el total de la orden';
  end if;

  update public.ordenes
     set total         = v_total + v_ajuste,
         ajuste        = v_ajuste,
         ajuste_pct    = case when p_ajuste_tipo = 'porcentaje' and v_ajuste <> 0
                              then p_ajuste_valor end,
         ajuste_motivo = case when v_ajuste <> 0 then btrim(p_ajuste_motivo) end
   where id = v_orden_id;

  return json_build_object(
    'id', v_orden_id, 'numero', v_numero, 'total', v_total + v_ajuste, 'ajuste', v_ajuste);
end;
$fn$;

-- ---------------------------------------------------------------- editar_orden

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
  p_entrega_at     timestamptz default null,
  p_ajuste_tipo    text        default null,
  p_ajuste_valor   numeric     default 0,
  p_ajuste_motivo  text        default null
)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_orden     record;
  v_item      jsonb;
  v_trabajo   bigint;
  v_cantidad  smallint;
  v_precio    numeric(12,2);
  v_total     numeric(12,2) := 0;
  v_ajuste    numeric(12,2);
  v_posicion  smallint := 0;
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

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_posicion := v_posicion + 1;
    v_trabajo  := (v_item ->> 'trabajo_id')::bigint;
    v_cantidad := coalesce((v_item ->> 'cantidad')::smallint, 1);

    if v_cantidad < 1 then
      raise exception 'La cantidad del trabajo % tiene que ser mayor que cero', v_trabajo;
    end if;

    -- El precio del día en que se cargó la orden, no el de hoy.
    select p.precio
      into v_precio
      from public.precios_trabajo p
     where p.trabajo_id = v_trabajo
       and p.vigente_desde <= v_orden.fecha
     order by p.vigente_desde desc
     limit 1;

    if v_precio is null then
      raise exception 'El trabajo % no tiene precio vigente al %', v_trabajo, v_orden.fecha;
    end if;

    insert into public.orden_items (orden_id, trabajo_id, cantidad, piezas, precio_unitario, posicion)
    values (p_orden_id, v_trabajo, v_cantidad,
            nullif(btrim(coalesce(v_item ->> 'piezas', '')), ''), v_precio, v_posicion);

    v_total := v_total + v_precio * v_cantidad;
  end loop;

  v_ajuste := public.ajuste_de_orden(v_total, p_ajuste_tipo, p_ajuste_valor);

  if v_ajuste <> 0 and coalesce(btrim(p_ajuste_motivo), '') = '' then
    raise exception 'Un descuento o un plus necesita un motivo';
  end if;
  if v_total + v_ajuste < 0 then
    raise exception 'El descuento no puede ser mayor que el total de la orden';
  end if;

  update public.ordenes
     set paciente       = btrim(p_paciente),
         sexo           = p_sexo,
         edad           = p_edad,
         obra_social_id = p_obra_social_id,
         color          = p_color,
         indicaciones   = p_indicaciones,
         entrega_at     = p_entrega_at,
         total          = v_total + v_ajuste,
         ajuste         = v_ajuste,
         ajuste_pct     = case when p_ajuste_tipo = 'porcentaje' and v_ajuste <> 0
                               then p_ajuste_valor end,
         ajuste_motivo  = case when v_ajuste <> 0 then btrim(p_ajuste_motivo) end
   where id = p_orden_id;

  return json_build_object(
    'id', p_orden_id, 'numero', v_orden.numero, 'total', v_total + v_ajuste, 'ajuste', v_ajuste);
end;
$fn$;

-- -------------------------------------------------------------------- permisos

revoke execute on function public.ajuste_de_orden(numeric, text, numeric) from public;

revoke execute on function public.crear_orden(
  bigint, text, jsonb, text, smallint, bigint, text, text, date, timestamptz,
  text, numeric, text) from public;
revoke execute on function public.editar_orden(
  bigint, text, jsonb, text, smallint, bigint, text, text, timestamptz,
  text, numeric, text) from public;

grant execute on function public.crear_orden(
  bigint, text, jsonb, text, smallint, bigint, text, text, date, timestamptz,
  text, numeric, text) to authenticated;
grant execute on function public.editar_orden(
  bigint, text, jsonb, text, smallint, bigint, text, text, timestamptz,
  text, numeric, text) to authenticated;
