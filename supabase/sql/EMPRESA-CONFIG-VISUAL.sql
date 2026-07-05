-- FinTrack Pro - Configuracion visual de empresa
-- Ejecutar en Supabase SQL Editor si la tabla empresa_config ya existe.

alter table public.empresa_config
add column if not exists primary_color text default '#1d9e75',
add column if not exists theme text default 'light';

alter table public.empresa_config
drop constraint if exists empresa_config_theme_check;

alter table public.empresa_config
add constraint empresa_config_theme_check
check (theme in ('light', 'dark'));
