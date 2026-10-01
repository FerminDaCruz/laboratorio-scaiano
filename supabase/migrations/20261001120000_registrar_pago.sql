-- E9 · registrar_pago: asiento del pago e imputación a las deudas.
-- La imputación va del remito más viejo al más nuevo (FIFO), salvo que se
-- indiquen deudas a mano.

create or replace function public.registrar_pago(
  p_doctor_id  bigint,
  p_importe    numeric,
  p_fecha      date default null,
  p_medio      text default 'efectivo',
  p_referencia text default null,
  p_deuda_ids  bigint[] default null
)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_fecha     date := coalesce(p_fecha, current_date);
  v_pago      bigint;
  v_restante  numeric(12,2);
  v_aplicado  numeric(12,2);
  v_imputado  numeric(12,2) := 0;
  v_deuda     record;
begin
  if not public.es_staff() then
    raise exception 'No tenés permiso para registrar pagos' using errcode = '42501';
  end if;

  if p_importe is null or p_importe <= 0 then
    raise exception 'El importe del pago tiene que ser mayor que cero';
  end if;

  insert into public.movimientos_cc (doctor_id, fecha, tipo, importe, medio, referencia, creado_por)
  values (p_doctor_id, v_fecha, 'pago', -p_importe, coalesce(p_medio, 'efectivo'),
          nullif(btrim(coalesce(p_referencia, '')), ''), auth.uid())
  returning id into v_pago;

  v_restante := p_importe;

  for v_deuda in
    select d.*
      from public.v_deudas_pendientes d
     where d.doctor_id = p_doctor_id
       and (p_deuda_ids is null or d.id = any(p_deuda_ids))
     order by case when p_deuda_ids is null then 0 else array_position(p_deuda_ids, d.id) end,
              d.fecha, d.id
  loop
    exit when v_restante <= 0;
    v_aplicado := least(v_restante, v_deuda.pendiente);

    insert into public.imputaciones (movimiento_debe_id, movimiento_haber_id, importe)
    values (v_deuda.id, v_pago, v_aplicado)
    on conflict (movimiento_debe_id, movimiento_haber_id)
    do update set importe = public.imputaciones.importe + excluded.importe;

    v_restante := v_restante - v_aplicado;
    v_imputado := v_imputado + v_aplicado;
  end loop;

  -- Lo que sobra queda como saldo a favor y se imputa solo al próximo remito.
  return json_build_object(
    'id', v_pago,
    'importe', p_importe,
    'imputado', v_imputado,
    'a_favor', v_restante
  );
end;
$fn$;

revoke execute on function public.registrar_pago(bigint, numeric, date, text, text, bigint[]) from public;
grant execute on function public.registrar_pago(bigint, numeric, date, text, text, bigint[]) to authenticated;

/** Antigüedad de la deuda por doctor: 0-30, 31-60, 61-90 y más de 90 días. */
create view public.v_antiguedad_deuda
with (security_invoker = on) as
select d.doctor_id,
       sum(case when current_date - d.fecha <= 30 then d.pendiente else 0 end)::numeric(12,2) as dias_0_30,
       sum(case when current_date - d.fecha between 31 and 60 then d.pendiente else 0 end)::numeric(12,2) as dias_31_60,
       sum(case when current_date - d.fecha between 61 and 90 then d.pendiente else 0 end)::numeric(12,2) as dias_61_90,
       sum(case when current_date - d.fecha > 90 then d.pendiente else 0 end)::numeric(12,2) as dias_mas_90,
       sum(d.pendiente)::numeric(12,2) as total,
       max(current_date - d.fecha) as dias_mas_viejo
  from public.v_deudas_pendientes d
 group by d.doctor_id;

grant select on public.v_antiguedad_deuda to authenticated;
