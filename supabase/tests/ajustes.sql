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

\echo '--- 1. una orden con descuento del 10%: el precio del trabajo no cambia'
select public.crear_orden(
  (select id from public.doctores where ficha = 100101),
  'Paciente con descuento',
  json_build_array(
    json_build_object('trabajo_id', (select id from public.trabajos where codigo = 'CMC'), 'cantidad', 2)
  )::jsonb,
  null, null, null, null, null, current_date, null,
  'porcentaje', -10, 'Descuento acordado'
) as orden_con_descuento;

select i.precio_unitario, i.cantidad, o.ajuste, o.ajuste_pct, o.ajuste_motivo, o.total
  from public.ordenes o
  join public.orden_items i on i.orden_id = o.id
 where o.paciente = 'Paciente con descuento';

\echo '--- 2. una orden con un plus de monto fijo'
select public.crear_orden(
  (select id from public.doctores where ficha = 100101),
  'Paciente con plus',
  json_build_array(
    json_build_object('trabajo_id', (select id from public.trabajos where codigo = 'CMC'), 'cantidad', 1)
  )::jsonb,
  null, null, null, null, null, current_date, null,
  'monto', 15000.00, 'Entrega urgente'
) as orden_con_plus;

select o.ajuste, o.ajuste_pct, o.total,
       (select sum(subtotal) from public.orden_items where orden_id = o.id) as suma_items
  from public.ordenes o
 where o.paciente = 'Paciente con plus';

\echo '--- 3. sin ajuste, el total es la suma de los ítems'
select public.crear_orden(
  (select id from public.doctores where ficha = 100101),
  'Paciente sin ajuste',
  json_build_array(
    json_build_object('trabajo_id', (select id from public.trabajos where codigo = 'CMC'), 'cantidad', 1)
  )::jsonb
) as orden_sin_ajuste;

select ajuste, ajuste_pct, ajuste_motivo, total
  from public.ordenes where paciente = 'Paciente sin ajuste';

\echo '--- 4. un ajuste sin motivo se rechaza'
do $$
begin
  perform public.crear_orden(
    (select id from public.doctores where ficha = 100101), 'Paciente sin motivo',
    json_build_array(json_build_object('trabajo_id', (select id from public.trabajos where codigo = 'CMC'),
                                       'cantidad', 1))::jsonb,
    null, null, null, null, null, current_date, null, 'porcentaje', -10, null);
  raise exception 'ERROR: deberia haber fallado';
exception when others then
  raise notice 'rechazado como corresponde: %', sqlerrm;
end;
$$;

\echo '--- 5. un porcentaje imposible se rechaza'
do $$
begin
  perform public.crear_orden(
    (select id from public.doctores where ficha = 100101), 'Paciente imposible',
    json_build_array(json_build_object('trabajo_id', (select id from public.trabajos where codigo = 'CMC'),
                                       'cantidad', 1))::jsonb,
    null, null, null, null, null, current_date, null, 'porcentaje', -150, 'Regalado');
  raise exception 'ERROR: deberia haber fallado';
exception when others then
  raise notice 'rechazado como corresponde: %', sqlerrm;
end;
$$;

\echo '--- 6. un descuento fijo mayor que los trabajos se rechaza'
do $$
begin
  perform public.crear_orden(
    (select id from public.doctores where ficha = 100101), 'Paciente regalado',
    json_build_array(json_build_object('trabajo_id', (select id from public.trabajos where codigo = 'CMC'),
                                       'cantidad', 1))::jsonb,
    null, null, null, null, null, current_date, null, 'monto', -99999999.00, 'Imposible');
  raise exception 'ERROR: deberia haber fallado';
exception when others then
  raise notice 'rechazado como corresponde: %', sqlerrm;
end;
$$;

\echo '--- 7. editar_orden cambia cantidades, piezas y el ajuste'
select public.editar_orden(
  (select id from public.ordenes where paciente = 'Paciente sin ajuste'),
  'Paciente sin ajuste',
  json_build_array(
    json_build_object('trabajo_id', (select id from public.trabajos where codigo = 'CMC'),
                      'cantidad', 3, 'piezas', '2.4-2.6')
  )::jsonb,
  null, null, null, null, null, null,
  'monto', -30000.00, 'Descuento por cantidad'
) as edicion;

select o.ajuste, o.ajuste_pct, o.ajuste_motivo, o.total, i.cantidad, i.piezas, i.precio_unitario
  from public.ordenes o join public.orden_items i on i.orden_id = o.id
 where o.paciente = 'Paciente sin ajuste';

\echo '--- 8. el ajuste no se toca a mano desde la pantalla'
do $$
begin
  update public.ordenes set ajuste = -1000 where paciente = 'Paciente con plus';
  raise exception 'ERROR: deberia haber fallado';
exception when others then
  raise notice 'bloqueado como corresponde: %', sqlerrm;
end;
$$;

\echo '--- 9. tampoco el estado entregada'
do $$
begin
  update public.ordenes set estado = 'entregada' where paciente = 'Paciente con plus';
  raise exception 'ERROR: deberia haber fallado';
exception when others then
  raise notice 'bloqueado como corresponde: %', sqlerrm;
end;
$$;

\echo '--- 10. un operador no puede anular una orden'
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

\echo '--- 11. el admin sí, y queda el motivo'
select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-0000000000c1', 'role', 'authenticated')::text, true);
select public.anular_orden(
  (select id from public.ordenes where paciente = 'Paciente con plus'), 'Se equivocó el trabajo') as anulacion;
select estado, motivo_anulacion from public.ordenes where paciente = 'Paciente con plus';

\echo '--- 12. remito con descuento propio: el asiento lleva el total con el descuento'
select public.emitir_remito(
  (select id from public.doctores where ficha = 100101),
  array[
    (select id from public.ordenes where paciente = 'Paciente con descuento'),
    (select id from public.ordenes where paciente = 'Paciente sin ajuste')
  ],
  current_date,
  -20000.00,
  'Descuento del remito'
) as remito_con_descuento;

select numero, total, ajuste, ajuste_motivo from public.remitos;
select tipo, importe from public.movimientos_cc where tipo = 'remito';

\echo '--- 13. un ajuste de remito sin motivo se rechaza'
select public.crear_orden(
  (select id from public.doctores where ficha = 100103), 'Paciente del remito sin motivo',
  json_build_array(json_build_object('trabajo_id', (select id from public.trabajos where codigo = 'CZRM'),
                                     'cantidad', 1))::jsonb
) as orden_suelta;
do $$
begin
  perform public.emitir_remito(
    (select id from public.doctores where ficha = 100103),
    array[(select id from public.ordenes where paciente = 'Paciente del remito sin motivo')],
    current_date, -1000.00, null);
  raise exception 'ERROR: deberia haber fallado';
exception when others then
  raise notice 'rechazado como corresponde: %', sqlerrm;
end;
$$;

\echo '--- 14. una orden ya remitida no se edita ni se anula'
do $$
begin
  perform public.editar_orden(
    (select id from public.ordenes where paciente = 'Paciente sin ajuste'),
    'Paciente sin ajuste',
    json_build_array(json_build_object('trabajo_id', (select id from public.trabajos where codigo = 'CMC'),
                                       'cantidad', 1))::jsonb);
  raise exception 'ERROR: deberia haber fallado';
exception when others then
  raise notice 'rechazado como corresponde: %', sqlerrm;
end;
$$;

do $$
begin
  perform public.anular_orden(
    (select id from public.ordenes where paciente = 'Paciente sin ajuste'), 'Prueba');
  raise exception 'ERROR: deberia haber fallado';
exception when others then
  raise notice 'rechazado como corresponde: %', sqlerrm;
end;
$$;

\echo '--- 15. corregir: anular el remito deja las OT listas para rehacerlo'
select public.anular_remito((select id from public.remitos limit 1), 'Corrección del remito') as correccion;
select paciente, estado, remito_id from public.ordenes
 where paciente in ('Paciente con descuento', 'Paciente sin ajuste') order by paciente;
select count(*) as asientos from public.movimientos_cc;

rollback;
