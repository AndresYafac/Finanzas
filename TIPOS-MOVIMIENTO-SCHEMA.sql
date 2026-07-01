-- FinTrack Pro - catálogos de tipos para ingresos y egresos.

create table if not exists public.tipos_movimiento (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('ingreso', 'egreso')),
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (admin_id, tipo, nombre)
);

alter table public.movimientos
  add column if not exists tipo_movimiento_id uuid references public.tipos_movimiento(id) on delete set null;

create index if not exists tipos_movimiento_admin_id_idx on public.tipos_movimiento(admin_id);
alter table public.tipos_movimiento enable row level security;
grant select, insert, update, delete on public.tipos_movimiento to authenticated;

drop policy if exists "User manages own tipos movimiento" on public.tipos_movimiento;
create policy "User manages own tipos movimiento"
on public.tipos_movimiento for all to authenticated
using (auth.uid() = admin_id)
with check (auth.uid() = admin_id);

insert into public.tipos_movimiento (admin_id, tipo, nombre)
select auth.uid(), tipo, nombre
from (
  values
    ('ingreso', 'Pago empresa'),
    ('ingreso', 'Pago extra'),
    ('ingreso', 'Otros ingresos'),
    ('egreso', 'Pago proveedor'),
    ('egreso', 'Servicios'),
    ('egreso', 'Plataformas'),
    ('egreso', 'Otros egresos')
) as defaults(tipo, nombre)
where auth.uid() is not null
on conflict (admin_id, tipo, nombre) do nothing;
