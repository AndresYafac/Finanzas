-- Logica de prestamos/desembolsos para deudas por cobrar.
-- Ejecutar completo en Supabase SQL Editor.

alter table public.deudas
  add column if not exists cuenta_desembolso_id uuid references public.cuentas(id) on delete set null,
  add column if not exists movimiento_desembolso_id uuid references public.movimientos(id) on delete set null,
  add column if not exists desembolsado boolean not null default false;

grant update (cuenta_desembolso_id, movimiento_desembolso_id, desembolsado) on public.deudas to authenticated;

create or replace function public.registrar_deuda_con_desembolso(
  p_cliente_id uuid,
  p_descripcion text,
  p_monto_total numeric,
  p_interes numeric default 0,
  p_tipo text default 'Prestamo',
  p_fecha_inicio date default current_date,
  p_fecha_vencimiento date default null,
  p_notas text default null,
  p_desembolsar boolean default false,
  p_cuenta_desembolso_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_deuda_id uuid;
  v_movimiento_id uuid;
begin
  if v_admin_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if p_cliente_id is null or p_descripcion is null or coalesce(p_monto_total, 0) <= 0 then
    raise exception 'Cliente, descripcion y monto son obligatorios';
  end if;

  if not exists (
    select 1 from public.clientes
    where id = p_cliente_id and admin_id = v_admin_id
  ) then
    raise exception 'Cliente no valido';
  end if;

  if p_desembolsar and p_cuenta_desembolso_id is null then
    raise exception 'Selecciona la cuenta origen del desembolso';
  end if;

  if p_desembolsar and not exists (
    select 1 from public.cuentas
    where id = p_cuenta_desembolso_id and admin_id = v_admin_id
  ) then
    raise exception 'Cuenta origen no valida';
  end if;

  insert into public.deudas (
    admin_id, cliente_id, descripcion, monto_total, monto_pagado,
    interes, tipo, fecha_inicio, fecha_vencimiento, notas,
    cuenta_desembolso_id, desembolsado
  )
  values (
    v_admin_id, p_cliente_id, p_descripcion, p_monto_total, 0,
    coalesce(p_interes, 0), p_tipo, p_fecha_inicio, p_fecha_vencimiento, p_notas,
    case when p_desembolsar then p_cuenta_desembolso_id else null end,
    p_desembolsar
  )
  returning id into v_deuda_id;

  if p_desembolsar then
    update public.cuentas
    set saldo = saldo - p_monto_total
    where id = p_cuenta_desembolso_id and admin_id = v_admin_id;

    insert into public.movimientos (
      admin_id, tipo, concepto, categoria, cuenta_id, monto, fecha
    )
    values (
      v_admin_id,
      'egreso',
      'Desembolso prestamo: ' || p_descripcion,
      'Prestamo',
      p_cuenta_desembolso_id,
      p_monto_total,
      coalesce(p_fecha_inicio, current_date)
    )
    returning id into v_movimiento_id;

    update public.deudas
    set movimiento_desembolso_id = v_movimiento_id
    where id = v_deuda_id and admin_id = v_admin_id;
  end if;

  return v_deuda_id;
end;
$$;

grant execute on function public.registrar_deuda_con_desembolso(
  uuid, text, numeric, numeric, text, date, date, text, boolean, uuid
) to authenticated;

create or replace function public.actualizar_prestamo(
  p_deuda_id uuid,
  p_cliente_id uuid,
  p_descripcion text,
  p_monto_total numeric,
  p_interes numeric default 0,
  p_cuenta_desembolso_id uuid default null,
  p_fecha_inicio date default current_date,
  p_fecha_vencimiento date default null,
  p_notas text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_old public.deudas%rowtype;
begin
  if v_admin_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if p_cliente_id is null or p_descripcion is null or coalesce(p_monto_total, 0) <= 0 or p_cuenta_desembolso_id is null then
    raise exception 'Cliente, descripcion, monto y cuenta origen son obligatorios';
  end if;

  select * into v_old
  from public.deudas
  where id = p_deuda_id and admin_id = v_admin_id and tipo = 'Préstamo'
  for update;

  if not found then
    raise exception 'Prestamo no encontrado';
  end if;

  if v_old.monto_pagado > p_monto_total then
    raise exception 'El nuevo monto no puede ser menor que lo cobrado';
  end if;

  if v_old.cuenta_desembolso_id is not null then
    update public.cuentas
    set saldo = saldo + v_old.monto_total
    where id = v_old.cuenta_desembolso_id and admin_id = v_admin_id;
  end if;

  update public.cuentas
  set saldo = saldo - p_monto_total
  where id = p_cuenta_desembolso_id and admin_id = v_admin_id;

  update public.deudas
  set cliente_id = p_cliente_id,
      descripcion = p_descripcion,
      monto_total = p_monto_total,
      interes = coalesce(p_interes, 0),
      fecha_inicio = p_fecha_inicio,
      fecha_vencimiento = p_fecha_vencimiento,
      notas = p_notas,
      cuenta_desembolso_id = p_cuenta_desembolso_id,
      desembolsado = true
  where id = p_deuda_id and admin_id = v_admin_id;

  if v_old.movimiento_desembolso_id is not null then
    update public.movimientos
    set concepto = 'Desembolso prestamo: ' || p_descripcion,
        cuenta_id = p_cuenta_desembolso_id,
        monto = p_monto_total,
        fecha = coalesce(p_fecha_inicio, current_date)
    where id = v_old.movimiento_desembolso_id and admin_id = v_admin_id;
  end if;
end;
$$;

create or replace function public.eliminar_prestamo(
  p_deuda_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_old public.deudas%rowtype;
begin
  if v_admin_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  select * into v_old
  from public.deudas
  where id = p_deuda_id and admin_id = v_admin_id and tipo = 'Préstamo'
  for update;

  if not found then
    raise exception 'Prestamo no encontrado';
  end if;

  if v_old.monto_pagado > 0 then
    raise exception 'No puedes eliminar un prestamo con cobros registrados. Elimina primero sus cobros.';
  end if;

  if v_old.cuenta_desembolso_id is not null then
    update public.cuentas
    set saldo = saldo + v_old.monto_total
    where id = v_old.cuenta_desembolso_id and admin_id = v_admin_id;
  end if;

  if v_old.movimiento_desembolso_id is not null then
    delete from public.movimientos
    where id = v_old.movimiento_desembolso_id and admin_id = v_admin_id;
  end if;

  delete from public.deudas
  where id = p_deuda_id and admin_id = v_admin_id;
end;
$$;

grant execute on function public.actualizar_prestamo(uuid, uuid, text, numeric, numeric, uuid, date, date, text) to authenticated;
grant execute on function public.eliminar_prestamo(uuid) to authenticated;

notify pgrst, 'reload schema';
