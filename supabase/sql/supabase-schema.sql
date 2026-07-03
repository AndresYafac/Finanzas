-- FinTrack Pro - esquema para Supabase
-- Ejecuta todo este archivo en Supabase > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null default '',
  apellido text not null default '',
  tipo_doc text not null default 'DNI',
  documento text,
  email_contacto text,
  telefono text,
  direccion text,
  empresa text,
  moneda text not null default 'PEN' check (moneda in ('PEN', 'USD', 'EUR')),
  role text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists role text not null default 'user';
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.profiles add column if not exists tipo_doc text not null default 'DNI';
alter table public.profiles add column if not exists documento text;
alter table public.profiles add column if not exists email_contacto text;
alter table public.profiles add column if not exists direccion text;
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin', 'user'));
alter table public.profiles alter column role set default 'user';

-- Conserva un solo Admin: el usuario más antiguo. Los demás son usuarios normales.
with ranked_users as (
  select p.id, row_number() over (order by u.created_at, p.created_at, p.id) as position
  from public.profiles p
  join auth.users u on u.id = p.id
)
update public.profiles p
set role = case when r.position = 1 then 'admin' else 'user' end
from ranked_users r
where p.id = r.id;

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  user_id uuid unique references auth.users(id) on delete set null,
  nombre text not null,
  apellido text,
  tipo_doc text not null default 'DNI',
  documento text,
  telefono text,
  email text,
  direccion text,
  notas text,
  created_at timestamptz not null default now()
);

alter table public.clientes add column if not exists user_id uuid references auth.users(id) on delete set null;
create unique index if not exists clientes_user_id_unique_idx
  on public.clientes(user_id) where user_id is not null;

create table if not exists public.cuentas (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  banco text not null,
  tipo text,
  numero text,
  cci text,
  moneda text not null default 'PEN' check (moneda in ('PEN', 'USD', 'EUR')),
  saldo numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.deudas (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  descripcion text not null,
  monto_total numeric(14,2) not null check (monto_total > 0),
  monto_pagado numeric(14,2) not null default 0 check (monto_pagado >= 0),
  interes numeric(8,2) not null default 0 check (interes >= 0),
  tipo text not null default 'Préstamo',
  fecha_inicio date,
  fecha_vencimiento date,
  estado text not null default 'al_dia',
  notas text,
  created_at timestamptz not null default now(),
  constraint deuda_fechas_validas check (
    fecha_inicio is null or fecha_vencimiento is null or fecha_vencimiento >= fecha_inicio
  ),
  constraint deuda_pago_valido check (monto_pagado <= monto_total)
);

create table if not exists public.pagos (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  deuda_id uuid not null references public.deudas(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  cuenta_id uuid references public.cuentas(id) on delete set null,
  monto numeric(14,2) not null check (monto > 0),
  metodo text not null default 'Efectivo',
  referencia text,
  fecha date not null,
  notas text,
  created_at timestamptz not null default now()
);

create index if not exists clientes_admin_id_idx on public.clientes(admin_id);
create index if not exists cuentas_admin_id_idx on public.cuentas(admin_id);
create index if not exists deudas_admin_id_idx on public.deudas(admin_id);
create index if not exists deudas_cliente_id_idx on public.deudas(cliente_id);
create index if not exists pagos_admin_id_idx on public.pagos(admin_id);
create index if not exists pagos_deuda_id_idx on public.pagos(deuda_id);
create index if not exists pagos_cliente_id_idx on public.pagos(cliente_id);

alter table public.profiles enable row level security;
alter table public.clientes enable row level security;
alter table public.cuentas enable row level security;
alter table public.deudas enable row level security;
alter table public.pagos enable row level security;

drop policy if exists "Users manage own profile" on public.profiles;
create policy "Users manage own profile"
on public.profiles for all
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- Un usuario puede editar su perfil, pero no puede ascenderse a Admin.
revoke insert, update on public.profiles from authenticated;
grant insert (id, nombre, apellido, tipo_doc, documento, email_contacto, telefono, direccion, empresa, moneda, created_at, updated_at)
  on public.profiles to authenticated;
grant update (nombre, apellido, tipo_doc, documento, email_contacto, telefono, direccion, empresa, moneda, updated_at)
  on public.profiles to authenticated;

drop policy if exists "Admin manages clientes" on public.clientes;
create policy "Admin manages clientes"
on public.clientes for all
to authenticated
using ((select auth.uid()) = admin_id)
with check ((select auth.uid()) = admin_id);

drop policy if exists "Client views own profile" on public.clientes;
create policy "Client views own profile"
on public.clientes for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Admin manages cuentas" on public.cuentas;
create policy "Admin manages cuentas"
on public.cuentas for all
to authenticated
using ((select auth.uid()) = admin_id)
with check ((select auth.uid()) = admin_id);

drop policy if exists "Admin manages deudas" on public.deudas;
create policy "Admin manages deudas"
on public.deudas for all
to authenticated
using ((select auth.uid()) = admin_id)
with check ((select auth.uid()) = admin_id);

drop policy if exists "Client views own deudas" on public.deudas;
create policy "Client views own deudas"
on public.deudas for select
to authenticated
using (
  exists (
    select 1 from public.clientes c
    where c.id = deudas.cliente_id
      and c.user_id = (select auth.uid())
  )
);

drop policy if exists "Admin manages pagos" on public.pagos;
create policy "Admin manages pagos"
on public.pagos for all
to authenticated
using ((select auth.uid()) = admin_id)
with check ((select auth.uid()) = admin_id);

drop policy if exists "Client views own pagos" on public.pagos;
create policy "Client views own pagos"
on public.pagos for select
to authenticated
using (
  exists (
    select 1 from public.clientes c
    where c.id = pagos.cliente_id
      and c.user_id = (select auth.uid())
  )
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_role text;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('fintrack-first-admin'));
  select case
    when exists (select 1 from public.profiles where role = 'admin') then 'user'
    else 'admin'
  end into v_role;

  insert into public.profiles (id, nombre, apellido, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', ''),
    coalesce(new.raw_user_meta_data ->> 'apellido', ''),
    v_role
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.sistema_tiene_admin()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where role = 'admin'
  );
$$;

revoke all on function public.sistema_tiene_admin() from public;
grant execute on function public.sistema_tiene_admin() to anon, authenticated;

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
set search_path = ''
as $$
declare
  v_admin_id uuid := auth.uid();
  v_deuda public.deudas%rowtype;
  v_pago_id uuid;
begin
  if v_admin_id is null then
    raise exception 'Sesión no válida';
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
    select 1 from public.cuentas where id = p_cuenta_id and admin_id = v_admin_id
  ) then
    raise exception 'Cuenta no válida';
  end if;

  insert into public.pagos (
    admin_id, deuda_id, cliente_id, cuenta_id, monto,
    metodo, referencia, fecha, notas
  ) values (
    v_admin_id, p_deuda_id, p_cliente_id, p_cuenta_id, p_monto,
    coalesce(p_metodo, 'Efectivo'), p_referencia, p_fecha, p_notas
  )
  returning id into v_pago_id;

  update public.deudas
  set monto_pagado = monto_pagado + p_monto
  where id = p_deuda_id and admin_id = v_admin_id;

  return v_pago_id;
end;
$$;

create or replace function public.eliminar_pago(p_pago_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_admin_id uuid := auth.uid();
  v_pago public.pagos%rowtype;
begin
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

  delete from public.pagos
  where id = p_pago_id and admin_id = v_admin_id;
end;
$$;

revoke all on function public.registrar_pago(uuid, uuid, uuid, numeric, text, text, date, text) from public;
grant execute on function public.registrar_pago(uuid, uuid, uuid, numeric, text, text, date, text) to authenticated;
revoke all on function public.eliminar_pago(uuid) from public;
grant execute on function public.eliminar_pago(uuid) to authenticated;

-- Crea perfiles para usuarios existentes que todavía no tengan uno.
insert into public.profiles (id, nombre, apellido, role)
select
  id,
  coalesce(raw_user_meta_data ->> 'nombre', ''),
  coalesce(raw_user_meta_data ->> 'apellido', ''),
  'user'
from auth.users
on conflict (id) do nothing;

-- Asegura que el usuario más antiguo sea el único Admin.
with ranked_users as (
  select p.id, row_number() over (order by u.created_at, p.created_at, p.id) as position
  from public.profiles p
  join auth.users u on u.id = p.id
)
update public.profiles p
set role = case when r.position = 1 then 'admin' else 'user' end
from ranked_users r
where p.id = r.id;
