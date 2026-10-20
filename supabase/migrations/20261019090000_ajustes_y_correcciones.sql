-- E14 · Ajustes de precio y correcciones.
--
-- Tres cosas que pidió el laboratorio después de probar el sistema:
--   1. Poder cambiar los trabajos y los precios de una orden que todavía no se facturó.
--   2. Poder hacer un descuento o cobrar un plus al emitir el remito.
--   3. Poder anular una orden (solo un administrador).
--
-- Lo que no cambia: el libro mayor sigue siendo append-only. Corregir un remito
-- ya emitido es anularlo (contra-asiento) y volver a emitirlo, no editarlo.

alter table public.ordenes add column motivo_anulacion text;

alter table public.remitos
  add column ajuste        numeric(12,2) not null default 0,
  add column ajuste_motivo text;

comment on column public.remitos.ajuste is
  'Descuento (negativo) o recargo (positivo) aplicado al emitir. El total ya lo incluye.';

-- --------------------------------------------------------------- estados
-- "entregada" la pone emitir_remito y "anulada" la pone anular_orden: desde la
-- pantalla solo se mueve el circuito de producción.
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
  if new.estado is distinct from old.estado and new.estado in ('entregada', 'anulada') then
    raise exception 'El estado "%" no se cambia a mano: se pone al emitir el remito o al anular', new.estado;
  end if;
  if old.estado = 'entregada' and new.estado is distinct from old.estado then
    raise exception 'La orden ya se entregó en un remito: primero hay que corregir el remito';
  end if;
  return new;
end;
$fn$;

/**
 * Cambia los trabajos y los datos de una orden que todavía no se facturó.
 * Si el ítem trae precio, se respeta (es el descuento o el plus que acordó el
 * laboratorio); si no, se vuelve a leer el precio vigente del catálogo.
 */
create or replace function public.editar_orden(
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
  v_orden     record;
  v_item      jsonb;
  v_trabajo   bigint;
  v_cantidad  smallint;
  v_precio    numeric(12,2);
  v_total     numeric(12,2) := 0;
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

    -- Precio acordado a mano, o el vigente del catálogo a la fecha de la orden.
    v_precio := nullif(v_item ->> 'precio', '')::numeric(12,2);
    if v_precio is null then
      select p.precio
        into v_precio
        from public.precios_trabajo p
       where p.trabajo_id = v_trabajo
         and p.vigente_desde <= v_orden.fecha
       order by p.vigente_desde desc
       limit 1;
    end if;

    if v_precio is null then
      raise exception 'El trabajo % no tiene precio vigente al %', v_trabajo, v_orden.fecha;
    end if;
    if v_precio < 0 then
      raise exception 'El precio no puede ser negativo';
    end if;

    insert into public.orden_items (orden_id, trabajo_id, cantidad, piezas, precio_unitario, posicion)
    values (p_orden_id, v_trabajo, v_cantidad,
            nullif(btrim(coalesce(v_item ->> 'piezas', '')), ''), v_precio, v_posicion);

    v_total := v_total + v_precio * v_cantidad;
  end loop;

  update public.ordenes
     set paciente       = btrim(p_paciente),
         sexo           = p_sexo,
         edad           = p_edad,
         obra_social_id = p_obra_social_id,
         color          = p_color,
         indicaciones   = p_indicaciones,
         entrega_at     = p_entrega_at,
         total          = v_total
   where id = p_orden_id;

  return json_build_object('id', p_orden_id, 'numero', v_orden.numero, 'total', v_total);
end;
$fn$;

/** Anula una orden que todavía no se facturó. Solo un administrador. */
create or replace function public.anular_orden(
  p_orden_id bigint,
  p_motivo   text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_orden record;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede anular una orden' using errcode = '42501';
  end if;

  select * into v_orden from public.ordenes where id = p_orden_id for update;
  if v_orden is null then
    raise exception 'No existe esa orden';
  end if;
  if v_orden.estado = 'anulada' then
    raise exception 'La orden % ya estaba anulada', v_orden.numero;
  end if;
  if v_orden.remito_id is not null then
    raise exception 'La orden está en un remito emitido: primero hay que corregir el remito';
  end if;

  update public.ordenes
     set estado = 'anulada',
         motivo_anulacion = nullif(btrim(coalesce(p_motivo, '')), '')
   where id = p_orden_id;

  return json_build_object('id', p_orden_id, 'numero', v_orden.numero);
end;
$fn$;

-- ---------------------------------------------- remito con descuento o plus
-- Cambia la firma, así que se reemplaza la versión anterior.
drop function if exists public.emitir_remito(bigint, bigint[], date);

create or replace function public.emitir_remito(
  p_doctor_id     bigint,
  p_orden_ids     bigint[],
  p_fecha         date    default null,
  p_ajuste        numeric default 0,
  p_ajuste_motivo text    default null
)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_fecha       date := coalesce(p_fecha, current_date);
  v_ajuste      numeric(12,2) := coalesce(p_ajuste, 0);
  v_numero      integer;
  v_remito_id   bigint;
  v_trabajos    numeric(12,2);
  v_total       numeric(12,2);
  v_cantidad    integer;
  v_movimiento  bigint;
  v_imputado    numeric(12,2);
begin
  if not public.es_staff() then
    raise exception 'No tenés permiso para emitir remitos' using errcode = '42501';
  end if;

  if p_orden_ids is null or array_length(p_orden_ids, 1) is null then
    raise exception 'El remito necesita al menos una orden';
  end if;

  -- Todas las órdenes tienen que ser del mismo doctor y estar sin remitir.
  select count(*), coalesce(sum(total), 0)
    into v_cantidad, v_trabajos
    from public.ordenes
   where id = any(p_orden_ids)
     and doctor_id = p_doctor_id
     and remito_id is null
     and estado not in ('entregada', 'anulada');

  if v_cantidad <> array_length(p_orden_ids, 1) then
    raise exception 'Hay órdenes de otro doctor, ya remitidas o anuladas en la bandeja';
  end if;

  v_total := v_trabajos + v_ajuste;
  if v_total < 0 then
    raise exception 'El descuento no puede ser mayor que el total del remito';
  end if;
  if v_ajuste <> 0 and coalesce(btrim(coalesce(p_ajuste_motivo, '')), '') = '' then
    raise exception 'Un descuento o un recargo necesita un motivo';
  end if;

  v_numero := nextval('public.remitos_numero_seq');

  insert into public.remitos (numero, doctor_id, fecha, total, ajuste, ajuste_motivo, creado_por)
  values (v_numero, p_doctor_id, v_fecha, v_total, v_ajuste,
          nullif(btrim(coalesce(p_ajuste_motivo, '')), ''), auth.uid())
  returning id into v_remito_id;

  insert into public.remito_lineas (remito_id, orden_id, importe)
  select v_remito_id, o.id, o.total
    from public.ordenes o
   where o.id = any(p_orden_ids);

  update public.ordenes
     set estado = 'entregada',
         remito_id = v_remito_id
   where id = any(p_orden_ids);

  insert into public.movimientos_cc (doctor_id, fecha, tipo, importe, remito_id, referencia, creado_por)
  values (p_doctor_id, v_fecha, 'remito', v_total, v_remito_id,
          'Remito ' || lpad(v_numero::text, 6, '0'), auth.uid())
  returning id into v_movimiento;

  -- Si el doctor tenía saldo a favor, se aplica solo.
  v_imputado := public.imputar_credito_a_deuda(p_doctor_id, v_movimiento);

  return json_build_object(
    'id', v_remito_id,
    'numero', v_numero,
    'total', v_total,
    'trabajos', v_trabajos,
    'ajuste', v_ajuste,
    'ordenes', v_cantidad,
    'imputado', v_imputado
  );
end;
$fn$;

revoke execute on function public.editar_orden(
  bigint, text, jsonb, text, smallint, bigint, text, text, timestamptz
) from public;
revoke execute on function public.anular_orden(bigint, text) from public;
revoke execute on function public.emitir_remito(bigint, bigint[], date, numeric, text) from public;

grant execute on function public.editar_orden(
  bigint, text, jsonb, text, smallint, bigint, text, text, timestamptz
) to authenticated;
grant execute on function public.anular_orden(bigint, text) to authenticated;
grant execute on function public.emitir_remito(bigint, bigint[], date, numeric, text) to authenticated;

-- ------------------------------------------- precio acordado al cargar la orden
-- El catálogo sigue siendo el valor por defecto: si el ítem no trae precio, se
-- lee de `precios_trabajo` como antes. Si lo trae, es un precio acordado a
-- propósito (un descuento o un plus) y se congela ese.
create or replace function public.crear_orden(
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
  v_fecha     date := coalesce(p_fecha, current_date);
  v_orden_id  bigint;
  v_numero    integer;
  v_item      jsonb;
  v_trabajo   bigint;
  v_cantidad  smallint;
  v_precio    numeric(12,2);
  v_total     numeric(12,2) := 0;
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

    v_precio := nullif(v_item ->> 'precio', '')::numeric(12,2);
    if v_precio is null then
      select p.precio
        into v_precio
        from public.precios_trabajo p
       where p.trabajo_id = v_trabajo
         and p.vigente_desde <= v_fecha
       order by p.vigente_desde desc
       limit 1;
    end if;

    if v_precio is null then
      raise exception 'El trabajo % no tiene precio vigente al %', v_trabajo, v_fecha;
    end if;
    if v_precio < 0 then
      raise exception 'El precio no puede ser negativo';
    end if;

    insert into public.orden_items (
      orden_id, trabajo_id, cantidad, piezas, precio_unitario, posicion
    ) values (
      v_orden_id, v_trabajo, v_cantidad, nullif(btrim(coalesce(v_item ->> 'piezas', '')), ''),
      v_precio, v_posicion
    );

    v_total := v_total + v_precio * v_cantidad;
  end loop;

  update public.ordenes set total = v_total where id = v_orden_id;

  return json_build_object('id', v_orden_id, 'numero', v_numero, 'total', v_total);
end;
$fn$;
