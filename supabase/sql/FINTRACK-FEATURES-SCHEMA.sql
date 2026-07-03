-- Funcionalidades adicionales para FinTrack Pro.
-- Ejecutar completo en Supabase SQL Editor.

create table if not exists public.presupuestos (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  mes text not null,
  tipo text not null default 'egreso' check (tipo in ('ingreso', 'egreso')),
  tipo_movimiento_id uuid references public.tipos_movimiento(id) on delete set null,
  categoria text,
  monto_limite numeric(12,2) not null default 0,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.metas (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  descripcion text,
  monto_objetivo numeric(12,2) not null default 0,
  monto_actual numeric(12,2) not null default 0,
  fecha_objetivo date,
  estado text not null default 'activa' check (estado in ('activa', 'completada', 'pausada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.auditoria (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  tabla text not null,
  accion text not null,
  registro_id uuid,
  descripcion text,
  datos jsonb,
  created_at timestamptz not null default now()
);

alter table public.movimientos add column if not exists comprobante_url text;
alter table public.pagos add column if not exists comprobante_url text;

alter table public.presupuestos enable row level security;
alter table public.metas enable row level security;
alter table public.auditoria enable row level security;

grant select, insert, update, delete on public.presupuestos to authenticated;
grant select, insert, update, delete on public.metas to authenticated;
grant select, insert on public.auditoria to authenticated;

drop policy if exists "User manages own presupuestos" on public.presupuestos;
create policy "User manages own presupuestos"
on public.presupuestos for all to authenticated
using ((select auth.uid()) = admin_id)
with check ((select auth.uid()) = admin_id);

drop policy if exists "User manages own metas" on public.metas;
create policy "User manages own metas"
on public.metas for all to authenticated
using ((select auth.uid()) = admin_id)
with check ((select auth.uid()) = admin_id);

drop policy if exists "User reads own auditoria" on public.auditoria;
create policy "User reads own auditoria"
on public.auditoria for select to authenticated
using ((select auth.uid()) = admin_id);

drop policy if exists "User inserts own auditoria" on public.auditoria;
create policy "User inserts own auditoria"
on public.auditoria for insert to authenticated
with check ((select auth.uid()) = admin_id);

grant update (comprobante_url) on public.movimientos to authenticated;
grant update (comprobante_url) on public.pagos to authenticated;

notify pgrst, 'reload schema';
