-- FinTrack Pro - saldos operativos para billeteras vinculadas.
-- Ejecuta este archivo en Supabase > SQL Editor despues de BILLETERAS-VIRTUALES-SCHEMA.sql.
--
-- Regla:
-- - Si una cuenta es billetera y tiene cuenta_vinculada_id, el saldo real que se afecta
--   es el de la cuenta bancaria vinculada.
-- - La operacion sigue guardando la billetera seleccionada en movimientos/pagos/transferencias
--   para trazabilidad y reportes.

alter table public.cuentas
  add column if not exists tipo_entidad text not null default 'banco',
  add column if not exists cuenta_vinculada_id uuid references public.cuentas(id) on delete set null;

create or replace function public.resolver_cuenta_saldo(
  p_cuenta_id uuid,
  p_admin_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cuenta public.cuentas%rowtype;
  v_cuenta_saldo_id uuid;
begin
  if p_cuenta_id is null then
    return null;
  end if;

  select *
    into v_cuenta
  from public.cuentas
  where id = p_cuenta_id
    and admin_id = p_admin_id;

  if not found then
    raise exception 'Cuenta no encontrada';
  end if;

  v_cuenta_saldo_id := coalesce(v_cuenta.cuenta_vinculada_id, v_cuenta.id);

  if not exists (
    select 1
    from public.cuentas
    where id = v_cuenta_saldo_id
      and admin_id = p_admin_id
  ) then
    raise exception 'La cuenta vinculada no existe o no pertenece al usuario';
  end if;

  return v_cuenta_saldo_id;
end;
$$;

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
  v_cuenta_saldo_id uuid;
begin
  if p_cuenta_id is null then
    return;
  end if;

  if v_admin_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  v_cuenta_saldo_id := public.resolver_cuenta_saldo(p_cuenta_id, v_admin_id);

  if p_tipo = 'ingreso' then
    update public.cuentas
    set saldo = coalesce(saldo, 0) + (p_monto * p_factor)
    where id = v_cuenta_saldo_id
      and admin_id = v_admin_id;
  elsif p_tipo = 'egreso' then
    update public.cuentas
    set saldo = coalesce(saldo, 0) - (p_monto * p_factor)
    where id = v_cuenta_saldo_id
      and admin_id = v_admin_id;
  else
    raise exception 'Tipo de movimiento invalido';
  end if;

  if not found then
    raise exception 'Cuenta no encontrada';
  end if;

  update public.cuentas wallet
  set saldo = bank.saldo,
      moneda = bank.moneda
  from public.cuentas bank
  where wallet.admin_id = v_admin_id
    and wallet.tipo_entidad = 'billetera'
    and wallet.cuenta_vinculada_id = bank.id
    and bank.id = v_cuenta_saldo_id
    and bank.admin_id = v_admin_id;
end;
$$;

create or replace function public.registrar_transferencia(
  p_cuenta_origen_id uuid,
  p_cuenta_destino_id uuid,
  p_tipo_destino text,
  p_banco_destino text,
  p_numero_destino text,
  p_titular_destino text,
  p_monto numeric,
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
  v_origen public.cuentas%rowtype;
  v_destino public.cuentas%rowtype;
  v_origen_saldo_id uuid;
  v_destino_saldo_id uuid;
  v_origen_saldo numeric;
  v_transferencia_id uuid;
begin
  if v_admin_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if p_monto is null or p_monto <= 0 then
    raise exception 'El monto debe ser mayor a cero';
  end if;

  select * into v_origen
  from public.cuentas
  where id = p_cuenta_origen_id and admin_id = v_admin_id;

  if not found then
    raise exception 'Cuenta origen no encontrada';
  end if;

  v_origen_saldo_id := public.resolver_cuenta_saldo(p_cuenta_origen_id, v_admin_id);

  select saldo into v_origen_saldo
  from public.cuentas
  where id = v_origen_saldo_id and admin_id = v_admin_id
  for update;

  if coalesce(v_origen_saldo, 0) < p_monto then
    raise exception 'Saldo insuficiente en la cuenta origen';
  end if;

  if p_tipo_destino = 'propia' then
    if p_cuenta_destino_id is null or p_cuenta_destino_id = p_cuenta_origen_id then
      raise exception 'Selecciona una cuenta destino diferente';
    end if;

    select * into v_destino
    from public.cuentas
    where id = p_cuenta_destino_id and admin_id = v_admin_id;

    if not found then
      raise exception 'Cuenta destino no encontrada';
    end if;

    v_destino_saldo_id := public.resolver_cuenta_saldo(p_cuenta_destino_id, v_admin_id);

    if v_destino_saldo_id = v_origen_saldo_id then
      raise exception 'La cuenta origen y destino usan el mismo saldo vinculado';
    end if;

    if v_destino.moneda <> v_origen.moneda then
      raise exception 'Las cuentas deben tener la misma moneda';
    end if;

    update public.cuentas
    set saldo = coalesce(saldo, 0) + p_monto
    where id = v_destino_saldo_id and admin_id = v_admin_id;
  elsif p_tipo_destino = 'externa' then
    if coalesce(trim(p_banco_destino), '') = '' or coalesce(trim(p_numero_destino), '') = '' then
      raise exception 'Completa banco y numero de destino';
    end if;
  else
    raise exception 'Tipo de destino invalido';
  end if;

  update public.cuentas
  set saldo = coalesce(saldo, 0) - p_monto
  where id = v_origen_saldo_id and admin_id = v_admin_id;

  update public.cuentas wallet
  set saldo = bank.saldo,
      moneda = bank.moneda
  from public.cuentas bank
  where wallet.admin_id = v_admin_id
    and wallet.tipo_entidad = 'billetera'
    and wallet.cuenta_vinculada_id = bank.id
    and bank.admin_id = v_admin_id
    and bank.id in (v_origen_saldo_id, v_destino_saldo_id);

  insert into public.transferencias (
    admin_id, cuenta_origen_id, cuenta_destino_id, tipo_destino,
    banco_destino, numero_destino, titular_destino, moneda, monto, fecha, notas
  )
  values (
    v_admin_id, p_cuenta_origen_id,
    case when p_tipo_destino = 'propia' then p_cuenta_destino_id else null end,
    p_tipo_destino,
    p_banco_destino, p_numero_destino, p_titular_destino,
    v_origen.moneda, p_monto, coalesce(p_fecha, current_date), p_notas
  )
  returning id into v_transferencia_id;

  return v_transferencia_id;
end;
$$;

-- Recalcula el saldo interno de billeteras vinculadas para que no quede un valor oculto desfasado.
-- No mueve dinero. Solo alinea la fila de la billetera con el saldo actual de su banco vinculado.
create or replace function public.sincronizar_saldo_visual_billeteras()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
begin
  if v_admin_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  update public.cuentas wallet
  set saldo = bank.saldo,
      moneda = bank.moneda
  from public.cuentas bank
  where wallet.admin_id = v_admin_id
    and wallet.tipo_entidad = 'billetera'
    and wallet.cuenta_vinculada_id = bank.id
    and bank.admin_id = v_admin_id;
end;
$$;

create table if not exists public.billeteras_vinculadas_reparaciones (
  cuenta_billetera_id uuid primary key references public.cuentas(id) on delete cascade,
  admin_id uuid not null references auth.users(id) on delete cascade,
  cuenta_banco_id uuid not null references public.cuentas(id) on delete cascade,
  delta_movimientos numeric(14,2) not null default 0,
  repaired_at timestamptz not null default now()
);

alter table public.billeteras_vinculadas_reparaciones enable row level security;

grant select, insert on public.billeteras_vinculadas_reparaciones to authenticated;

drop policy if exists "User reads wallet repairs" on public.billeteras_vinculadas_reparaciones;
create policy "User reads wallet repairs"
on public.billeteras_vinculadas_reparaciones for select
to authenticated
using ((select auth.uid()) = admin_id);

create table if not exists public.billeteras_vinculadas_movimientos_reparados (
  movimiento_id uuid primary key references public.movimientos(id) on delete cascade,
  cuenta_billetera_id uuid not null references public.cuentas(id) on delete cascade,
  admin_id uuid not null references auth.users(id) on delete cascade,
  cuenta_banco_id uuid not null references public.cuentas(id) on delete cascade,
  delta_aplicado numeric(14,2) not null default 0,
  repaired_at timestamptz not null default now()
);

alter table public.billeteras_vinculadas_movimientos_reparados enable row level security;

grant select, insert on public.billeteras_vinculadas_movimientos_reparados to authenticated;

drop policy if exists "User reads wallet movement repairs" on public.billeteras_vinculadas_movimientos_reparados;
create policy "User reads wallet movement repairs"
on public.billeteras_vinculadas_movimientos_reparados for select
to authenticated
using ((select auth.uid()) = admin_id);

-- Usar una sola vez si ya registraste ingresos/egresos usando billeteras antes de aplicar este archivo.
-- Toma los movimientos historicos guardados con la billetera, aplica su delta al banco vinculado
-- y deja marcada la billetera para no duplicar el ajuste si vuelves a ejecutar la funcion.
create or replace function public.reparar_movimientos_billeteras_vinculadas()
returns table(cuenta_billetera text, cuenta_banco text, delta_aplicado numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_wallet public.cuentas%rowtype;
  v_bank public.cuentas%rowtype;
  v_delta numeric(14,2);
  v_last_wallet_repair timestamptz;
begin
  if v_admin_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  for v_wallet in
    select *
    from public.cuentas
    where admin_id = v_admin_id
      and tipo_entidad = 'billetera'
      and cuenta_vinculada_id is not null
  loop
    select * into v_bank
    from public.cuentas
    where id = v_wallet.cuenta_vinculada_id
      and admin_id = v_admin_id
    for update;

    if found then
      select max(repaired_at)
      into v_last_wallet_repair
      from public.billeteras_vinculadas_reparaciones
      where cuenta_billetera_id = v_wallet.id
        and admin_id = v_admin_id;

      select coalesce(sum(
        case
          when m.tipo = 'ingreso' then m.monto
          when m.tipo = 'egreso' then -m.monto
          else 0
        end
      ), 0)
      into v_delta
      from public.movimientos m
      where m.admin_id = v_admin_id
        and m.cuenta_id = v_wallet.id
        and (v_last_wallet_repair is null or m.created_at > v_last_wallet_repair)
        and not exists (
          select 1
          from public.billeteras_vinculadas_movimientos_reparados r
          where r.movimiento_id = m.id
        );

      if v_delta <> 0 then
        update public.cuentas
        set saldo = coalesce(saldo, 0) + v_delta
        where id = v_bank.id and admin_id = v_admin_id;
      end if;

      update public.cuentas wallet
      set saldo = bank.saldo,
          moneda = bank.moneda
      from public.cuentas bank
      where wallet.id = v_wallet.id
        and wallet.admin_id = v_admin_id
        and bank.id = v_bank.id
        and bank.admin_id = v_admin_id;

      insert into public.billeteras_vinculadas_movimientos_reparados (
        movimiento_id, cuenta_billetera_id, admin_id, cuenta_banco_id, delta_aplicado
      )
      select
        m.id,
        v_wallet.id,
        v_admin_id,
        v_bank.id,
        case
          when m.tipo = 'ingreso' then m.monto
          when m.tipo = 'egreso' then -m.monto
          else 0
        end
      from public.movimientos m
      where m.admin_id = v_admin_id
        and m.cuenta_id = v_wallet.id
        and (v_last_wallet_repair is null or m.created_at > v_last_wallet_repair)
        and not exists (
          select 1
          from public.billeteras_vinculadas_movimientos_reparados r
          where r.movimiento_id = m.id
        )
      on conflict (movimiento_id) do nothing;

      insert into public.billeteras_vinculadas_reparaciones (
        cuenta_billetera_id, admin_id, cuenta_banco_id, delta_movimientos
      )
      values (v_wallet.id, v_admin_id, v_bank.id, v_delta)
      on conflict (cuenta_billetera_id)
      do update set
        cuenta_banco_id = excluded.cuenta_banco_id,
        delta_movimientos = public.billeteras_vinculadas_reparaciones.delta_movimientos + excluded.delta_movimientos,
        repaired_at = now();

      cuenta_billetera := v_wallet.banco || ' ' || coalesce(v_wallet.tipo, '');
      cuenta_banco := v_bank.banco || ' ' || coalesce(v_bank.tipo, '');
      delta_aplicado := v_delta;
      return next;
    end if;
  end loop;
end;
$$;

grant execute on function public.resolver_cuenta_saldo(uuid, uuid) to authenticated;
grant execute on function public.aplicar_movimiento_saldo(uuid, text, numeric, integer) to authenticated;
grant execute on function public.registrar_transferencia(uuid, uuid, text, text, text, text, numeric, date, text) to authenticated;
grant execute on function public.sincronizar_saldo_visual_billeteras() to authenticated;
grant execute on function public.reparar_movimientos_billeteras_vinculadas() to authenticated;

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

  if p_monto is null or p_monto <= 0 then
    raise exception 'El monto debe ser mayor a cero';
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
  if v_admin_id is null then raise exception 'Usuario no autenticado'; end if;
  if p_monto is null or p_monto <= 0 then raise exception 'El monto debe ser mayor que cero'; end if;

  select * into v_deuda
  from public.deudas
  where id = p_deuda_id and admin_id = v_admin_id
  for update;

  if not found or v_deuda.cliente_id <> p_cliente_id then raise exception 'Deuda no encontrada'; end if;
  if v_deuda.monto_pagado + p_monto > v_deuda.monto_total then raise exception 'El pago supera el saldo pendiente'; end if;

  if p_cuenta_id is not null then
    perform public.resolver_cuenta_saldo(p_cuenta_id, v_admin_id);
  end if;

  insert into public.pagos (admin_id, deuda_id, cliente_id, cuenta_id, monto, metodo, referencia, fecha, notas)
  values (v_admin_id, p_deuda_id, p_cliente_id, p_cuenta_id, p_monto, coalesce(p_metodo, 'Efectivo'), p_referencia, coalesce(p_fecha, current_date), p_notas)
  returning id into v_pago_id;

  update public.deudas
  set monto_pagado = monto_pagado + p_monto
  where id = p_deuda_id and admin_id = v_admin_id;

  perform public.aplicar_movimiento_saldo(p_cuenta_id, 'ingreso', p_monto, 1);

  return v_pago_id;
end;
$$;

create or replace function public.eliminar_pago(p_pago_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_pago public.pagos%rowtype;
begin
  if v_admin_id is null then raise exception 'Usuario no autenticado'; end if;

  select * into v_pago
  from public.pagos
  where id = p_pago_id and admin_id = v_admin_id
  for update;

  if not found then raise exception 'Pago no encontrado'; end if;

  update public.deudas
  set monto_pagado = greatest(0, monto_pagado - v_pago.monto)
  where id = v_pago.deuda_id and admin_id = v_admin_id;

  perform public.aplicar_movimiento_saldo(v_pago.cuenta_id, 'ingreso', v_pago.monto, -1);

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
  if v_admin_id is null then raise exception 'Usuario no autenticado'; end if;
  if p_monto is null or p_monto <= 0 then raise exception 'El monto debe ser mayor que cero'; end if;

  select * into v_old
  from public.pagos
  where id = p_pago_id and admin_id = v_admin_id
  for update;

  if not found then raise exception 'Pago no encontrado'; end if;

  update public.deudas
  set monto_pagado = greatest(0, monto_pagado - v_old.monto)
  where id = v_old.deuda_id and admin_id = v_admin_id;

  perform public.aplicar_movimiento_saldo(v_old.cuenta_id, 'ingreso', v_old.monto, -1);

  select * into v_deuda
  from public.deudas
  where id = p_deuda_id and admin_id = v_admin_id
  for update;

  if not found or v_deuda.cliente_id <> p_cliente_id then raise exception 'Deuda no encontrada'; end if;
  if v_deuda.monto_pagado + p_monto > v_deuda.monto_total then raise exception 'El pago supera el saldo pendiente'; end if;

  if p_cuenta_id is not null then
    perform public.resolver_cuenta_saldo(p_cuenta_id, v_admin_id);
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

  perform public.aplicar_movimiento_saldo(p_cuenta_id, 'ingreso', p_monto, 1);
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

  select * into v_prestamo
  from public.prestamos_recibidos
  where id = p_prestamo_id and admin_id = v_admin_id
  for update;

  if not found then raise exception 'Prestamo recibido no encontrado'; end if;
  if v_prestamo.monto_pagado + p_monto > v_prestamo.saldo_inicial then raise exception 'El pago supera el saldo pendiente'; end if;

  if p_cuenta_id is not null then
    perform public.resolver_cuenta_saldo(p_cuenta_id, v_admin_id);
  end if;

  insert into public.pagos_prestamos_recibidos (admin_id, prestamo_id, cuenta_id, monto, metodo, referencia, fecha, notas)
  values (v_admin_id, p_prestamo_id, p_cuenta_id, p_monto, coalesce(p_metodo, 'Transferencia'), p_referencia, coalesce(p_fecha, current_date), p_notas)
  returning id into v_pago_id;

  update public.prestamos_recibidos
  set monto_pagado = monto_pagado + p_monto
  where id = p_prestamo_id and admin_id = v_admin_id;

  perform public.aplicar_movimiento_saldo(p_cuenta_id, 'egreso', p_monto, 1);

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

  select * into v_pago
  from public.pagos_prestamos_recibidos
  where id = p_pago_id and admin_id = v_admin_id
  for update;

  if not found then raise exception 'Pago no encontrado'; end if;

  update public.prestamos_recibidos
  set monto_pagado = greatest(0, monto_pagado - v_pago.monto)
  where id = v_pago.prestamo_id and admin_id = v_admin_id;

  perform public.aplicar_movimiento_saldo(v_pago.cuenta_id, 'egreso', v_pago.monto, -1);

  delete from public.pagos_prestamos_recibidos
  where id = p_pago_id and admin_id = v_admin_id;
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

  select * into v_old
  from public.pagos_prestamos_recibidos
  where id = p_pago_id and admin_id = v_admin_id
  for update;

  if not found then raise exception 'Pago no encontrado'; end if;

  update public.prestamos_recibidos
  set monto_pagado = greatest(0, monto_pagado - v_old.monto)
  where id = v_old.prestamo_id and admin_id = v_admin_id;

  perform public.aplicar_movimiento_saldo(v_old.cuenta_id, 'egreso', v_old.monto, -1);

  select * into v_prestamo
  from public.prestamos_recibidos
  where id = p_prestamo_id and admin_id = v_admin_id
  for update;

  if not found then raise exception 'Prestamo recibido no encontrado'; end if;
  if v_prestamo.monto_pagado + p_monto > v_prestamo.saldo_inicial then raise exception 'El pago supera el saldo pendiente'; end if;

  if p_cuenta_id is not null then
    perform public.resolver_cuenta_saldo(p_cuenta_id, v_admin_id);
  end if;

  update public.pagos_prestamos_recibidos
  set prestamo_id = p_prestamo_id,
      cuenta_id = p_cuenta_id,
      monto = p_monto,
      metodo = coalesce(p_metodo, 'Transferencia'),
      referencia = p_referencia,
      fecha = coalesce(p_fecha, current_date),
      notas = p_notas
  where id = p_pago_id and admin_id = v_admin_id;

  update public.prestamos_recibidos
  set monto_pagado = monto_pagado + p_monto
  where id = p_prestamo_id and admin_id = v_admin_id;

  perform public.aplicar_movimiento_saldo(p_cuenta_id, 'egreso', p_monto, 1);
end;
$$;

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
  if v_admin_id is null then raise exception 'Usuario no autenticado'; end if;
  if p_cliente_id is null or p_descripcion is null or coalesce(p_monto_total, 0) <= 0 then raise exception 'Cliente, descripcion y monto son obligatorios'; end if;

  if not exists (select 1 from public.clientes where id = p_cliente_id and admin_id = v_admin_id) then
    raise exception 'Cliente no valido';
  end if;

  if p_desembolsar then
    if p_cuenta_desembolso_id is null then raise exception 'Selecciona la cuenta origen del desembolso'; end if;
    perform public.resolver_cuenta_saldo(p_cuenta_desembolso_id, v_admin_id);
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
    perform public.aplicar_movimiento_saldo(p_cuenta_desembolso_id, 'egreso', p_monto_total, 1);

    insert into public.movimientos (admin_id, tipo, concepto, categoria, cuenta_id, monto, fecha)
    values (v_admin_id, 'egreso', 'Desembolso prestamo: ' || p_descripcion, 'Prestamo', p_cuenta_desembolso_id, p_monto_total, coalesce(p_fecha_inicio, current_date))
    returning id into v_movimiento_id;

    update public.deudas
    set movimiento_desembolso_id = v_movimiento_id
    where id = v_deuda_id and admin_id = v_admin_id;
  end if;

  return v_deuda_id;
end;
$$;

grant execute on function public.registrar_pago(uuid, uuid, uuid, numeric, text, text, date, text) to authenticated;
grant execute on function public.eliminar_pago(uuid) to authenticated;
grant execute on function public.actualizar_pago(uuid, uuid, uuid, uuid, numeric, text, text, date, text) to authenticated;
grant execute on function public.registrar_pago_prestamo_recibido(uuid, uuid, numeric, text, text, date, text) to authenticated;
grant execute on function public.actualizar_pago_prestamo_recibido(uuid, uuid, uuid, numeric, text, text, date, text) to authenticated;
grant execute on function public.eliminar_pago_prestamo_recibido(uuid) to authenticated;
grant execute on function public.registrar_deuda_con_desembolso(uuid, text, numeric, numeric, text, date, date, text, boolean, uuid) to authenticated;

notify pgrst, 'reload schema';
