\set ON_ERROR_STOP on
\timing off

begin;

insert into auth.users (id, aud, role, email)
values ('00000000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', 'prueba2@local');
insert into public.usuarios (id, nombre, rol)
values ('00000000-0000-0000-0000-0000000000a2', 'Prueba', 'admin');
select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-0000000000a2', 'role', 'authenticated')::text, true);
set local role authenticated;

\echo '--- preparo dos ordenes del doctor 101 y una del 102'
select public.crear_orden(
  (select id from public.doctores where ficha = 100101), 'Paciente Uno',
  json_build_array(json_build_object('trabajo_id', (select id from public.trabajos where codigo = 'CMC'), 'cantidad', 2))::jsonb
) as orden_1;
select public.crear_orden(
  (select id from public.doctores where ficha = 100101), 'Paciente Dos',
  json_build_array(json_build_object('trabajo_id', (select id from public.trabajos where codigo = 'CZRM'), 'cantidad', 1))::jsonb
) as orden_2;
select public.crear_orden(
  (select id from public.doctores where ficha = 100103), 'Paciente Tres',
  json_build_array(json_build_object('trabajo_id', (select id from public.trabajos where codigo = 'CEC'), 'cantidad', 1))::jsonb
) as orden_3;

update public.ordenes set estado = 'terminada';

\echo '--- 1. mezclar doctores en la bandeja falla'
do $$
declare v_ids bigint[];
begin
  select array_agg(id) into v_ids from public.ordenes;
  perform public.emitir_remito((select id from public.doctores where ficha = 100101), v_ids);
  raise exception 'ERROR: deberia haber fallado';
exception when others then
  raise notice 'rechazado como corresponde: %', sqlerrm;
end;
$$;

\echo '--- 2. emitir el remito del doctor 101 (dos OT)'
select public.emitir_remito(
  (select id from public.doctores where ficha = 100101),
  (select array_agg(o.id) from public.ordenes o join public.doctores d on d.id = o.doctor_id where d.ficha = 100101)
) as remito;

\echo '--- 3. las OT quedaron entregadas y con remito'
select o.numero, o.estado, r.numero as remito
  from public.ordenes o left join public.remitos r on r.id = o.remito_id
 order by o.numero;

\echo '--- 4. el asiento y el saldo del doctor'
select m.tipo, m.importe, m.referencia from public.movimientos_cc m;
select s.saldo from public.v_saldos_doctor s
  join public.doctores d on d.id = s.doctor_id where d.ficha = 100101;

\echo '--- 5. volver a remitir las mismas OT falla'
do $$
declare v_ids bigint[];
begin
  select array_agg(o.id) into v_ids from public.ordenes o join public.doctores d on d.id = o.doctor_id where d.ficha = 100101;
  perform public.emitir_remito((select id from public.doctores where ficha = 100101), v_ids);
  raise exception 'ERROR: deberia haber fallado';
exception when others then
  raise notice 'rechazado como corresponde: %', sqlerrm;
end;
$$;

\echo '--- 6. anular el remito: contra-asiento, saldo 0 y OT de vuelta en terminada'
select public.anular_remito((select id from public.remitos limit 1), 'Prueba de anulación') as anulacion;
select m.tipo, m.importe, m.anula_movimiento_id is not null as es_contra from public.movimientos_cc m order by m.id;
select s.saldo as saldo_despues_de_anular from public.v_saldos_doctor s
  join public.doctores d on d.id = s.doctor_id where d.ficha = 100101;
select o.numero, o.estado, o.remito_id from public.ordenes o order by o.numero;
select numero, anulado_en is not null as anulado from public.remitos;

\echo '--- 7. anular dos veces falla'
do $$
begin
  perform public.anular_remito((select id from public.remitos limit 1));
  raise exception 'ERROR: deberia haber fallado';
exception when others then
  raise notice 'rechazado como corresponde: %', sqlerrm;
end;
$$;

\echo '--- 8. nada se borró del libro mayor'
select count(*) as asientos from public.movimientos_cc;

rollback;
