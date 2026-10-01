\set ON_ERROR_STOP on
\timing off

begin;

insert into auth.users (id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated', 'admin@local'),
  ('00000000-0000-0000-0000-0000000000b2', 'authenticated', 'authenticated', 'operador@local');
insert into public.usuarios (id, nombre, rol) values
  ('00000000-0000-0000-0000-0000000000b1', 'Admin', 'admin'),
  ('00000000-0000-0000-0000-0000000000b2', 'Operador', 'operador');

select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-0000000000b1', 'role', 'authenticated')::text, true);
set local role authenticated;

\echo '--- preparo un remito y un pago del mes pasado'
select public.crear_orden((select id from public.doctores where ficha = 103), 'Paciente del mes pasado',
  json_build_array(json_build_object('trabajo_id', (select id from public.trabajos where codigo = 'CMC'), 'cantidad', 1))::jsonb,
  null, null, null, null, null, (date_trunc('month', current_date) - interval '1 month')::date) as orden;
select public.emitir_remito((select id from public.doctores where ficha = 103),
  array[(select id from public.ordenes where paciente = 'Paciente del mes pasado')],
  (date_trunc('month', current_date) - interval '1 month')::date) as remito;
select public.registrar_pago((select id from public.doctores where ficha = 103), 30000.00,
  (date_trunc('month', current_date) - interval '1 month' + interval '10 days')::date) as pago;

\echo '--- 1. un operador no puede cerrar el período'
select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-0000000000b2', 'role', 'authenticated')::text, true);
do $$
begin
  perform public.cerrar_periodo(
    extract(year from current_date - interval '1 month')::smallint,
    extract(month from current_date - interval '1 month')::smallint);
  raise exception 'ERROR: deberia haber fallado';
exception when others then
  raise notice 'rechazado como corresponde: %', sqlerrm;
end;
$$;

\echo '--- 2. el admin cierra el mes pasado'
select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-0000000000b1', 'role', 'authenticated')::text, true);
select public.cerrar_periodo(
  extract(year from current_date - interval '1 month')::smallint,
  extract(month from current_date - interval '1 month')::smallint) as cierre;

\echo '--- 3. los saldos quedaron congelados'
select d.ficha, s.saldo_anterior, s.facturado, s.pagos, s.saldo_final
  from public.periodo_saldos s join public.doctores d on d.id = s.doctor_id
 order by d.ficha;

\echo '--- 4. un movimiento con fecha del mes cerrado se rechaza si no es ajuste'
do $$
begin
  perform public.registrar_pago((select id from public.doctores where ficha = 103), 1000.00,
    (date_trunc('month', current_date) - interval '1 month' + interval '5 days')::date);
  raise exception 'ERROR: deberia haber fallado';
exception when others then
  raise notice 'rechazado como corresponde: %', sqlerrm;
end;
$$;

\echo '--- 5. un ajuste con esa fecha sí entra'
reset role;
insert into public.movimientos_cc (doctor_id, fecha, tipo, importe, referencia)
select id, (date_trunc('month', current_date) - interval '1 month' + interval '5 days')::date,
       'ajuste', 1000.00, 'Ajuste posterior al cierre'
  from public.doctores where ficha = 103;
set local role authenticated;
select count(*) as ajustes from public.movimientos_cc where tipo = 'ajuste';

\echo '--- 6. cerrar dos veces el mismo mes falla'
do $$
begin
  perform public.cerrar_periodo(
    extract(year from current_date - interval '1 month')::smallint,
    extract(month from current_date - interval '1 month')::smallint);
  raise exception 'ERROR: deberia haber fallado';
exception when others then
  raise notice 'rechazado como corresponde: %', sqlerrm;
end;
$$;

rollback;
