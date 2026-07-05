-- FinTrack Pro - Configuracion visual avanzada
-- Ejecutar en Supabase SQL Editor para persistir las nuevas opciones de apariencia.

alter table public.empresa_config
add column if not exists accent_color text default '#378add',
add column if not exists visual_style text default 'aurora',
add column if not exists surface_style text default 'glass',
add column if not exists density text default 'comfortable';

alter table public.empresa_config
drop constraint if exists empresa_config_visual_style_check;

alter table public.empresa_config
add constraint empresa_config_visual_style_check
check (visual_style in ('aurora', 'minimal', 'finance', 'neon'));

alter table public.empresa_config
drop constraint if exists empresa_config_surface_style_check;

alter table public.empresa_config
add constraint empresa_config_surface_style_check
check (surface_style in ('glass', 'solid', 'bordered'));

alter table public.empresa_config
drop constraint if exists empresa_config_density_check;

alter table public.empresa_config
add constraint empresa_config_density_check
check (density in ('compact', 'comfortable', 'spacious'));
