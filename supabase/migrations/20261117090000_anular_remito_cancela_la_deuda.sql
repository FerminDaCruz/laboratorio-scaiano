-- La antigüedad de la deuda no coincidía con el saldo después de anular un remito.
--
-- anular_remito creaba el contra-asiento (nota de crédito por -total) pero no lo
-- imputaba contra el asiento del remito anulado. Resultado:
--   * el saldo (suma de asientos) daba bien: remito + contra-asiento = 0
--   * v_deudas_pendientes seguía mostrando el remito anulado como deuda impaga, y la
--     antigüedad (0-30, 31-60…) lo contaba
--   * la nota de crédito quedaba suelta como "crédito disponible" y se imputaba sola
--     al próximo remito del doctor, que aparecía como pagado sin estarlo
--   * los pagos que estaban aplicados al remito anulado se liberaban, pero no se
--     volvían a aplicar a las otras deudas hasta el próximo remito o pago
--
-- Ahora, al anular:
--   1. se deshacen las imputaciones contra el remito anulado (igual que antes)
--   2. el contra-asiento se imputa contra el asiento del remito: esa deuda queda cancelada
--   3. los créditos que quedaron libres se aplican a las deudas pendientes del doctor,
--      de la más vieja a la más nueva
--
-- No se edita ni se borra ningún asiento: solo cambian las imputaciones.
-- Se puede volver a correr: es un create or replace.

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
  v_deuda      record;
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

  -- Los pagos aplicados al remito anulado vuelven a quedar disponibles.
  delete from public.imputaciones where movimiento_debe_id = v_movimiento.id;

  -- El contra-asiento cancela la deuda del remito anulado: deja de figurar como
  -- pendiente y no queda como crédito suelto para el próximo remito.
  insert into public.imputaciones (movimiento_debe_id, movimiento_haber_id, importe)
  values (v_movimiento.id, v_contra, v_movimiento.importe);

  -- Los pagos que se liberaron se aplican a las demás deudas, de la más vieja a la
  -- más nueva. Si no hay deudas, quedan como saldo a favor.
  for v_deuda in
    select id from public.v_deudas_pendientes
     where doctor_id = v_remito.doctor_id
     order by fecha, id
  loop
    exit when not exists (
      select 1 from public.v_creditos_disponibles where doctor_id = v_remito.doctor_id
    );
    perform public.imputar_credito_a_deuda(v_remito.doctor_id, v_deuda.id);
  end loop;

  update public.remitos
     set anulado_en = now(), anulado_por = auth.uid()
   where id = p_remito_id;

  -- Las órdenes vuelven a estar disponibles para facturar.
  update public.ordenes
     set estado = 'ingresada', remito_id = null
   where remito_id = p_remito_id;

  return json_build_object('id', p_remito_id, 'numero', v_remito.numero, 'contra_asiento', v_contra);
end;
$fn$;

revoke execute on function public.anular_remito(bigint, text) from public;
grant execute on function public.anular_remito(bigint, text) to authenticated;
