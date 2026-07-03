-- Prestamos recibidos: dinero que terceros prestan al usuario.
-- Ejecutar completo en Supabase SQL Editor.

create table if not exists public.prestamos_recibidos (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  acreedor text not null,
  descripcion text not null,
  monto_original numeric(14,2) not null default 0 check (monto_original >= 0),
  saldo_inicial numeric(14,2) not null default 0 check (saldo_inicial >= 0),
  monto_pagado numeric(14,2) not null default 0 check (monto_pagado >= 0),
  interes numeric(8,2) not null default 0,
  cuenta_ingreso_id uuid references public.cuentas(id) on delete set null,
  movimiento_ingreso_id uuid references public.movimientos(id) on delete set null,
  es_antiguo boolean not null default true,
  fecha_inicio date not null default current_date,
  fecha_vencimiento date,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prestamos_recibidos_pago_valido check (monto_pagado <= saldo_inicial)
);

create table if not exists public.pagos_prestamos_recibidos (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  prestamo_id uuid not null references public.prestamos_recibidos(id) on delete cascade,
  cuenta_id uuid references public.cuentas(id) on delete set null,
  monto numeric(14,2) not null check (monto > 0),
  metodo text not null default 'Transferencia',
  referencia text,
  fecha date not null default current_date,
  notas text,
  created_at timestamptz not null default now()
);

alter table public.prestamos_recibidos enable row level security;
alter table public.pagos_prestamos_recibidos enable row level security;

grant select, insert, update, delete on public.prestamos_recibidos to authenticated;
grant select, insert, update, delete on public.pagos_prestamos_recibidos to authenticated;

drop policy if exists "User manages own prestamos recibidos" on public.prestamos_recibidos;
create policy "User manages own prestamos recibidos"
on public.prestamos_recibidos for all to authenticated
using ((select auth.uid()) = admin_id)
with check ((select auth.uid()) = admin_id);

drop policy if exists "User manages own pagos prestamos recibidos" on public.pagos_prestamos_recibidos;
create policy "User manages own pagos prestamos recibidos"
on public.pagos_prestamos_recibidos for all to authenticated
using ((select auth.uid()) = admin_id)
with check ((select auth.uid()) = admin_id);

create or replace function public.registrar_prestamo_recibido(
  p_acreedor text,
  p_descripcion text,
  p_monto_original numeric,
  p_saldo_inicial numeric,
  p_interes numeric default 0,
  p_es_antiguo boolean default true,
  p_cuenta_ingreso_id uuid default null,
  p_fecha_inicio date default current_date,
  p_fecha_vencimiento date default null,
  p_notas text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_id uuid;
  v_movimiento_id uuid;
  v_saldo numeric := coalesce(p_saldo_inicial, p_monto_original, 0);
begin
  if v_admin_id is null then raise exception 'Usuario no autenticado'; end if;
  if p_acreedor is null or p_descripcion is null or coalesce(p_monto_original, 0) <= 0 then
    raise exception 'Acreedor, descripcion y monto son obligatorios';
  end if;
  if v_saldo < 0 or v_saldo > p_monto_original then
    raise exception 'El saldo pendiente no puede superar el monto original';
  end if;
  if not p_es_antiguo and p_cuenta_ingreso_id is null then
    raise exception 'Selecciona la cuenta donde recibiste el dinero';
  end if;
  if p_cuenta_ingreso_id is not null and not exists (
    select 1 from public.cuentas where id = p_cuenta_ingreso_id and admin_id = v_admin_id
  ) then
    raise exception 'Cuenta no valida';
  end if;

  insert into public.prestamos_recibidos (
    admin_id, acreedor, descripcion, monto_original, saldo_inicial,
    interes, cuenta_ingreso_id, es_antiguo, fecha_inicio, fecha_vencimiento, notas
  )
  values (
    v_admin_id, p_acreedor, p_descripcion, p_monto_original, v_saldo,
    coalesce(p_interes, 0), case when p_es_antiguo then null else p_cuenta_ingreso_id end,
    p_es_antiguo, coalesce(p_fecha_inicio, current_date), p_fecha_vencimiento, p_notas
  )
  returning id into v_id;

  if not p_es_antiguo then
    update public.cuentas
    set saldo = saldo + p_monto_original
    where id = p_cuenta_ingreso_id and admin_id = v_admin_id;

    insert into public.movimientos (admin_id, tipo, concepto, categoria, cuenta_id, monto, fecha)
    values (v_admin_id, 'ingreso', 'Prestamo recibido: ' || p_descripcion, 'Prestamo recibido', p_cuenta_ingreso_id, p_monto_original, coalesce(p_fecha_inicio, current_date))
    returning id into v_movimiento_id;

    update public.prestamos_recibidos
    set movimiento_ingreso_id = v_movimiento_id
    where id = v_id and admin_id = v_admin_id;
  end if;

  return v_id;
end;
$$;

create or replace function public.actualizar_prestamo_recibido(
  p_prestamo_id uuid,
  p_acreedor text,
  p_descripcion text,
  p_monto_original numeric,
  p_saldo_inicial numeric,
  p_interes numeric default 0,
  p_es_antiguo boolean default true,
  p_cuenta_ingreso_id uuid default null,
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
  v_old public.prestamos_recibidos%rowtype;
  v_movimiento_id uuid;
  v_saldo numeric := coalesce(p_saldo_inicial, p_monto_original, 0);
begin
  if v_admin_id is null then raise exception 'Usuario no autenticado'; end if;

  select * into v_old
  from public.prestamos_recibidos
  where id = p_prestamo_id and admin_id = v_admin_id
  for update;

  if not found then raise exception 'Prestamo recibido no encontrado'; end if;
  if v_saldo < v_old.monto_pagado then raise exception 'El saldo inicial no puede ser menor que lo pagado'; end if;
  if v_saldo > p_monto_original then raise exception 'El saldo pendiente no puede superar el monto original'; end if;

  if not v_old.es_antiguo and v_old.cuenta_ingreso_id is not null then
    update public.cuentas
    set saldo = saldo - v_old.monto_original
    where id = v_old.cuenta_ingreso_id and admin_id = v_admin_id;
  end if;

  if v_old.movimiento_ingreso_id is not null then
    delete from public.movimientos
    where id = v_old.movimiento_ingreso_id and admin_id = v_admin_id;
  end if;

  v_movimiento_id := null;

  if not p_es_antiguo then
    if p_cuenta_ingreso_id is null then raise exception 'Selecciona la cuenta donde recibiste el dinero'; end if;
    update public.cuentas
    set saldo = saldo + p_monto_original
    where id = p_cuenta_ingreso_id and admin_id = v_admin_id;

    insert into public.movimientos (admin_id, tipo, concepto, categoria, cuenta_id, monto, fecha)
    values (v_admin_id, 'ingreso', 'Prestamo recibido: ' || p_descripcion, 'Prestamo recibido', p_cuenta_ingreso_id, p_monto_original, coalesce(p_fecha_inicio, current_date))
    returning id into v_movimiento_id;
  end if;

  update public.prestamos_recibidos
  set acreedor = p_acreedor,
      descripcion = p_descripcion,
      monto_original = p_monto_original,
      saldo_inicial = v_saldo,
      interes = coalesce(p_interes, 0),
      cuenta_ingreso_id = case when p_es_antiguo then null else p_cuenta_ingreso_id end,
      movimiento_ingreso_id = v_movimiento_id,
      es_antiguo = p_es_antiguo,
      fecha_inicio = coalesce(p_fecha_inicio, current_date),
      fecha_vencimiento = p_fecha_vencimiento,
      notas = p_notas,
      updated_at = now()
  where id = p_prestamo_id and admin_id = v_admin_id;
end;
$$;

create or replace function public.eliminar_prestamo_recibido(p_prestamo_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_old public.prestamos_recibidos%rowtype;
begin
  if v_admin_id is null then raise exception 'Usuario no autenticado'; end if;

  select * into v_old
  from public.prestamos_recibidos
  where id = p_prestamo_id and admin_id = v_admin_id
  for update;

  if not found then raise exception 'Prestamo recibido no encontrado'; end if;
  if v_old.monto_pagado > 0 then raise exception 'No puedes eliminar un prestamo recibido con pagos registrados. Elimina primero sus pagos.'; end if;

  if not v_old.es_antiguo and v_old.cuenta_ingreso_id is not null then
    update public.cuentas
    set saldo = saldo - v_old.monto_original
    where id = v_old.cuenta_ingreso_id and admin_id = v_admin_id;
  end if;

  if v_old.movimiento_ingreso_id is not null then
    delete from public.movimientos
    where id = v_old.movimiento_ingreso_id and admin_id = v_admin_id;
  end if;

  delete from public.prestamos_recibidos
  where id = p_prestamo_id and admin_id = v_admin_id;
end;
$$;

create or replace function public.registrar_pago_prestamo_recibido(
  p_prestamo_id uuid,
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
  v_prestamo public.prestamos_recibidos%rowtype;
  v_pago_id uuid;
begin
  if v_admin_id is null then raise exception 'Usuario no autenticado'; end if;
  if p_monto is null or p_monto <= 0 then raise exception 'El monto debe ser mayor que cero'; end if;

  select * into v_prestamo from public.prestamos_recibidos
  where id = p_prestamo_id and admin_id = v_admin_id
  for update;
  if not found then raise exception 'Prestamo recibido no encontrado'; end if;
  if v_prestamo.monto_pagado + p_monto > v_prestamo.saldo_inicial then raise exception 'El pago supera el saldo pendiente'; end if;
  if p_cuenta_id is not null and not exists (select 1 from public.cuentas where id = p_cuenta_id and admin_id = v_admin_id) then
    raise exception 'Cuenta no valida';
  end if;

  insert into public.pagos_prestamos_recibidos (admin_id, prestamo_id, cuenta_id, monto, metodo, referencia, fecha, notas)
  values (v_admin_id, p_prestamo_id, p_cuenta_id, p_monto, coalesce(p_metodo, 'Transferencia'), p_referencia, coalesce(p_fecha, current_date), p_notas)
  returning id into v_pago_id;

  update public.prestamos_recibidos set monto_pagado = monto_pagado + p_monto where id = p_prestamo_id and admin_id = v_admin_id;
  if p_cuenta_id is not null then
    update public.cuentas set saldo = saldo - p_monto where id = p_cuenta_id and admin_id = v_admin_id;
  end if;

  return v_pago_id;
end;
$$;

create or replace function public.eliminar_pago_prestamo_recibido(p_pago_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_pago public.pagos_prestamos_recibidos%rowtype;
begin
  if v_admin_id is null then raise exception 'Usuario no autenticado'; end if;
  select * into v_pago from public.pagos_prestamos_recibidos where id = p_pago_id and admin_id = v_admin_id for update;
  if not found then raise exception 'Pago no encontrado'; end if;

  update public.prestamos_recibidos set monto_pagado = greatest(0, monto_pagado - v_pago.monto) where id = v_pago.prestamo_id and admin_id = v_admin_id;
  if v_pago.cuenta_id is not null then
    update public.cuentas set saldo = saldo + v_pago.monto where id = v_pago.cuenta_id and admin_id = v_admin_id;
  end if;
  delete from public.pagos_prestamos_recibidos where id = p_pago_id and admin_id = v_admin_id;
end;
$$;

create or replace function public.actualizar_pago_prestamo_recibido(
  p_pago_id uuid,
  p_prestamo_id uuid,
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
  v_old public.pagos_prestamos_recibidos%rowtype;
  v_prestamo public.prestamos_recibidos%rowtype;
begin
  if v_admin_id is null then raise exception 'Usuario no autenticado'; end if;
  if p_monto is null or p_monto <= 0 then raise exception 'El monto debe ser mayor que cero'; end if;

  select * into v_old from public.pagos_prestamos_recibidos where id = p_pago_id and admin_id = v_admin_id for update;
  if not found then raise exception 'Pago no encontrado'; end if;

  update public.prestamos_recibidos set monto_pagado = greatest(0, monto_pagado - v_old.monto) where id = v_old.prestamo_id and admin_id = v_admin_id;
  if v_old.cuenta_id is not null then
    update public.cuentas set saldo = saldo + v_old.monto where id = v_old.cuenta_id and admin_id = v_admin_id;
  end if;

  select * into v_prestamo from public.prestamos_recibidos where id = p_prestamo_id and admin_id = v_admin_id for update;
  if not found then raise exception 'Prestamo recibido no encontrado'; end if;
  if v_prestamo.monto_pagado + p_monto > v_prestamo.saldo_inicial then raise exception 'El pago supera el saldo pendiente'; end if;

  update public.pagos_prestamos_recibidos
  set prestamo_id = p_prestamo_id,
      cuenta_id = p_cuenta_id,
      monto = p_monto,
      metodo = coalesce(p_metodo, 'Transferencia'),
      referencia = p_referencia,
      fecha = coalesce(p_fecha, current_date),
      notas = p_notas
  where id = p_pago_id and admin_id = v_admin_id;

  update public.prestamos_recibidos set monto_pagado = monto_pagado + p_monto where id = p_prestamo_id and admin_id = v_admin_id;
  if p_cuenta_id is not null then
    update public.cuentas set saldo = saldo - p_monto where id = p_cuenta_id and admin_id = v_admin_id;
  end if;
end;
$$;

grant execute on function public.registrar_prestamo_recibido(text, text, numeric, numeric, numeric, boolean, uuid, date, date, text) to authenticated;
grant execute on function public.actualizar_prestamo_recibido(uuid, text, text, numeric, numeric, numeric, boolean, uuid, date, date, text) to authenticated;
grant execute on function public.eliminar_prestamo_recibido(uuid) to authenticated;
grant execute on function public.registrar_pago_prestamo_recibido(uuid, uuid, numeric, text, text, date, text) to authenticated;
grant execute on function public.actualizar_pago_prestamo_recibido(uuid, uuid, uuid, numeric, text, text, date, text) to authenticated;
grant execute on function public.eliminar_pago_prestamo_recibido(uuid) to authenticated;

notify pgrst, 'reload schema';
