-- Corregir un precio ya cargado.
--
-- El historial sigue siendo historial: cambiar el precio de un trabajo agrega una
-- fila nueva con otra fecha de vigencia, y las órdenes ya cargadas no se tocan
-- porque guardan su propio precio congelado.
--
-- Lo que faltaba era poder arreglar un error de tipeo: si ya existe un precio
-- para esa fecha, la fila se corrige en vez de duplicarse. Por eso `precios_trabajo`
-- pasa a tener política de update.

create policy precios_correccion on public.precios_trabajo
  for update to authenticated
  using (public.es_staff())
  with check (public.es_staff());

comment on table public.precios_trabajo is
  'Historial de precios. Un precio nuevo es una fila nueva con otra fecha de vigencia; '
  'editar una fila existente sirve para corregir un error de carga en esa misma fecha.';
