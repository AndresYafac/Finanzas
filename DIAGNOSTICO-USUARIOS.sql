-- FinTrack Pro - diagnóstico de usuarios y perfiles
-- Ejecuta primero la sección 1. La sección 2 repara los perfiles.

-- 1. Ver usuarios, confirmación, rol y vínculo con clientes.
select
  u.email,
  u.created_at as usuario_creado,
  u.email_confirmed_at,
  p.role,
  c.id as cliente_id,
  c.admin_id
from auth.users u
left join public.profiles p on p.id = u.id
left join public.clientes c on c.user_id = u.id
order by u.created_at;

-- 2. Crear perfiles faltantes para usuarios que ya existen.
insert into public.profiles (id, nombre, apellido, role)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'nombre', ''),
  coalesce(u.raw_user_meta_data ->> 'apellido', ''),
  'user'
from auth.users u
where not exists (
  select 1 from public.profiles p where p.id = u.id
);

-- 3. IMPORTANTE:
-- Reemplaza CORREO_ADMIN por el correo que realmente debe ser Admin.
-- Ejemplo: admin@empresa.com
update public.profiles
set role = 'user';

update public.profiles
set role = 'admin'
where id = (
  select id
  from auth.users
  where lower(email) = lower('CORREO_ADMIN')
);

-- 4. Vincular usuarios normales como clientes del Admin.
insert into public.clientes (admin_id, user_id, nombre, apellido, email)
select
  admin.id,
  p.id,
  coalesce(nullif(p.nombre, ''), split_part(coalesce(u.email, ''), '@', 1)),
  p.apellido,
  u.email
from public.profiles p
join auth.users u on u.id = p.id
cross join lateral (
  select id
  from public.profiles
  where role = 'admin'
  limit 1
) admin
where p.role = 'user'
  and not exists (
    select 1 from public.clientes c where c.user_id = p.id
  );

-- 5. Verificar el resultado final.
select
  u.email,
  p.role,
  c.id as cliente_id,
  c.admin_id
from auth.users u
left join public.profiles p on p.id = u.id
left join public.clientes c on c.user_id = u.id
order by u.created_at;
