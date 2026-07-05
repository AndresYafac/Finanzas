-- FinTrack Pro - RPCs transaccionales para operaciones con saldo
-- Ejecutar en Supabase SQL Editor.
-- Objetivo: centralizar cambios de dinero y evitar saldos inconsistentes.

create or replace function public.ajustar_saldo_cuenta(
  p_cuenta_id uuid,
  p_admin_id uuid,
  p_delta numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.cuentas
  set saldo = coalesce(saldo, 0) + coalesce(p_delta, 0),
      updated_at = now()
  where id = p_cuenta_id
    and admin_id = p_admin_id;

  if not found then
    raise exception 'Cuenta no encontrada o no pertenece al usuario';
  end if;
end;
$$;

create or replace function public.registrar_movimiento_con_saldo(
  p_admin_id uuid,
  p_cuenta_id uuid,
  p_tipo text,
  p_monto numeric,
  p_fecha date,
  p_descripcion text default null,
  p_categoria text default null,
  p_tipo_movimiento_id uuid default null,
  p_notas text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_delta numeric;
begin
  if p_admin_id <> auth.uid() then
    raise exception 'No autorizado';
  end if;

  if p_tipo not in ('ingreso', 'egreso') then
    raise exception 'Tipo invalido';
  end if;

  v_delta := case when p_tipo = 'ingreso' then abs(p_monto) else -abs(p_monto) end;

  insert into public.movimientos (
    admin_id,
    cuenta_id,
    tipo,
    monto,
    fecha,
    descripcion,
    categoria,
    tipo_movimiento_id,
    notas
  )
  values (
    p_admin_id,
    p_cuenta_id,
    p_tipo,
    abs(p_monto),
    coalesce(p_fecha, current_date),
    p_descripcion,
    p_categoria,
    p_tipo_movimiento_id,
    p_notas
  )
  returning id into v_id;

  perform public.ajustar_saldo_cuenta(p_cuenta_id, p_admin_id, v_delta);

  return v_id;
end;
$$;

create or replace function public.eliminar_movimiento_con_saldo(
  p_movimiento_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mov public.movimientos%rowtype;
  v_delta numeric;
begin
  select * into v_mov
  from public.movimientos
  where id = p_movimiento_id
    and admin_id = auth.uid();

  if not found then
    raise exception 'Movimiento no encontrado';
  end if;

  v_delta := case when v_mov.tipo = 'ingreso' then -abs(v_mov.monto) else abs(v_mov.monto) end;

  delete from public.movimientos
  where id = p_movimiento_id
    and admin_id = auth.uid();

  if v_mov.cuenta_id is not null then
    perform public.ajustar_saldo_cuenta(v_mov.cuenta_id, v_mov.admin_id, v_delta);
  end if;
end;
$$;

grant execute on function public.ajustar_saldo_cuenta(uuid, uuid, numeric) to authenticated;
grant execute on function public.registrar_movimiento_con_saldo(uuid, uuid, text, numeric, date, text, text, uuid, text) to authenticated;
grant execute on function public.eliminar_movimiento_con_saldo(uuid) to authenticated;
