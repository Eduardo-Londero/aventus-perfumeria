-- ============================================================================
-- Migración 0008: tabla banners (CMS de banners promocionales)
-- ============================================================================
-- Contexto: el panel /admin/banners manejaba un mock en memoria
-- (src/app/admin/banners/page.tsx): nada se persistía y ninguna página
-- pública los mostraba. Esta migración crea la tabla que faltaba, siguiendo el
-- mismo patrón que home_sections (0007).
--
-- Campos alineados con el modelo Banner (src/types/cms.ts): id, title,
-- subtitle, image, buttonText, buttonLink, startDate, endDate, isActive,
-- order, type. `button_text`/`button_link` y las fechas van en snake_case y
-- son NULLABLE: sin fecha = el banner siempre está vigente.
--
-- Idempotente (IF NOT EXISTS / DROP ... IF EXISTS).
-- Depende de: 0001 (esquema base), 0003 (set_updated_at), 0007 (patrón).
-- Entorno: proyecto xpphnsozqnajfxjqvtci (autorizado por el propietario).
-- ============================================================================

create table if not exists public.banners (
  id text primary key,
  title text not null,
  subtitle text not null default '',
  image text not null default '',
  button_text text not null default '',
  button_link text not null default '',
  start_date date,
  end_date date,
  is_active boolean not null default true,
  "order" integer not null default 0,
  type text not null default 'promotion'
    check (type in ('promotion','discount','collection','season','launch','campaign')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists banners_order_idx on public.banners ("order");
create index if not exists banners_active_idx on public.banners (is_active);

-- ---------------------------------------------------------------------------
-- RLS — lectura pública (la tienda los muestra), escritura SOLO service_role
-- (la hace el servidor en /api/data/banners).
-- ---------------------------------------------------------------------------
alter table public.banners enable row level security;

drop policy if exists "banners_public_read" on public.banners;
create policy "banners_public_read"
  on public.banners
  for select
  to anon, authenticated
  using (true);

revoke all on public.banners from public;
grant select on public.banners to anon, authenticated;
grant select, insert, update, delete on public.banners to service_role;

-- ---------------------------------------------------------------------------
-- updated_at automático — solo si la función de 0003 existe en el proyecto.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.proname = 'set_updated_at' and n.nspname = 'public'
  ) then
    drop trigger if exists banners_set_updated_at on public.banners;
    create trigger banners_set_updated_at
      before update on public.banners
      for each row execute function public.set_updated_at();
  end if;
end $$;

comment on table public.banners is
  'Banners promocionales del CMS. Escritura solo via /api/data/banners (service_role); lectura pública para la tienda.';
