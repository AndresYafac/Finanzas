-- FinTrack Pro - todos los usuarios gestionan sus propios datos.
-- El rol admin queda reservado para ver Configuración en la app.

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.clientes,
  public.cuentas,
  public.deudas,
  public.pagos
to authenticated;

do $$
begin
  if to_regclass('public.movimientos') is not null then
    grant select, insert, update, delete on public.movimientos to authenticated;
  end if;
end $$;

alter table public.clientes enable row level security;
alter table public.cuentas enable row level security;
alter table public.deudas enable row level security;
alter table public.pagos enable row level security;

drop policy if exists "Admin manages clientes" on public.clientes;
drop policy if exists "User manages own clientes" on public.clientes;
create policy "User manages own clientes"
on public.clientes for all to authenticated
using (auth.uid() = admin_id)
with check (auth.uid() = admin_id);

drop policy if exists "Admin manages cuentas" on public.cuentas;
drop policy if exists "User manages own cuentas" on public.cuentas;
create policy "User manages own cuentas"
on public.cuentas for all to authenticated
using (auth.uid() = admin_id)
with check (auth.uid() = admin_id);

drop policy if exists "Admin manages deudas" on public.deudas;
drop policy if exists "User manages own deudas" on public.deudas;
create policy "User manages own deudas"
on public.deudas for all to authenticated
using (auth.uid() = admin_id)
with check (auth.uid() = admin_id);

drop policy if exists "Admin manages pagos" on public.pagos;
drop policy if exists "User manages own pagos" on public.pagos;
create policy "User manages own pagos"
on public.pagos for all to authenticated
using (auth.uid() = admin_id)
with check (auth.uid() = admin_id);

do $$
begin
  if to_regclass('public.movimientos') is not null then
    execute 'alter table public.movimientos enable row level security';
    execute 'drop policy if exists "Admin manages movimientos" on public.movimientos';
    execute 'drop policy if exists "User manages own movimientos" on public.movimientos';
    execute 'create policy "User manages own movimientos"
      on public.movimientos for all to authenticated
      using (auth.uid() = admin_id)
      with check (auth.uid() = admin_id)';
  end if;
end $$;
