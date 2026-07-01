-- FinTrack Pro - transferencias entre cuentas propias y hacia cuentas externas.
-- Ejecuta este archivo en Supabase > SQL Editor.

create table if not exists public.transferencias (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  cuenta_origen_id uuid references public.cuentas(id) on delete set null,
  cuenta_destino_id uuid references public.cuentas(id) on delete set null,
  tipo_destino text not null check (tipo_destino in ('propia', 'externa')),
  banco_destino text,
  numero_destino text,
  titular_destino text,
  moneda text not null default 'PEN' check (moneda in ('PEN', 'USD', 'EUR')),
  monto numeric(14,2) not null check (monto > 0),
  fecha date not null default current_date,
  notas text,
  created_at timestamptz not null default now()
);

create index if not exists transferencias_admin_id_idx on public.transferencias(admin_id);
create index if not exists transferencias_fecha_idx on public.transferencias(fecha);
create index if not exists transferencias_cuenta_origen_idx on public.transferencias(cuenta_origen_id);

alter table public.transferencias enable row level security;

grant select, insert, update, delete on public.transferencias to authenticated;

drop policy if exists "Admin manages transferencias" on public.transferencias;
create policy "Admin manages transferencias"
on public.transferencias for all
to authenticated
using ((select auth.uid()) = admin_id)
with check ((select auth.uid()) = admin_id);

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
  where id = p_cuenta_origen_id and admin_id = v_admin_id
  for update;

  if not found then
    raise exception 'Cuenta origen no encontrada';
  end if;

  if v_origen.saldo < p_monto then
    raise exception 'Saldo insuficiente en la cuenta origen';
  end if;

  if p_tipo_destino = 'propia' then
    if p_cuenta_destino_id is null or p_cuenta_destino_id = p_cuenta_origen_id then
      raise exception 'Selecciona una cuenta destino diferente';
    end if;

    select * into v_destino
    from public.cuentas
    where id = p_cuenta_destino_id and admin_id = v_admin_id
    for update;

    if not found then
      raise exception 'Cuenta destino no encontrada';
    end if;

    if v_destino.moneda <> v_origen.moneda then
      raise exception 'Las cuentas deben tener la misma moneda';
    end if;

    update public.cuentas
    set saldo = saldo + p_monto
    where id = p_cuenta_destino_id and admin_id = v_admin_id;
  elsif p_tipo_destino = 'externa' then
    if coalesce(trim(p_banco_destino), '') = '' or coalesce(trim(p_numero_destino), '') = '' then
      raise exception 'Completa banco y numero de destino';
    end if;
  else
    raise exception 'Tipo de destino invalido';
  end if;

  update public.cuentas
  set saldo = saldo - p_monto
  where id = p_cuenta_origen_id and admin_id = v_admin_id;

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

grant execute on function public.registrar_transferencia(uuid, uuid, text, text, text, text, numeric, date, text) to authenticated;

notify pgrst, 'reload schema';
