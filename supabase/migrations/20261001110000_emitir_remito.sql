-- E8 · emitir_remito y anular_remito.
-- Todo lo que mueve plata pasa por acá, en una sola transacción.

-- Saldo de cada doctor: positivo = debe, negativo = saldo a favor.
create view public.v_saldos_doctor
with (security_invoker = on) as
select d.id as doctor_id,
       coalesce(sum(m.importe), 0)::numeric(12,2) as saldo
  from public.doctores d
  left join public.movimientos_cc m on m.doctor_id = d.id
 group by d.id;

-- Deudas con saldo sin cubrir (remitos impagos).
create view public.v_deudas_pendientes
with (security_invoker = on) as
select m.id,
       m.doctor_id,
       m.fecha,
       m.tipo,
       m.remito_id,
       m.importe,
       (m.importe - coalesce(sum(i.importe), 0))::numeric(12,2) as pendiente
  from public.movimientos_cc m
  left join public.imputaciones i on i.movimiento_debe_id = m.id
 where m.importe > 0
 group by m.id
having m.importe - coalesce(sum(i.importe), 0) > 0;

-- Pagos y créditos que todavía no se aplicaron a ninguna deuda.
create view public.v_creditos_disponibles
with (security_invoker = on) as
select m.id,
       m.doctor_id,
       m.fecha,
       m.tipo,
       m.importe,
       (-m.importe - coalesce(sum(i.importe), 0))::numeric(12,2) as disponible
  from public.movimientos_cc m
  left join public.imputaciones i on i.movimiento_haber_id = m.id
 where m.importe < 0
 group by m.id
having -m.importe - coalesce(sum(i.importe), 0) > 0;

grant select on public.v_saldos_doctor, public.v_deudas_pendientes, public.v_creditos_disponibles
  to authenticated;

/**
 * Imputa los créditos disponibles de un doctor contra una deuda, del más viejo
 * al más nuevo (FIFO). Devuelve cuánto se alcanzó a imputar.
 */
create or replace function public.imputar_credito_a_deuda(
  p_doctor_id bigint,
  p_deuda_id  bigint
)
returns numeric
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_pendiente numeric(12,2);
  v_credito   record;
  v_aplicado  numeric(12,2);
  v_total     numeric(12,2) := 0;
begin
  select pendiente into v_pendiente from public.v_deudas_pendientes where id = p_deuda_id;
  if v_pendiente is null then
    return 0;
  end if;

  for v_credito in
    select * from public.v_creditos_disponibles
     where doctor_id = p_doctor_id
     order by fecha, id
  loop
    exit when v_pendiente <= 0;
    v_aplicado := least(v_pendiente, v_credito.disponible);

    insert into public.imputaciones (movimiento_debe_id, movimiento_haber_id, importe)
    values (p_deuda_id, v_credito.id, v_aplicado)
    on conflict (movimiento_debe_id, movimiento_haber_id)
    do update set importe = public.imputaciones.importe + excluded.importe;

    v_pendiente := v_pendiente - v_aplicado;
    v_total := v_total + v_aplicado;
  end loop;

  return v_total;
end;
$fn$;

/**
 * Remito + líneas + asiento contable + OT entregadas + imputación del saldo a
 * favor, todo junto. Si algo falla, no queda nada a medias.
 */
create or replace function public.emitir_remito(
  p_doctor_id bigint,
  p_orden_ids bigint[],
  p_fecha     date default null
)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_fecha      date := coalesce(p_fecha, current_date);
  v_numero     integer;
  v_remito_id  bigint;
  v_total      numeric(12,2);
  v_cantidad   integer;
  v_movimiento bigint;
  v_imputado   numeric(12,2);
begin
  if not public.es_staff() then
    raise exception 'No tenés permiso para emitir remitos' using errcode = '42501';
  end if;

  if p_orden_ids is null or array_length(p_orden_ids, 1) is null then
    raise exception 'El remito necesita al menos una orden';
  end if;

  -- Todas las órdenes tienen que ser del mismo doctor y estar sin remitir.
  select count(*), coalesce(sum(total), 0)
    into v_cantidad, v_total
    from public.ordenes
   where id = any(p_orden_ids)
     and doctor_id = p_doctor_id
     and remito_id is null
     and estado not in ('entregada', 'anulada');

  if v_cantidad <> array_length(p_orden_ids, 1) then
    raise exception 'Hay órdenes de otro doctor, ya remitidas o anuladas en la bandeja';
  end if;

  v_numero := nextval('public.remitos_numero_seq');

  insert into public.remitos (numero, doctor_id, fecha, total, creado_por)
  values (v_numero, p_doctor_id, v_fecha, v_total, auth.uid())
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
    'ordenes', v_cantidad,
    'imputado', v_imputado
  );
end;
$fn$;

/**
 * Anula un remito con un contra-asiento. No borra ni edita el asiento original:
 * el libro mayor es append-only.
 */
create or replace function public.anular_remito(
  p_remito_id bigint,
  p_motivo    text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_remito     record;
  v_movimiento record;
  v_contra     bigint;
begin
  if not public.es_staff() then
    raise exception 'No tenés permiso para anular remitos' using errcode = '42501';
  end if;

  select * into v_remito from public.remitos where id = p_remito_id;
  if v_remito is null then
    raise exception 'No existe ese remito';
  end if;
  if v_remito.anulado_en is not null then
    raise exception 'El remito % ya estaba anulado', v_remito.numero;
  end if;

  select * into v_movimiento
    from public.movimientos_cc
   where remito_id = p_remito_id and tipo = 'remito'
   order by id
   limit 1;

  -- Contra-asiento por el mismo importe, con signo invertido.
  insert into public.movimientos_cc (
    doctor_id, fecha, tipo, importe, remito_id, referencia, anula_movimiento_id, creado_por
  ) values (
    v_remito.doctor_id, current_date, 'nota_credito', -v_remito.total, p_remito_id,
    coalesce(nullif(btrim(p_motivo), ''), 'Anulación del remito ' || lpad(v_remito.numero::text, 6, '0')),
    v_movimiento.id, auth.uid()
  )
  returning id into v_contra;

  -- Las imputaciones contra la deuda anulada se deshacen: los pagos vuelven a
  -- quedar disponibles. Los asientos, en cambio, quedan los dos.
  delete from public.imputaciones where movimiento_debe_id = v_movimiento.id;

  update public.remitos
     set anulado_en = now(), anulado_por = auth.uid()
   where id = p_remito_id;

  -- Las órdenes vuelven a estar listas para entregar.
  update public.ordenes
     set estado = 'terminada', remito_id = null
   where remito_id = p_remito_id;

  return json_build_object('id', p_remito_id, 'numero', v_remito.numero, 'contra_asiento', v_contra);
end;
$fn$;

revoke execute on function public.imputar_credito_a_deuda(bigint, bigint) from public;
revoke execute on function public.emitir_remito(bigint, bigint[], date) from public;
revoke execute on function public.anular_remito(bigint, text) from public;
grant execute on function public.emitir_remito(bigint, bigint[], date) to authenticated;
grant execute on function public.anular_remito(bigint, text) to authenticated;
