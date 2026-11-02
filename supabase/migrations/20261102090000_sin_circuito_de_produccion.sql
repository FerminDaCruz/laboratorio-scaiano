-- E14 · Sin circuito de producción: una orden cargada ya se puede facturar.
--
-- El laboratorio no usa los estados intermedios. Marcar "en proceso" y "terminada" era
-- trabajo de carga que no cambiaba ninguna decisión: la comanda sale igual, el remito sale
-- igual. Desde ahora una OT tiene tres estados nada más:
--
--   ingresada  → cargada y lista para facturar
--   entregada  → la puso emitir_remito
--   anulada    → la puso anular_orden
--
-- Las órdenes que estaban en los estados viejos pasan a 'ingresada': nunca significaron
-- plata ni bloquearon nada, así que no hay nada que preservar.

update public.ordenes
   set estado = 'ingresada'
 where estado in ('en_proceso', 'terminada');

alter table public.ordenes drop constraint if exists ordenes_estado_check;
alter table public.ordenes
  add constraint ordenes_estado_check
  check (estado in ('ingresada', 'entregada', 'anulada'));

-- El índice de entregas comprometidas solo tiene sentido sobre lo que sigue abierto.
drop index if exists public.ordenes_entrega_idx;
create index ordenes_entrega_idx on public.ordenes (entrega_at) where estado = 'ingresada';

-- ------------------------------------------------------------ campos inmutables
-- Antes el cliente podía mover el estado dentro del circuito de producción. Ya no hay
-- circuito, así que el estado no se toca nunca desde la pantalla: lo pone emitir_remito,
-- anular_remito o anular_orden, todas SECURITY DEFINER.

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
  if new.estado is distinct from old.estado then
    raise exception 'El estado de una orden no se cambia a mano: lo pone el remito o la anulación';
  end if;
  return new;
end;
$fn$;

-- --------------------------------------------------------------- anular_remito
-- Lo único que cambia es a qué estado vuelven las OT: ya no hay 'terminada'.

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

  -- Las órdenes vuelven a estar disponibles para facturar.
  update public.ordenes
     set estado = 'ingresada', remito_id = null
   where remito_id = p_remito_id;

  return json_build_object('id', p_remito_id, 'numero', v_remito.numero, 'contra_asiento', v_contra);
end;
$fn$;

revoke execute on function public.anular_remito(bigint, text) from public;
grant execute on function public.anular_remito(bigint, text) to authenticated;

notify pgrst, 'reload schema';
