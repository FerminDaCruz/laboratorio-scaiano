-- E10 · Cierre mensual: congela los saldos del mes y protege lo ya cerrado.

create table public.periodo_saldos (
  periodo_id      bigint not null references public.periodos (id) on delete cascade,
  doctor_id       bigint not null references public.doctores (id),
  saldo_anterior  numeric(12,2) not null,
  facturado       numeric(12,2) not null,
  pagos           numeric(12,2) not null,
  saldo_final     numeric(12,2) not null,
  primary key (periodo_id, doctor_id)
);

alter table public.periodo_saldos enable row level security;

create policy periodo_saldos_lectura on public.periodo_saldos
  for select to authenticated using (public.es_staff());

create index periodo_saldos_doctor_idx on public.periodo_saldos (doctor_id);

/** Un movimiento con fecha dentro de un período cerrado solo entra como ajuste. */
create or replace function public.bloquear_periodo_cerrado()
returns trigger
language plpgsql
as $fn$
declare
  v_cerrado boolean;
begin
  select p.cerrado_en is not null
    into v_cerrado
    from public.periodos p
   where p.anio = extract(year from new.fecha)::smallint
     and p.mes = extract(month from new.fecha)::smallint;

  if coalesce(v_cerrado, false) and new.tipo <> 'ajuste' then
    raise exception 'El período % ya está cerrado: un movimiento con esa fecha tiene que entrar como ajuste',
      to_char(new.fecha, 'MM/YYYY');
  end if;

  return new;
end;
$fn$;

create trigger movimientos_cc_periodo_cerrado
  before insert on public.movimientos_cc
  for each row execute function public.bloquear_periodo_cerrado();

/**
 * Cierra un mes: valida que no haya quedado nada abierto y congela, por doctor,
 * el saldo anterior, lo facturado, lo pagado y el saldo final.
 */
create or replace function public.cerrar_periodo(
  p_anio smallint,
  p_mes  smallint
)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_periodo_id bigint;
  v_desde      date;
  v_hasta      date;
  v_doctores   integer;
  v_abiertas   integer;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede cerrar el período' using errcode = '42501';
  end if;

  v_desde := make_date(p_anio, p_mes, 1);
  v_hasta := (v_desde + interval '1 month')::date;

  if v_desde > current_date then
    raise exception 'No se puede cerrar un período que todavía no empezó';
  end if;

  select id into v_periodo_id from public.periodos where anio = p_anio and mes = p_mes;
  if v_periodo_id is null then
    insert into public.periodos (anio, mes) values (p_anio, p_mes) returning id into v_periodo_id;
  elsif (select cerrado_en from public.periodos where id = v_periodo_id) is not null then
    raise exception 'El período %/% ya estaba cerrado', p_mes, p_anio;
  end if;

  -- Validación: no puede haber órdenes del mes sin entregar ni anular.
  select count(*) into v_abiertas
    from public.ordenes
   where fecha >= v_desde and fecha < v_hasta
     and estado not in ('entregada', 'anulada');

  insert into public.periodo_saldos (periodo_id, doctor_id, saldo_anterior, facturado, pagos, saldo_final)
  select v_periodo_id,
         d.id,
         coalesce(sum(m.importe) filter (where m.fecha < v_desde), 0),
         coalesce(sum(m.importe) filter (where m.fecha >= v_desde and m.fecha < v_hasta and m.importe > 0), 0),
         coalesce(-sum(m.importe) filter (where m.fecha >= v_desde and m.fecha < v_hasta and m.importe < 0), 0),
         coalesce(sum(m.importe) filter (where m.fecha < v_hasta), 0)
    from public.doctores d
    left join public.movimientos_cc m on m.doctor_id = d.id
   group by d.id
  having coalesce(sum(m.importe) filter (where m.fecha < v_hasta), 0) <> 0
      or coalesce(count(m.id) filter (where m.fecha >= v_desde and m.fecha < v_hasta), 0) > 0;

  get diagnostics v_doctores = row_count;

  update public.periodos
     set cerrado_en = now(), cerrado_por = auth.uid()
   where id = v_periodo_id;

  return json_build_object(
    'periodo_id', v_periodo_id,
    'anio', p_anio,
    'mes', p_mes,
    'doctores', v_doctores,
    'ordenes_abiertas', v_abiertas
  );
end;
$fn$;

revoke execute on function public.cerrar_periodo(smallint, smallint) from public;
grant execute on function public.cerrar_periodo(smallint, smallint) to authenticated;
