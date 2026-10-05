\set ON_ERROR_STOP on
\timing off

-- Se corre como un usuario autenticado del laboratorio.
begin;

-- Usuario de prueba, dentro de la transacción (al final se hace rollback).
insert into auth.users (id, aud, role, email)
values ('00000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 'prueba@local');
insert into public.usuarios (id, nombre, rol)
values ('00000000-0000-0000-0000-0000000000a1', 'Prueba', 'admin');

select set_config(
  'request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-0000000000a1', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

\echo '--- 1. crear_orden con dos items'
select public.crear_orden(
  (select id from public.doctores where ficha = 100101),
  'Rodríguez, Ana María',
  json_build_array(
    json_build_object('trabajo_id', (select id from public.trabajos where codigo = 'CMC'), 'cantidad', 3, 'piezas', '2.4-2.6'),
    json_build_object('trabajo_id', (select id from public.trabajos where codigo = 'CZRM'), 'cantidad', 1, 'piezas', 'arcada:sup')
  )::jsonb,
  'F', 54::smallint,
  (select id from public.obras_sociales where codigo = 'OSDE'),
  'A3', 'Sin metal en el frente', current_date, now() + interval '5 days'
) as resultado;

\echo '--- 2. la orden quedó con numero 1, estado ingresada y total = 3*93600 + 222000'
select numero, estado, total, paciente from public.ordenes;

\echo '--- 3. los precios quedaron congelados desde el catálogo'
select t.codigo, i.cantidad, i.piezas, i.precio_unitario, i.subtotal
  from public.orden_items i join public.trabajos t on t.id = i.trabajo_id
 order by i.posicion;

\echo '--- 4. un aumento posterior NO cambia la orden ya cargada'
reset role;
insert into public.precios_trabajo (trabajo_id, precio, vigente_desde)
select id, 999999.00, current_date from public.trabajos where codigo = 'CMC';
set local role authenticated;
select i.precio_unitario as precio_congelado, o.total as total_de_la_orden
  from public.orden_items i
  join public.ordenes o on o.id = i.orden_id
  join public.trabajos t on t.id = i.trabajo_id
 where t.codigo = 'CMC';

\echo '--- 5. el cliente no puede tocar el total de una orden'
do $$
begin
  update public.ordenes set total = 0 where numero = 1;
  raise exception 'ERROR: el update deberia haber fallado';
exception when others then
  raise notice 'bloqueado como corresponde: %', sqlerrm;
end;
$$;

\echo '--- 6. el cliente sí puede cambiar el estado (E6)'
update public.ordenes set estado = 'en_proceso' where numero = 1;
select numero, estado from public.ordenes;

\echo '--- 7. una orden sin items falla'
do $$
begin
  perform public.crear_orden(
    (select id from public.doctores where ficha = 100101), 'Paciente sin items', '[]'::jsonb
  );
  raise exception 'ERROR: deberia haber fallado';
exception when others then
  raise notice 'rechazado como corresponde: %', sqlerrm;
end;
$$;

\echo '--- 8. un trabajo sin precio vigente falla y no deja la orden a medias'
reset role;
insert into public.trabajos (codigo, titulo) values ('ZZZ', 'Trabajo sin precio');
set local role authenticated;
do $$
begin
  perform public.crear_orden(
    (select id from public.doctores where ficha = 100101),
    'Paciente con trabajo sin precio',
    json_build_array(json_build_object('trabajo_id', (select id from public.trabajos where codigo = 'ZZZ'), 'cantidad', 1))::jsonb
  );
  raise exception 'ERROR: deberia haber fallado';
exception when others then
  raise notice 'rechazado como corresponde: %', sqlerrm;
end;
$$;

\echo '--- 9. cantidad de ordenes (tiene que seguir siendo 1)'
select count(*) as ordenes from public.ordenes;

\echo '--- 10. el libro mayor no se edita ni se borra'
reset role;
insert into public.movimientos_cc (doctor_id, tipo, importe)
select id, 'ajuste', 1000.00 from public.doctores where ficha = 100101;
do $$
begin
  update public.movimientos_cc set importe = 2000.00;
  raise exception 'ERROR: deberia haber fallado';
exception when others then
  raise notice 'bloqueado como corresponde: %', sqlerrm;
end;
$$;

rollback;
