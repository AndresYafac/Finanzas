-- Corrige el comportamiento de "Eliminar usuario".
-- Antes admin_eliminar_usuario solo marcaba deleted_at/activo=false.
-- Ahora elimina el usuario real de auth.users.
--
-- Importante:
-- - No permite eliminar el usuario actual.
-- - Al borrar auth.users, Supabase aplica las FK con ON DELETE:
--   profiles se elimina en cascada, user_permissions tambien.
-- - Si ese usuario tiene datos propios con admin_id referenciando auth.users
--   y ON DELETE CASCADE, esos datos tambien se eliminaran.

create or replace function public.admin_eliminar_usuario(
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.es_admin_actual() then
    raise exception 'No autorizado';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'No puedes eliminar tu propio usuario';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'Usuario no encontrado';
  end if;

  delete from auth.users
  where id = p_user_id;
end;
$$;

grant execute on function public.admin_eliminar_usuario(uuid) to authenticated;

notify pgrst, 'reload schema';
