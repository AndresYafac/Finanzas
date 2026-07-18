-- FinTrack Pro - Validacion de correo duplicado en registro.
-- Ejecutar en Supabase SQL Editor.
--
-- Objetivo:
-- - Permitir que el frontend consulte si un correo ya existe antes de registrar.
-- - No expone datos de auth.users; solo devuelve true/false.

drop function if exists public.auth_email_exists(text);

create or replace function public.auth_email_exists(p_email text)
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from auth.users u
    where lower(u.email) = lower(trim(p_email))
  );
$$;

revoke all on function public.auth_email_exists(text) from public;
grant execute on function public.auth_email_exists(text) to anon, authenticated;
