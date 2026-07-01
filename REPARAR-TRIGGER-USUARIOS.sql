-- Reemplaza el trigger antiguo que podía contener ON CONFLICT (user_id).

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_role text;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('fintrack-first-admin')
  );

  select case
    when exists (
      select 1 from public.profiles where role = 'admin'
    ) then 'user'
    else 'admin'
  end into v_role;

  if not exists (
    select 1 from public.profiles where id = new.id
  ) then
    insert into public.profiles (id, nombre, apellido, role)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'nombre', ''),
      coalesce(new.raw_user_meta_data ->> 'apellido', ''),
      v_role
    );
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
