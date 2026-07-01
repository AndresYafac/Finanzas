-- FinTrack Pro - repara RPC registrar_pago y eliminar_pago.
-- Ejecuta este archivo completo en Supabase > SQL Editor.

create or replace function public.registrar_pago(
  p_deuda_id uuid,
  p_cliente_id uuid,
  p_cuenta_id uuid,
  p_monto numeric,
  p_metodo text,
  p_referencia text,
  p_fecha date,
  p_notas text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_deuda public.deudas%rowtype;
  v_pago_id uuid;
begin
  if v_admin_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if p_monto is null or p_monto <= 0 then
    raise exception 'El monto debe ser mayor que cero';
  end if;

  select * into v_deuda
  from public.deudas
  where id = p_deuda_id and admin_id = v_admin_id
  for update;

  if not found or v_deuda.cliente_id <> p_cliente_id then
    raise exception 'Deuda no encontrada';
  end if;

  if v_deuda.monto_pagado + p_monto > v_deuda.monto_total then
    raise exception 'El pago supera el saldo pendiente';
  end if;

  if p_cuenta_id is not null and not exists (
    select 1
    from public.cuentas
    where id = p_cuenta_id and admin_id = v_admin_id
  ) then
    raise exception 'Cuenta no encontrada';
  end if;

  insert into public.pagos (
    admin_id, deuda_id, cliente_id, cuenta_id, monto,
    metodo, referencia, fecha, notas
  )
  values (
    v_admin_id, p_deuda_id, p_cliente_id, p_cuenta_id, p_monto,
    coalesce(p_metodo, 'Efectivo'), p_referencia, coalesce(p_fecha, current_date), p_notas
  )
  returning id into v_pago_id;

  update public.deudas
  set monto_pagado = monto_pagado + p_monto
  where id = p_deuda_id and admin_id = v_admin_id;

  if p_cuenta_id is not null then
    update public.cuentas
    set saldo = saldo + p_monto
    where id = p_cuenta_id and admin_id = v_admin_id;
  end if;

  return v_pago_id;
end;
$$;

create or replace function public.eliminar_pago(
  p_pago_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_pago public.pagos%rowtype;
begin
  if v_admin_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  select * into v_pago
  from public.pagos
  where id = p_pago_id and admin_id = v_admin_id
  for update;

  if not found then
    raise exception 'Pago no encontrado';
  end if;

  update public.deudas
  set monto_pagado = greatest(0, monto_pagado - v_pago.monto)
  where id = v_pago.deuda_id and admin_id = v_admin_id;

  if v_pago.cuenta_id is not null then
    update public.cuentas
    set saldo = saldo - v_pago.monto
    where id = v_pago.cuenta_id and admin_id = v_admin_id;
  end if;

  delete from public.pagos
  where id = p_pago_id and admin_id = v_admin_id;
end;
$$;

create or replace function public.actualizar_pago(
  p_pago_id uuid,
  p_deuda_id uuid,
  p_cliente_id uuid,
  p_cuenta_id uuid,
  p_monto numeric,
  p_metodo text,
  p_referencia text,
  p_fecha date,
  p_notas text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_old public.pagos%rowtype;
  v_deuda public.deudas%rowtype;
begin
  if v_admin_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if p_monto is null or p_monto <= 0 then
    raise exception 'El monto debe ser mayor que cero';
  end if;

  select * into v_old
  from public.pagos
  where id = p_pago_id and admin_id = v_admin_id
  for update;

  if not found then
    raise exception 'Pago no encontrado';
  end if;

  update public.deudas
  set monto_pagado = greatest(0, monto_pagado - v_old.monto)
  where id = v_old.deuda_id and admin_id = v_admin_id;

  if v_old.cuenta_id is not null then
    update public.cuentas
    set saldo = saldo - v_old.monto
    where id = v_old.cuenta_id and admin_id = v_admin_id;
  end if;

  select * into v_deuda
  from public.deudas
  where id = p_deuda_id and admin_id = v_admin_id
  for update;

  if not found or v_deuda.cliente_id <> p_cliente_id then
    raise exception 'Deuda no encontrada';
  end if;

  if v_deuda.monto_pagado + p_monto > v_deuda.monto_total then
    raise exception 'El pago supera el saldo pendiente';
  end if;

  if p_cuenta_id is not null and not exists (
    select 1
    from public.cuentas
    where id = p_cuenta_id and admin_id = v_admin_id
  ) then
    raise exception 'Cuenta no encontrada';
  end if;

  update public.pagos
  set deuda_id = p_deuda_id,
      cliente_id = p_cliente_id,
      cuenta_id = p_cuenta_id,
      monto = p_monto,
      metodo = coalesce(p_metodo, 'Efectivo'),
      referencia = p_referencia,
      fecha = coalesce(p_fecha, current_date),
      notas = p_notas
  where id = p_pago_id and admin_id = v_admin_id;

  update public.deudas
  set monto_pagado = monto_pagado + p_monto
  where id = p_deuda_id and admin_id = v_admin_id;

  if p_cuenta_id is not null then
    update public.cuentas
    set saldo = saldo + p_monto
    where id = p_cuenta_id and admin_id = v_admin_id;
  end if;
end;
$$;

grant execute on function public.registrar_pago(uuid, uuid, uuid, numeric, text, text, date, text) to authenticated;
grant execute on function public.eliminar_pago(uuid) to authenticated;
grant execute on function public.actualizar_pago(uuid, uuid, uuid, uuid, numeric, text, text, date, text) to authenticated;

notify pgrst, 'reload schema';
