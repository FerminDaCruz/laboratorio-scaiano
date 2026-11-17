-- La antigüedad de la deuda tiene que coincidir con el saldo, también después de anular.
-- Regla que se verifica en cada paso:
--   deuda pendiente (lo que suma 0-30, 31-60…) − crédito disponible = saldo
--   y nunca quedan a la vez deuda pendiente y crédito suelto.
--
-- SQL plano (sin comandos de psql): se puede correr con psql en la base local o con
-- `supabase db query --linked -f`. Todo se deshace al final.

begin;

-- Compara saldo, deuda pendiente, crédito disponible y la vista de antigüedad.
create function pg_temp.verificar(p_doctor bigint, p_caso text)
returns void
language plpgsql
as $$
declare
  v_saldo     numeric := (select saldo from public.v_saldos_doctor where doctor_id = p_doctor);
  v_deuda     numeric := (select coalesce(sum(pendiente), 0) from public.v_deudas_pendientes where doctor_id = p_doctor);
  v_credito   numeric := (select coalesce(sum(disponible), 0) from public.v_creditos_disponibles where doctor_id = p_doctor);
  v_antig     numeric := (select coalesce(sum(dias_0_30 + dias_31_60 + dias_61_90 + dias_mas_90), 0)
                            from public.v_antiguedad_deuda where doctor_id = p_doctor);
begin
  raise notice '%: saldo %, deuda %, crédito %, antigüedad %', p_caso, v_saldo, v_deuda, v_credito, v_antig;
  if v_deuda - v_credito <> v_saldo then
    raise exception 'FALLA %: deuda % − crédito % ≠ saldo %', p_caso, v_deuda, v_credito, v_saldo;
  end if;
  if v_deuda > 0 and v_credito > 0 then
    raise exception 'FALLA %: quedó deuda % y crédito suelto % a la vez', p_caso, v_deuda, v_credito;
  end if;
  if v_antig <> v_deuda then
    raise exception 'FALLA %: antigüedad % ≠ deuda pendiente %', p_caso, v_antig, v_deuda;
  end if;
end;
$$;

insert into auth.users (id, aud, role, email)
values ('00000000-0000-0000-0000-0000000000a5', 'authenticated', 'authenticated', 'prueba-antiguedad@local');
insert into public.usuarios (id, nombre, rol)
values ('00000000-0000-0000-0000-0000000000a5', 'Prueba antigüedad', 'admin');
select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-0000000000a5', 'role', 'authenticated')::text, true);
set local role authenticated;

do $$
declare
  v_doctor  bigint := (select id from public.doctores where ficha = 100101);
  v_trabajo bigint := (select id from public.trabajos where codigo = 'CMC');
  v_orden_a bigint;
  v_orden_b bigint;
  v_rem_a   json;
  v_rem_b   json;
  v_rem_a2  json;
begin
  v_orden_a := (public.crear_orden(v_doctor, 'Paciente A',
    json_build_array(json_build_object('trabajo_id', v_trabajo, 'cantidad', 2))::jsonb) ->> 'id')::bigint;
  v_orden_b := (public.crear_orden(v_doctor, 'Paciente B',
    json_build_array(json_build_object('trabajo_id', v_trabajo, 'cantidad', 1))::jsonb) ->> 'id')::bigint;

  -- Caso 1: el remito A está pagado entero y el B impago; se anula A.
  -- El pago de A se libera y tiene que aplicarse a B.
  v_rem_a := public.emitir_remito(v_doctor, array[v_orden_a]);
  perform public.registrar_pago(v_doctor, (v_rem_a ->> 'total')::numeric);
  v_rem_b := public.emitir_remito(v_doctor, array[v_orden_b]);
  perform pg_temp.verificar(v_doctor, 'antes de anular');
  perform public.anular_remito((v_rem_a ->> 'id')::bigint, 'Prueba: anular el pagado');
  perform pg_temp.verificar(v_doctor, 'caso 1: anular un remito pagado');

  -- Caso 2: se vuelve a emitir A y después se anula sin reemplazo.
  -- El remito anulado no puede quedar contando como deuda.
  v_rem_a2 := public.emitir_remito(v_doctor, array[v_orden_a]);
  perform pg_temp.verificar(v_doctor, 'caso 2a: reemitir después de anular');
  perform public.anular_remito((v_rem_a2 ->> 'id')::bigint, 'Prueba: anular sin reemplazo');
  perform pg_temp.verificar(v_doctor, 'caso 2b: anular sin reemplazo');

  -- Caso 3: se anula B, que estaba cubierto por el pago liberado. Queda todo a favor.
  perform public.anular_remito((v_rem_b ->> 'id')::bigint, 'Prueba: anular el último');
  perform pg_temp.verificar(v_doctor, 'caso 3: anular todo, queda a favor');

  raise notice 'OK: la antigüedad coincide con el saldo en todos los casos';
end;
$$;

rollback;
