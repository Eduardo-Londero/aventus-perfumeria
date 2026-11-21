-- ============================================================================
-- Migración 0012 — Configuración de transportistas (enable/disable)
-- ============================================================================
create table if not exists public.shipping_settings (
  provider text primary key,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Valores iniciales
insert into public.shipping_settings (provider, enabled)
values ('andreani', true), ('correo_argentino', true), ('retiro_local', true)
on conflict (provider) do nothing;

-- RLS: solo service_role (el panel admin usa service_role).
alter table public.shipping_settings enable row level security;

create policy "service_role_full_access_shipping_settings"
  on public.shipping_settings
  for all
  to service_role
  using (true)
  with check (true);