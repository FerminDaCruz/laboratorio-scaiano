-- Alta del usuario del laboratorio y baja de los usuarios de prueba.
-- Se pega en el SQL Editor del panel de Supabase, UN PASO POR VEZ, leyendo el resultado.
-- No es una migración: es un ayudante para el panel.


-- =========================================================== PASO 1 · Ver
-- Lista todos los usuarios y cuántos registros tiene cada uno a su nombre.
-- Un usuario con registros no se puede borrar de Auth: la base lo frena
-- ("Database error deleting user") porque esos registros quedarían apuntando a nadie.

select
  u.email,
  uu.nombre,
  uu.rol,
  uu.activo,
  (select count(*) from public.precios_trabajo where creado_por = u.id)                     as precios,
  (select count(*) from public.ordenes         where creado_por = u.id)                     as ordenes,
  (select count(*) from public.remitos         where creado_por = u.id or anulado_por = u.id) as remitos,
  (select count(*) from public.periodos        where cerrado_por = u.id)                    as periodos,
  (select count(*) from public.movimientos_cc  where creado_por = u.id)                     as movimientos
from auth.users u
left join public.usuarios uu on uu.id = u.id
order by u.created_at;


-- =========================================================== PASO 2 · Alta
-- Habilita al usuario del laboratorio (ya creado en Authentication → Users).
-- Sin esta fila, el login dice "sin habilitar".

insert into public.usuarios (id, nombre, rol)
select id, 'Laboratorio Scaiano', 'admin'
from auth.users
where email = 'laboratorioscaianodigital@gmail.com'
on conflict (id) do update set activo = true;


-- =========================================================== PASO 3 · Baja
-- Cambiá el mail de abajo por el del usuario de prueba y corré el bloque entero.
-- Desvincula sus registros (quedan sin autor, no se borran) y lo borra de Auth.
--
-- Si tiene asientos de cuenta corriente (columna "movimientos" del paso 1), NO se puede
-- borrar: el libro mayor no se edita nunca. En ese caso el bloque lo desactiva en vez de
-- borrarlo, y queda sin acceso (para cortar también el login, bloquealo en el panel).

do $$
declare
  v_email text := 'prueba@gmail.com';   -- ← el mail del usuario de prueba
  v_id    uuid;
begin
  select id into v_id from auth.users where email = v_email;
  if v_id is null then
    raise exception 'No existe el usuario %', v_email;
  end if;

  if exists (select 1 from public.movimientos_cc where creado_por = v_id) then
    update public.usuarios set activo = false where id = v_id;
    raise notice '% tiene asientos de cuenta corriente: se desactivó, no se borró.', v_email;
    return;
  end if;

  update public.precios_trabajo set creado_por  = null where creado_por  = v_id;
  update public.ordenes         set creado_por  = null where creado_por  = v_id;
  update public.remitos         set creado_por  = null where creado_por  = v_id;
  update public.remitos         set anulado_por = null where anulado_por = v_id;
  update public.periodos        set cerrado_por = null where cerrado_por = v_id;

  delete from auth.users where id = v_id;   -- borra también su fila en usuarios
  raise notice '% borrado.', v_email;
end $$;
