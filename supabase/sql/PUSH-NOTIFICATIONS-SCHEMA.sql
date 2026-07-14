create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  device_name text,
  enabled boolean not null default true,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  debts_enabled boolean not null default true,
  budgets_enabled boolean not null default true,
  goals_enabled boolean not null default true,
  low_balance_enabled boolean not null default true,
  loans_enabled boolean not null default true,
  reminder_hour smallint not null default 9 check (reminder_hour between 0 and 23),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists push_subscriptions_touch_updated_at on public.push_subscriptions;
create trigger push_subscriptions_touch_updated_at
before update on public.push_subscriptions
for each row execute function public.touch_updated_at();

drop trigger if exists push_preferences_touch_updated_at on public.push_preferences;
create trigger push_preferences_touch_updated_at
before update on public.push_preferences
for each row execute function public.touch_updated_at();

alter table public.push_subscriptions enable row level security;
alter table public.push_preferences enable row level security;

drop policy if exists "push_subscriptions_select_own" on public.push_subscriptions;
create policy "push_subscriptions_select_own"
on public.push_subscriptions for select
using (auth.uid() = user_id);

drop policy if exists "push_subscriptions_insert_own" on public.push_subscriptions;
create policy "push_subscriptions_insert_own"
on public.push_subscriptions for insert
with check (auth.uid() = user_id);

drop policy if exists "push_subscriptions_update_own" on public.push_subscriptions;
create policy "push_subscriptions_update_own"
on public.push_subscriptions for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "push_subscriptions_delete_own" on public.push_subscriptions;
create policy "push_subscriptions_delete_own"
on public.push_subscriptions for delete
using (auth.uid() = user_id);

drop policy if exists "push_preferences_select_own" on public.push_preferences;
create policy "push_preferences_select_own"
on public.push_preferences for select
using (auth.uid() = user_id);

drop policy if exists "push_preferences_insert_own" on public.push_preferences;
create policy "push_preferences_insert_own"
on public.push_preferences for insert
with check (auth.uid() = user_id);

drop policy if exists "push_preferences_update_own" on public.push_preferences;
create policy "push_preferences_update_own"
on public.push_preferences for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
