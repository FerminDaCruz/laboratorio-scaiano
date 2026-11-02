-- E14 · Todo junto, para pegar en el editor SQL de Supabase.
--
-- Esto NO es una migración: es la suma de las dos migraciones de E14
--
--   supabase/migrations/20261019090000_ajustes_y_correcciones.sql
--   supabase/migrations/20261020090000_ajuste_en_la_orden.sql
--
-- escrita para poder correrse de nuevo sin romper nada. Está acá porque la 19 usa
-- `add column` sin `if not exists`: si ya la habías corrido, volver a pegarla falla
-- y deja la 20 sin aplicar. Este archivo evita tener que acordarse de cuál ya corriste.
--
-- CÓMO SE USA
--   1. Supabase → SQL Editor → pegar todo → Run. Es una sola transacción implícita
--      por statement, pero todo es idempotente: si algo ya existía, no pasa nada.
--   2. Al final imprime una tabla de control. Las ocho filas tienen que decir "ok".
--   3. Después: redeploy en Cloudflare Pages.
--
-- Si en algún momento corrés `supabase db push`, el último bloque ya dejó las dos
-- migraciones marcadas como aplicadas, así que la CLI no va a intentar repetirlas.

-- ============================================================ 1. columnas nuevas

alter table public.ordenes
  add column if not exists motivo_anulacion text,
  add column if not exists ajuste        numeric(12,2) not null default 0,
  add column if not exists ajuste_pct    numeric(6,2),
  add column if not exists ajuste_motivo text;

alter table public.remitos
  add column if not exists ajuste        numeric(12,2) not null default 0,
  add column if not exists ajuste_motivo text;

comment on column public.ordenes.ajuste is
  'Descuento (negativo) o plus (positivo) sobre la suma de los ítems. El total ya lo incluye.';
comment on column public.ordenes.ajuste_pct is
  'El porcentaje acordado, cuando el ajuste se pactó así. Null si fue un monto fijo.';
comment on column public.remitos.ajuste is
  'Descuento (negativo) o recargo (positivo) aplicado al emitir. El total ya lo incluye.';

-- ======================================================== 2. campos inmutables
-- "entregada" la pone emitir_remito y "anulada" la pone anular_orden: desde la
-- pantalla solo se mueve el circuito de producción. El ajuste mueve el total, así
-- que tampoco se toca a mano: lo escriben crear_orden y editar_orden.

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

-- ============================================================== 3. el ajuste
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

-- ============================================================= 4. crear_orden
-- El precio sale del catálogo, siempre, con la fecha de la orden. Lo que se acuerda
-- de más o de menos va en el ajuste. Se borra la versión de 10 argumentos para que
-- no queden dos sobrecargas: PostgREST no sabría cuál llamar.

drop function if exists public.crear_orden(
  bigint, text, jsonb, text, smallint, bigint, text, text, date, timestamptz);

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

-- ============================================================ 5. editar_orden
-- Cambia trabajos, cantidades, piezas, datos y ajuste mientras la orden no esté
-- facturada. Igual que arriba, se borra la versión vieja de 9 argumentos.

drop function if exists public.editar_orden(
  bigint, text, jsonb, text, smallint, bigint, text, text, timestamptz);

create or replace function public.editar_orden(
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

-- ============================================================ 6. anular_orden
-- Solo un administrador, y solo si la orden no entró en un remito.

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

-- =========================================================== 7. emitir_remito
-- Ahora acepta un descuento o un recargo propio del remito, con motivo. Se borra la
-- versión de 3 argumentos por la misma razón que arriba.

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

-- ================================================================ 8. permisos

revoke execute on function public.ajuste_de_orden(numeric, text, numeric) from public;
revoke execute on function public.anular_orden(bigint, text) from public;
revoke execute on function public.emitir_remito(bigint, bigint[], date, numeric, text) from public;
revoke execute on function public.crear_orden(
  bigint, text, jsonb, text, smallint, bigint, text, text, date, timestamptz,
  text, numeric, text) from public;
revoke execute on function public.editar_orden(
  bigint, text, jsonb, text, smallint, bigint, text, text, timestamptz,
  text, numeric, text) from public;

grant execute on function public.anular_orden(bigint, text) to authenticated;
grant execute on function public.emitir_remito(bigint, bigint[], date, numeric, text) to authenticated;
grant execute on function public.crear_orden(
  bigint, text, jsonb, text, smallint, bigint, text, text, date, timestamptz,
  text, numeric, text) to authenticated;
grant execute on function public.editar_orden(
  bigint, text, jsonb, text, smallint, bigint, text, text, timestamptz,
  text, numeric, text) to authenticated;

-- ============================================== 9. que la API vea lo nuevo
-- Sin esto PostgREST sigue con el esquema viejo en caché y la app recibe
-- "function not found" aunque la función ya exista.

notify pgrst, 'reload schema';

-- =============================== 10. marcar las dos migraciones como aplicadas
-- Para que un `supabase db push` futuro no intente correrlas de nuevo. Si el
-- proyecto nunca se tocó con la CLI, la tabla no existe y el bloque no hace nada.

do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    insert into supabase_migrations.schema_migrations (version)
    values ('20261019090000'), ('20261020090000')
    on conflict (version) do nothing;
  end if;
end;
$$;

-- ================================================================ 11. control
-- Las ocho filas tienen que decir "ok". Si alguna dice "FALTA", algo no se aplicó.

select
  control,
  case when cumple then 'ok' else 'FALTA' end as estado
from (
  values
    ('ordenes.motivo_anulacion',
     to_regclass('public.ordenes') is not null
       and exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'ordenes'
                      and column_name = 'motivo_anulacion')),
    ('ordenes.ajuste / ajuste_pct / ajuste_motivo',
     (select count(*) = 3 from information_schema.columns
       where table_schema = 'public' and table_name = 'ordenes'
         and column_name in ('ajuste', 'ajuste_pct', 'ajuste_motivo'))),
    ('remitos.ajuste / ajuste_motivo',
     (select count(*) = 2 from information_schema.columns
       where table_schema = 'public' and table_name = 'remitos'
         and column_name in ('ajuste', 'ajuste_motivo'))),
    ('crear_orden con 13 argumentos, sin sobrecargas',
     (select count(*) = 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'crear_orden' and p.pronargs = 13)
       and (select count(*) = 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'crear_orden')),
    ('editar_orden con 12 argumentos, sin sobrecargas',
     (select count(*) = 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'editar_orden' and p.pronargs = 12)
       and (select count(*) = 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'editar_orden')),
    ('emitir_remito con 5 argumentos, sin sobrecargas',
     (select count(*) = 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'emitir_remito' and p.pronargs = 5)
       and (select count(*) = 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'emitir_remito')),
    ('anular_orden',
     (select count(*) = 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'anular_orden')),
    ('ajuste_de_orden',
     (select count(*) = 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'ajuste_de_orden'))
) as t(control, cumple);
