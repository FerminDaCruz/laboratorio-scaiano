-- E1 · Row Level Security.
-- Modelo: todo el que tiene fila en public.usuarios con activo = true es personal
-- del laboratorio y ve todo. Hay datos de pacientes, así que sin fila no se ve nada.
--
-- Las tablas que mueven plata (ordenes, orden_items, remitos, remito_lineas,
-- movimientos_cc, imputaciones, periodos) solo tienen política de lectura: se
-- escriben desde las funciones SECURITY DEFINER de las etapas siguientes.

-- ---------------------------------------------------------------- helpers
-- SECURITY DEFINER para que consultar usuarios no dispare la RLS de usuarios.
create or replace function public.es_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.usuarios u
     where u.id = auth.uid() and u.activo
  );
$fn$;

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.usuarios u
     where u.id = auth.uid() and u.activo and u.rol = 'admin'
  );
$fn$;

revoke execute on function public.es_staff() from public;
revoke execute on function public.es_admin() from public;
grant execute on function public.es_staff() to authenticated;
grant execute on function public.es_admin() to authenticated;

alter table public.usuarios        enable row level security;
alter table public.obras_sociales  enable row level security;
alter table public.doctores        enable row level security;
alter table public.trabajos        enable row level security;
alter table public.precios_trabajo enable row level security;
alter table public.ordenes         enable row level security;
alter table public.orden_items     enable row level security;
alter table public.remitos         enable row level security;
alter table public.remito_lineas   enable row level security;
alter table public.movimientos_cc  enable row level security;
alter table public.imputaciones    enable row level security;
alter table public.periodos        enable row level security;

-- --------------------------------------------------------------- usuarios
create policy usuarios_lectura on public.usuarios
  for select to authenticated
  using (id = auth.uid() or public.es_admin());

create policy usuarios_alta on public.usuarios
  for insert to authenticated
  with check (public.es_admin());

create policy usuarios_edicion on public.usuarios
  for update to authenticated
  using (public.es_admin())
  with check (public.es_admin());

-- ------------------------------------------------- catálogos (ABM directo)
-- No hay política de delete en ninguna tabla: las bajas son lógicas (activo = false).
create policy obras_sociales_lectura on public.obras_sociales
  for select to authenticated using (public.es_staff());
create policy obras_sociales_alta on public.obras_sociales
  for insert to authenticated with check (public.es_staff());
create policy obras_sociales_edicion on public.obras_sociales
  for update to authenticated using (public.es_staff()) with check (public.es_staff());

create policy doctores_lectura on public.doctores
  for select to authenticated using (public.es_staff());
create policy doctores_alta on public.doctores
  for insert to authenticated with check (public.es_staff());
create policy doctores_edicion on public.doctores
  for update to authenticated using (public.es_staff()) with check (public.es_staff());

create policy trabajos_lectura on public.trabajos
  for select to authenticated using (public.es_staff());
create policy trabajos_alta on public.trabajos
  for insert to authenticated with check (public.es_staff());
create policy trabajos_edicion on public.trabajos
  for update to authenticated using (public.es_staff()) with check (public.es_staff());

-- Los precios son historial: se agregan, no se editan ni se borran.
create policy precios_lectura on public.precios_trabajo
  for select to authenticated using (public.es_staff());
create policy precios_alta on public.precios_trabajo
  for insert to authenticated with check (public.es_staff());

-- ----------------------------------------- producción y plata (solo lectura)
create policy ordenes_lectura on public.ordenes
  for select to authenticated using (public.es_staff());

-- El estado de la orden sí se cambia desde la pantalla (E6). El trigger
-- ordenes_campos_inmutables protege número, doctor y total.
create policy ordenes_edicion on public.ordenes
  for update to authenticated using (public.es_staff()) with check (public.es_staff());

create policy orden_items_lectura on public.orden_items
  for select to authenticated using (public.es_staff());

create policy remitos_lectura on public.remitos
  for select to authenticated using (public.es_staff());

create policy remito_lineas_lectura on public.remito_lineas
  for select to authenticated using (public.es_staff());

create policy movimientos_lectura on public.movimientos_cc
  for select to authenticated using (public.es_staff());

create policy imputaciones_lectura on public.imputaciones
  for select to authenticated using (public.es_staff());

create policy periodos_lectura on public.periodos
  for select to authenticated using (public.es_staff());

grant select on public.v_precios_vigentes to authenticated;
