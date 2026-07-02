alter table public.profiles
  add column if not exists pin_hash text,
  add column if not exists pin_salt text,
  add column if not exists pin_updated_at timestamptz;

comment on column public.profiles.pin_hash is 'Hash SHA-256 del PIN movil de 6 digitos. No guardar PIN en texto plano.';
comment on column public.profiles.pin_salt is 'Salt aleatorio usado para calcular el hash del PIN movil.';
comment on column public.profiles.pin_updated_at is 'Fecha de ultima actualizacion del PIN movil.';
