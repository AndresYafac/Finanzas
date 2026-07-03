-- FinTrack Pro - reconstruye permisos y políticas RLS.

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.clientes,
  public.cuentas,
  public.deudas,
  public.pagos
to authenticated;

alter table public.profiles enable row level security;
alter table public.clientes enable row level security;
alter table public.cuentas enable row level security;
alter table public.deudas enable row level security;
alter table public.pagos enable row level security;

drop policy if exists "Admin manages clientes" on public.clientes;
create policy "Admin manages clientes"
on public.clientes for all to authenticated
using (
  auth.uid() = admin_id
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  auth.uid() = admin_id
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "Admin manages cuentas" on public.cuentas;
create policy "Admin manages cuentas"
on public.cuentas for all to authenticated
using (
  auth.uid() = admin_id
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  auth.uid() = admin_id
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "Admin manages deudas" on public.deudas;
create policy "Admin manages deudas"
on public.deudas for all to authenticated
using (
  auth.uid() = admin_id
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  auth.uid() = admin_id
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "Admin manages pagos" on public.pagos;
create policy "Admin manages pagos"
on public.pagos for all to authenticated
using (
  auth.uid() = admin_id
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  auth.uid() = admin_id
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- Resultado esperado: exactamente una fila con role = admin.
select
  u.id,
  u.email,
  p.role
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at;
