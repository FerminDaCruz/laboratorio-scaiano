-- E5 · crear_orden: asigna el número correlativo y congela los precios.
-- El cliente nunca manda el precio: se lee del catálogo acá adentro.

-- El trigger de campos inmutables protege contra ediciones desde el cliente,
-- pero las funciones que mueven plata corren como dueñas de la base y sí
-- recalculan el total.
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
  return new;
end;
$fn$;

create or replace function public.crear_orden(
  p_doctor_id      bigint,
  p_paciente       text,
  p_items          jsonb,                      -- [{trabajo_id, cantidad, piezas}]
  p_sexo           text        default null,
  p_edad           smallint    default null,
  p_obra_social_id bigint      default null,
  p_color          text        default null,
  p_indicaciones   text        default null,
  p_fecha          date        default null,
  p_entrega_at     timestamptz default null
)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_fecha     date := coalesce(p_fecha, current_date);
  v_orden_id  bigint;
  v_numero    integer;
  v_item      jsonb;
  v_trabajo   bigint;
  v_cantidad  smallint;
  v_precio    numeric(12,2);
  v_total     numeric(12,2) := 0;
  v_posicion  smallint := 0;
begin
  if not public.es_staff() then
    raise exception 'No tenés permiso para cargar órdenes' using errcode = '42501';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La orden necesita al menos un trabajo';
  end if;

  if coalesce(btrim(p_paciente), '') = '' then
    raise exception 'La orden necesita el nombre del paciente';
  end if;

  v_numero := nextval('public.ordenes_numero_seq');

  insert into public.ordenes (
    numero, doctor_id, paciente, sexo, edad, obra_social_id,
    color, indicaciones, fecha, entrega_at, estado, total, creado_por
  ) values (
    v_numero, p_doctor_id, btrim(p_paciente), p_sexo, p_edad, p_obra_social_id,
    p_color, p_indicaciones, v_fecha, p_entrega_at, 'ingresada', 0, auth.uid()
  )
  returning id into v_orden_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_posicion := v_posicion + 1;
    v_trabajo  := (v_item ->> 'trabajo_id')::bigint;
    v_cantidad := coalesce((v_item ->> 'cantidad')::smallint, 1);

    if v_cantidad < 1 then
      raise exception 'La cantidad del trabajo % tiene que ser mayor que cero', v_trabajo;
    end if;

    -- Precio congelado: el vigente a la fecha de la orden.
    select p.precio
      into v_precio
      from public.precios_trabajo p
     where p.trabajo_id = v_trabajo
       and p.vigente_desde <= v_fecha
     order by p.vigente_desde desc
     limit 1;

    if v_precio is null then
      raise exception 'El trabajo % no tiene precio vigente al %', v_trabajo, v_fecha;
    end if;

    insert into public.orden_items (
      orden_id, trabajo_id, cantidad, piezas, precio_unitario, posicion
    ) values (
      v_orden_id, v_trabajo, v_cantidad, nullif(btrim(coalesce(v_item ->> 'piezas', '')), ''),
      v_precio, v_posicion
    );

    v_total := v_total + v_precio * v_cantidad;
  end loop;

  update public.ordenes set total = v_total where id = v_orden_id;

  return json_build_object('id', v_orden_id, 'numero', v_numero, 'total', v_total);
end;
$fn$;

revoke execute on function public.crear_orden(
  bigint, text, jsonb, text, smallint, bigint, text, text, date, timestamptz
) from public;

grant execute on function public.crear_orden(
  bigint, text, jsonb, text, smallint, bigint, text, text, date, timestamptz
) to authenticated;
