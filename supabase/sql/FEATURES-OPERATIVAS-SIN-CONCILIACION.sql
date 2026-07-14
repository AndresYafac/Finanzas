-- Funcionalidades operativas nuevas, sin conciliacion bancaria.
-- Ejecutar en Supabase SQL Editor.

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  tipo text not null default 'info',
  titulo text not null,
  mensaje text not null,
  modulo text,
  referencia_id uuid,
  leida boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.monthly_closures (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  mes text not null,
  saldo_cuentas numeric not null default 0,
  total_ingresos numeric not null default 0,
  total_egresos numeric not null default 0,
  total_por_cobrar numeric not null default 0,
  total_por_pagar numeric not null default 0,
  notas text,
  cerrado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(admin_id, mes)
);

create table if not exists public.movement_templates (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  nombre text not null,
  tipo text not null check (tipo in ('ingreso', 'egreso')),
  concepto text,
  categoria text,
  tipo_movimiento_id uuid references public.tipos_movimiento(id) on delete set null,
  cuenta_id uuid references public.cuentas(id) on delete set null,
  monto numeric,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_cash_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  fecha date not null default current_date,
  saldo_inicial numeric not null default 0,
  ingresos numeric not null default 0,
  egresos numeric not null default 0,
  saldo_final numeric not null default 0,
  estado text not null default 'abierta' check (estado in ('abierta', 'cerrada')),
  notas text,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  unique(admin_id, fecha)
);

create table if not exists public.file_attachments (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  module text not null,
  record_id uuid not null,
  bucket text not null default 'comprobantes',
  path text not null,
  file_name text not null,
  file_type text,
  file_size integer,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.category_rules (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  keyword text not null,
  tipo text check (tipo in ('ingreso', 'egreso')),
  categoria text not null,
  tipo_movimiento_id uuid references public.tipos_movimiento(id) on delete set null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_app_notifications_admin_created on public.app_notifications(admin_id, created_at desc);
create index if not exists idx_app_notifications_user_unread on public.app_notifications(user_id, leida);
create index if not exists idx_file_attachments_record on public.file_attachments(module, record_id);
create index if not exists idx_category_rules_admin_keyword on public.category_rules(admin_id, keyword);

alter table public.app_notifications enable row level security;
alter table public.monthly_closures enable row level security;
alter table public.movement_templates enable row level security;
alter table public.daily_cash_sessions enable row level security;
alter table public.file_attachments enable row level security;
alter table public.category_rules enable row level security;

drop policy if exists app_notifications_owner on public.app_notifications;
create policy app_notifications_owner on public.app_notifications
for all using (admin_id = auth.uid() or user_id = auth.uid())
with check (admin_id = auth.uid() or user_id = auth.uid());

drop policy if exists monthly_closures_owner on public.monthly_closures;
create policy monthly_closures_owner on public.monthly_closures
for all using (admin_id = auth.uid())
with check (admin_id = auth.uid());

drop policy if exists movement_templates_owner on public.movement_templates;
create policy movement_templates_owner on public.movement_templates
for all using (admin_id = auth.uid())
with check (admin_id = auth.uid());

drop policy if exists daily_cash_sessions_owner on public.daily_cash_sessions;
create policy daily_cash_sessions_owner on public.daily_cash_sessions
for all using (admin_id = auth.uid())
with check (admin_id = auth.uid());

drop policy if exists file_attachments_owner on public.file_attachments;
create policy file_attachments_owner on public.file_attachments
for all using (admin_id = auth.uid())
with check (admin_id = auth.uid());

drop policy if exists category_rules_owner on public.category_rules;
create policy category_rules_owner on public.category_rules
for all using (admin_id = auth.uid())
with check (admin_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comprobantes',
  'comprobantes',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

drop policy if exists comprobantes_select_owner on storage.objects;
create policy comprobantes_select_owner on storage.objects
for select using (
  bucket_id = 'comprobantes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists comprobantes_insert_owner on storage.objects;
create policy comprobantes_insert_owner on storage.objects
for insert with check (
  bucket_id = 'comprobantes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists comprobantes_delete_owner on storage.objects;
create policy comprobantes_delete_owner on storage.objects
for delete using (
  bucket_id = 'comprobantes'
  and (storage.foldername(name))[1] = auth.uid()::text
);
