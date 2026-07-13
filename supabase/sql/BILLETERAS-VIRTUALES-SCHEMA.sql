-- FinTrack Pro - Billeteras virtuales como cuentas especiales
-- Ejecutar en Supabase SQL Editor antes de usar la nueva version del formulario de cuentas.

alter table public.cuentas
  add column if not exists tipo_entidad text not null default 'banco';

alter table public.cuentas
  add column if not exists cuenta_vinculada_id uuid references public.cuentas(id) on delete set null;

update public.cuentas
set tipo_entidad = case
  when lower(coalesce(banco, '')) ~ '(yape|plin|tunki|mercado pago|mercadopago|paypal)' then 'billetera'
  when lower(coalesce(banco, '')) ~ '(efectivo|cash|caja)' then 'efectivo'
  else 'banco'
end
where tipo_entidad is null
   or tipo_entidad not in ('banco', 'billetera', 'efectivo');

update public.cuentas
set tipo = 'Billetera',
    cci = null
where tipo_entidad = 'billetera';

update public.cuentas
set tipo = 'Caja',
    cci = null
where tipo_entidad = 'efectivo';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cuentas_tipo_entidad_check'
      and conrelid = 'public.cuentas'::regclass
  ) then
    alter table public.cuentas
      add constraint cuentas_tipo_entidad_check
      check (tipo_entidad in ('banco', 'billetera', 'efectivo'));
  end if;
end $$;

create index if not exists cuentas_admin_tipo_entidad_idx
  on public.cuentas(admin_id, tipo_entidad);

create index if not exists cuentas_cuenta_vinculada_idx
  on public.cuentas(cuenta_vinculada_id);

comment on column public.cuentas.tipo_entidad is
  'Clasifica la cuenta como banco, billetera o efectivo para aplicar validaciones y UI especificas.';

comment on column public.cuentas.cuenta_vinculada_id is
  'Cuenta bancaria vinculada a una billetera virtual. Ejemplo: Yape vinculado a BCP, Plin vinculado a Interbank o BBVA.';
