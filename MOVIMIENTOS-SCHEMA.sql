-- Ejecuta esto después de supabase-schema.sql para agregar ingresos y egresos.

create table if not exists public.tipos_movimiento (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('ingreso', 'egreso')),
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (admin_id, tipo, nombre)
);

create table if not exists public.movimientos (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('ingreso', 'egreso')),
  tipo_movimiento_id uuid references public.tipos_movimiento(id) on delete set null,
  concepto text not null,
  categoria text,
  monto numeric(14,2) not null check (monto > 0),
  fecha date not null default current_date,
  notas text,
  created_at timestamptz not null default now()
);

create index if not exists movimientos_admin_id_idx on public.movimientos(admin_id);
create index if not exists movimientos_tipo_idx on public.movimientos(tipo);
create index if not exists movimientos_fecha_idx on public.movimientos(fecha);
create index if not exists tipos_movimiento_admin_id_idx on public.tipos_movimiento(admin_id);

alter table public.movimientos add column if not exists tipo_movimiento_id uuid references public.tipos_movimiento(id) on delete set null;

alter table public.tipos_movimiento enable row level security;
alter table public.movimientos enable row level security;

grant select, insert, update, delete on public.tipos_movimiento to authenticated;
grant select, insert, update, delete on public.movimientos to authenticated;

drop policy if exists "User manages own tipos movimiento" on public.tipos_movimiento;
create policy "User manages own tipos movimiento"
on public.tipos_movimiento for all to authenticated
using (auth.uid() = admin_id)
with check (auth.uid() = admin_id);

drop policy if exists "Admin manages movimientos" on public.movimientos;
drop policy if exists "User manages own movimientos" on public.movimientos;
create policy "User manages own movimientos"
on public.movimientos for all to authenticated
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
