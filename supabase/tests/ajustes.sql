\set ON_ERROR_STOP on
\timing off

begin;

insert into auth.users (id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', 'admin-e14@local'),
  ('00000000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated', 'operador-e14@local');
insert into public.usuarios (id, nombre, rol) values
  ('00000000-0000-0000-0000-0000000000c1', 'Admin', 'admin'),
  ('00000000-0000-0000-0000-0000000000c2', 'Operador', 'operador');

select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-0000000000c1', 'role', 'authenticated')::text, true);
set local role authenticated;

\echo '--- 1. una orden nueva con precio acordado (plus) en vez del de catálogo'
select public.crear_orden(
  (select id from public.doctores where ficha = 100101),
  'Paciente con plus',
  json_build_array(
    json_build_object('trabajo_id', (select id from public.trabajos where codigo = 'CMC'),
                      'cantidad', 2, 'precio', 200000.00)
  )::jsonb
) as orden_con_plus;

select t.codigo, i.cantidad, i.precio_unitario, o.total
  from public.orden_items i
  join public.ordenes o on o.id = i.orden_id
  join public.trabajos t on t.id = i.trabajo_id
 where o.paciente = 'Paciente con plus';

\echo '--- 2. sin precio, sigue tomando el del catálogo'
select public.crear_orden(
  (select id from public.doctores where ficha = 100101),
  'Paciente sin plus',
  json_build_array(
    json_build_object('trabajo_id', (select id from public.trabajos where codigo = 'CMC'), 'cantidad', 1)
  )::jsonb
) as orden_catalogo;

select i.precio_unitario as precio_de_catalogo
  from public.orden_items i
  join public.ordenes o on o.id = i.orden_id
 where o.paciente = 'Paciente sin plus';

\echo '--- 3. editar_orden cambia el precio y recalcula el total'
select public.editar_orden(
  (select id from public.ordenes where paciente = 'Paciente sin plus'),
  'Paciente sin plus',
  json_build_array(
    json_build_object('trabajo_id', (select id from public.trabajos where codigo = 'CMC'),
                      'cantidad', 1, 'precio', 120000.00, 'piezas', '2.4-2.6')
  )::jsonb
) as edicion;

select o.total, i.precio_unitario, i.piezas
  from public.ordenes o join public.orden_items i on i.orden_id = o.id
 where o.paciente = 'Paciente sin plus';

\echo '--- 4. un precio negativo se rechaza'
do $$
begin
  perform public.editar_orden(
    (select id from public.ordenes where paciente = 'Paciente sin plus'),
    'Paciente sin plus',
    json_build_array(json_build_object('trabajo_id', (select id from public.trabajos where codigo = 'CMC'),
                                       'cantidad', 1, 'precio', -5000.00))::jsonb);
  raise exception 'ERROR: deberia haber fallado';
exception when others then
  raise notice 'rechazado como corresponde: %', sqlerrm;
end;
$$;

\echo '--- 5. un operador no puede anular una orden'
select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-0000000000c2', 'role', 'authenticated')::text, true);
do $$
begin
  perform public.anular_orden((select id from public.ordenes where paciente = 'Paciente con plus'), 'Prueba');
  raise exception 'ERROR: deberia haber fallado';
exception when others then
  raise notice 'rechazado como corresponde: %', sqlerrm;
end;
$$;

\echo '--- 6. el admin sí, y queda el motivo'
select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-0000000000c1', 'role', 'authenticated')::text, true);
select public.anular_orden(
  (select id from public.ordenes where paciente = 'Paciente con plus'), 'Se equivocó el trabajo') as anulacion;
select estado, motivo_anulacion from public.ordenes where paciente = 'Paciente con plus';

\echo '--- 7. desde la pantalla no se puede poner una orden en entregada ni en anulada'
do $$
begin
  update public.ordenes set estado = 'entregada' where paciente = 'Paciente sin plus';
  raise exception 'ERROR: deberia haber fallado';
exception when others then
  raise notice 'bloqueado como corresponde: %', sqlerrm;
end;
$$;

\echo '--- 8. remito con descuento: el total y el asiento lo incluyen'
select public.emitir_remito(
  (select id from public.doctores where ficha = 100101),
  array[(select id from public.ordenes where paciente = 'Paciente sin plus')],
  current_date,
  -20000.00,
  'Descuento acordado'
) as remito_con_descuento;

select numero, total, ajuste, ajuste_motivo from public.remitos;
select m.tipo, m.importe from public.movimientos_cc m where m.tipo = 'remito';

\echo '--- 9. un descuento mayor que el total se rechaza'
select public.crear_orden(
  (select id from public.doctores where ficha = 100103), 'Paciente del descuento grande',
  json_build_array(json_build_object('trabajo_id', (select id from public.trabajos where codigo = 'CZRM'), 'cantidad', 1))::jsonb
) as orden_descuento;
do $$
begin
  perform public.emitir_remito(
    (select id from public.doctores where ficha = 100103),
    array[(select id from public.ordenes where paciente = 'Paciente del descuento grande')],
    current_date, -99999999.00, 'Imposible');
  raise exception 'ERROR: deberia haber fallado';
exception when others then
  raise notice 'rechazado como corresponde: %', sqlerrm;
end;
$$;

\echo '--- 10. un ajuste sin motivo se rechaza'
do $$
begin
  perform public.emitir_remito(
    (select id from public.doctores where ficha = 100103),
    array[(select id from public.ordenes where paciente = 'Paciente del descuento grande')],
    current_date, -1000.00, null);
  raise exception 'ERROR: deberia haber fallado';
exception when others then
  raise notice 'rechazado como corresponde: %', sqlerrm;
end;
$$;

\echo '--- 11. una orden ya remitida no se edita ni se anula'
do $$
begin
  perform public.editar_orden(
    (select id from public.ordenes where paciente = 'Paciente sin plus'),
    'Paciente sin plus',
    json_build_array(json_build_object('trabajo_id', (select id from public.trabajos where codigo = 'CMC'), 'cantidad', 1))::jsonb);
  raise exception 'ERROR: deberia haber fallado';
exception when others then
  raise notice 'rechazado como corresponde: %', sqlerrm;
end;
$$;

do $$
begin
  perform public.anular_orden((select id from public.ordenes where paciente = 'Paciente sin plus'), 'Prueba');
  raise exception 'ERROR: deberia haber fallado';
exception when others then
  raise notice 'rechazado como corresponde: %', sqlerrm;
end;
$$;

\echo '--- 12. corregir: anular el remito deja las OT listas para rehacerlo'
select public.anular_remito((select id from public.remitos limit 1), 'Corrección del remito') as correccion;
select o.estado, o.remito_id from public.ordenes o where o.paciente = 'Paciente sin plus';
select count(*) as asientos from public.movimientos_cc;

rollback;
