-- FinTrack Pro - Passkeys / WebAuthn
-- Ejecutar en Supabase > SQL Editor antes de desplegar la funcion webauthn.

create table if not exists public.webauthn_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  counter bigint not null default 0,
  transports text[] not null default '{}',
  device_name text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists webauthn_credentials_user_id_idx
  on public.webauthn_credentials(user_id);

create table if not exists public.webauthn_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge text not null,
  type text not null check (type in ('registration', 'authentication')),
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  created_at timestamptz not null default now()
);

create index if not exists webauthn_challenges_user_id_type_idx
  on public.webauthn_challenges(user_id, type, created_at desc);

alter table public.webauthn_credentials enable row level security;
alter table public.webauthn_challenges enable row level security;

drop policy if exists "Users read own webauthn credentials" on public.webauthn_credentials;
create policy "Users read own webauthn credentials"
on public.webauthn_credentials for select
to authenticated
using ((select auth.uid()) = user_id);

-- Las inserciones/actualizaciones/borrados los realiza la Edge Function con service_role.
revoke insert, update, delete on public.webauthn_credentials from authenticated;
revoke all on public.webauthn_challenges from authenticated;

grant select on public.webauthn_credentials to authenticated;

notify pgrst, 'reload schema';
