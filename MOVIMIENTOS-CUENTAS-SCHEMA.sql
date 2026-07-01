-- FinTrack Pro - relaciona ingresos/egresos con cuentas bancarias y actualiza saldos.
-- Ejecuta este archivo en Supabase > SQL Editor.

alter table public.movimientos
  add column if not exists cuenta_id uuid references public.cuentas(id) on delete set null;

create index if not exists movimientos_cuenta_id_idx on public.movimientos(cuenta_id);

create or replace function public.aplicar_movimiento_saldo(
  p_cuenta_id uuid,
  p_tipo text,
  p_monto numeric,
  p_factor integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
begin
  if p_cuenta_id is null then
    return;
  end if;

  if p_tipo = 'ingreso' then
    update public.cuentas
    set saldo = saldo + (p_monto * p_factor)
    where id = p_cuenta_id and admin_id = v_admin_id;
  elsif p_tipo = 'egreso' then
    update public.cuentas
    set saldo = saldo - (p_monto * p_factor)
    where id = p_cuenta_id and admin_id = v_admin_id;
  else
    raise exception 'Tipo de movimiento invalido';
  end if;

  if not found then
    raise exception 'Cuenta no encontrada';
  end if;
end;
$$;

create or replace function public.registrar_movimiento_financiero(
  p_tipo text,
  p_concepto text,
  p_categoria text,
  p_tipo_movimiento_id uuid,
  p_cuenta_id uuid,
  p_monto numeric,
  p_fecha date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_id uuid;
begin
  if v_admin_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if p_monto is null or p_monto <= 0 then
    raise exception 'El monto debe ser mayor a cero';
  end if;

  perform public.aplicar_movimiento_saldo(p_cuenta_id, p_tipo, p_monto, 1);

  insert into public.movimientos (
    admin_id, tipo, concepto, categoria, tipo_movimiento_id, cuenta_id, monto, fecha
  )
  values (
    v_admin_id, p_tipo, p_concepto, p_categoria, p_tipo_movimiento_id, p_cuenta_id, p_monto, coalesce(p_fecha, current_date)
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.actualizar_movimiento_financiero(
  p_movimiento_id uuid,
  p_tipo text,
  p_concepto text,
  p_categoria text,
  p_tipo_movimiento_id uuid,
  p_cuenta_id uuid,
  p_monto numeric,
  p_fecha date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_old public.movimientos%rowtype;
begin
  if v_admin_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  select * into v_old
  from public.movimientos
  where id = p_movimiento_id and admin_id = v_admin_id
  for update;

  if not found then
    raise exception 'Movimiento no encontrado';
  end if;

  perform public.aplicar_movimiento_saldo(v_old.cuenta_id, v_old.tipo, v_old.monto, -1);
  perform public.aplicar_movimiento_saldo(p_cuenta_id, p_tipo, p_monto, 1);

  update public.movimientos
  set tipo = p_tipo,
      concepto = p_concepto,
      categoria = p_categoria,
      tipo_movimiento_id = p_tipo_movimiento_id,
      cuenta_id = p_cuenta_id,
      monto = p_monto,
      fecha = coalesce(p_fecha, current_date)
  where id = p_movimiento_id and admin_id = v_admin_id;
end;
$$;

create or replace function public.eliminar_movimiento_financiero(
  p_movimiento_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_old public.movimientos%rowtype;
begin
  if v_admin_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  select * into v_old
  from public.movimientos
  where id = p_movimiento_id and admin_id = v_admin_id
  for update;

  if not found then
    raise exception 'Movimiento no encontrado';
  end if;

  perform public.aplicar_movimiento_saldo(v_old.cuenta_id, v_old.tipo, v_old.monto, -1);

  delete from public.movimientos
  where id = p_movimiento_id and admin_id = v_admin_id;
end;
$$;

grant execute on function public.registrar_movimiento_financiero(text, text, text, uuid, uuid, numeric, date) to authenticated;
grant execute on function public.actualizar_movimiento_financiero(uuid, text, text, text, uuid, uuid, numeric, date) to authenticated;
grant execute on function public.eliminar_movimiento_financiero(uuid) to authenticated;

notify pgrst, 'reload schema';
