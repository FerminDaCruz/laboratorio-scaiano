-- E9 · Pagos en dólares.
--
-- Al doctor siempre se le cobra en pesos, pero algunos pagan con dólares. El pago se
-- registra en pesos (es lo que baja de la deuda) y queda anotado que se pagó en dólares.
-- La cotización a la que se tomó el dólar va en la referencia del pago, que en ese caso es
-- obligatoria.
--
-- Agregar la columna no toca ningún asiento: los que ya existen quedan en "pesos" por el
-- valor por defecto.

alter table public.movimientos_cc
  add column moneda text not null default 'pesos'
    check (moneda in ('pesos', 'dolares'));

-- Solo un pago puede haberse hecho en dólares: un remito o un ajuste siempre son en pesos.
alter table public.movimientos_cc
  add constraint movimientos_cc_moneda_solo_pagos
    check (moneda = 'pesos' or tipo = 'pago');

comment on column public.movimientos_cc.moneda is
  'Con qué pagó el doctor. El importe siempre está en pesos; si pagó en dólares, la referencia dice a cuánto se tomó el dólar.';

drop function if exists public.registrar_pago(bigint, numeric, date, text, text, bigint[]);

create function public.registrar_pago(
  p_doctor_id  bigint,
  p_importe    numeric,
  p_fecha      date default null,
  p_medio      text default 'efectivo',
  p_referencia text default null,
  p_deuda_ids  bigint[] default null,
  p_moneda     text default 'pesos'
)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_fecha       date := coalesce(p_fecha, current_date);
  v_moneda      text := coalesce(p_moneda, 'pesos');
  v_referencia  text := nullif(btrim(coalesce(p_referencia, '')), '');
  v_pago        bigint;
  v_restante    numeric(12,2);
  v_aplicado    numeric(12,2);
  v_imputado    numeric(12,2) := 0;
  v_deuda       record;
begin
  if not public.es_staff() then
    raise exception 'No tenés permiso para registrar pagos' using errcode = '42501';
  end if;

  if p_importe is null or p_importe <= 0 then
    raise exception 'El importe del pago tiene que ser mayor que cero';
  end if;

  if v_moneda not in ('pesos', 'dolares') then
    raise exception 'La moneda tiene que ser "pesos" o "dolares", no "%"', v_moneda;
  end if;

  if v_moneda = 'dolares' and v_referencia is null then
    raise exception 'Un pago en dólares necesita la cotización a la que se tomó el dólar';
  end if;

  insert into public.movimientos_cc (doctor_id, fecha, tipo, importe, medio, referencia, moneda, creado_por)
  values (p_doctor_id, v_fecha, 'pago', -p_importe, coalesce(p_medio, 'efectivo'),
          v_referencia, v_moneda, auth.uid())
  returning id into v_pago;

  v_restante := p_importe;

  -- La imputación sigue yendo de lo más viejo a lo más nuevo: alimenta la antigüedad de
  -- la deuda. En pantalla el pago se descuenta del saldo total.
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

revoke execute on function public.registrar_pago(bigint, numeric, date, text, text, bigint[], text) from public;
revoke execute on function public.registrar_pago(bigint, numeric, date, text, text, bigint[], text) from anon;
grant execute on function public.registrar_pago(bigint, numeric, date, text, text, bigint[], text) to authenticated;

notify pgrst, 'reload schema';
