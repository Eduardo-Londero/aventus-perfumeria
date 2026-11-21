-- ============================================================================
-- Migración 0013 — Direcciones completas del cliente
-- ============================================================================
alter table public.addresses
  add column if not exists recipient_name text,
  add column if not exists phone text,
  add column if not exists province text,
  add column if not exists street_number text,
  add column if not exists floor_apt text,
  add column if not exists notes text,
  add column if not exists updated_at timestamptz default now();

-- Asegurar alias no nulo
update public.addresses set alias = coalesce(alias, 'Dirección') where alias is null;