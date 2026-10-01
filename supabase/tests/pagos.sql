\set ON_ERROR_STOP on
\timing off

begin;

insert into auth.users (id, aud, role, email)
values ('00000000-0000-0000-0000-0000000000a3', 'authenticated', 'authenticated', 'prueba3@local');
insert into public.usuarios (id, nombre, rol)
values ('00000000-0000-0000-0000-0000000000a3', 'Prueba', 'admin');
select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-0000000000a3', 'role', 'authenticated')::text, true);
set local role authenticated;

\echo '--- preparo dos remitos del doctor 102 (uno viejo y uno nuevo)'
select public.crear_orden((select id from public.doctores where ficha = 102), 'Paciente A',
  json_build_array(json_build_object('trabajo_id', (select id from public.trabajos where codigo = 'CMC'), 'cantidad', 1))::jsonb,
  null, null, null, null, null, current_date - 70) as orden_a;
select public.crear_orden((select id from public.doctores where ficha = 102), 'Paciente B',
  json_build_array(json_build_object('trabajo_id', (select id from public.trabajos where codigo = 'PCA'), 'cantidad', 1))::jsonb,
  null, null, null, null, null, current_date - 5) as orden_b;

select public.emitir_remito((select id from public.doctores where ficha = 102),
  array[(select id from public.ordenes where paciente = 'Paciente A')], current_date - 70) as remito_viejo;
select public.emitir_remito((select id from public.doctores where ficha = 102),
  array[(select id from public.ordenes where paciente = 'Paciente B')], current_date - 5) as remito_nuevo;

\echo '--- 1. saldo y antigüedad antes de pagar (78000 a 70 dias + 185000 a 5 dias, con el aumento del 20%)'
select s.saldo from public.v_saldos_doctor s join public.doctores d on d.id = s.doctor_id where d.ficha = 102;
select dias_0_30, dias_61_90, total from public.v_antiguedad_deuda a
  join public.doctores d on d.id = a.doctor_id where d.ficha = 102;

\echo '--- 2. un pago parcial se imputa al remito mas viejo primero'
select public.registrar_pago((select id from public.doctores where ficha = 102), 100000.00, current_date, 'transferencia', 'Transferencia 1234') as pago;
select m.tipo, m.importe, m.medio from public.movimientos_cc m
  join public.doctores d on d.id = m.doctor_id where d.ficha = 102 order by m.id;
select i.importe as imputado, deb.referencia as contra from public.imputaciones i
  join public.movimientos_cc deb on deb.id = i.movimiento_debe_id;

\echo '--- 3. lo que queda pendiente'
select m.referencia, p.pendiente from public.v_deudas_pendientes p
  join public.doctores d on d.id = p.doctor_id
  join public.movimientos_cc m on m.id = p.id
 where d.ficha = 102 order by p.fecha;

\echo '--- 4. un pago mayor a la deuda deja saldo a favor'
select public.registrar_pago((select id from public.doctores where ficha = 102), 500000.00) as pago_grande;
select s.saldo as saldo_final from public.v_saldos_doctor s join public.doctores d on d.id = s.doctor_id where d.ficha = 102;
select disponible from public.v_creditos_disponibles c join public.doctores d on d.id = c.doctor_id where d.ficha = 102;

\echo '--- 5. el saldo a favor se imputa solo al remito siguiente'
select public.crear_orden((select id from public.doctores where ficha = 102), 'Paciente C',
  json_build_array(json_build_object('trabajo_id', (select id from public.trabajos where codigo = 'REB'), 'cantidad', 1))::jsonb) as orden_c;
select public.emitir_remito((select id from public.doctores where ficha = 102),
  array[(select id from public.ordenes where paciente = 'Paciente C')]) as remito_con_credito;
select s.saldo as saldo_tras_usar_credito from public.v_saldos_doctor s join public.doctores d on d.id = s.doctor_id where d.ficha = 102;

\echo '--- 6. un pago en cero se rechaza'
do $$
begin
  perform public.registrar_pago((select id from public.doctores where ficha = 102), 0);
  raise exception 'ERROR: deberia haber fallado';
exception when others then
  raise notice 'rechazado como corresponde: %', sqlerrm;
end;
$$;

rollback;
