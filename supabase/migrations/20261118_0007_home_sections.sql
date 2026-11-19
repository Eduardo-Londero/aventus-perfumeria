-- ============================================================================
-- Fase D — Migración 0007: tabla home_sections (CMS del home)
-- ============================================================================
-- Contexto: hasta hoy el panel "Inicio" (src/app/admin/inicio) no tenía dónde
-- persistir: src/lib/db.ts lanzaba guardWrite("dbHomeSections.save") porque el
-- esquema 0001 no tenía tabla de CMS. Las secciones quedaban solo en memoria
-- del navegador y NUNCA llegaban a la página pública (que además renderiza
-- desde src/lib/seed.ts).
--
-- Esta migración materializa la propuesta que ya estaba preparada y comentada
-- en 20261027_0005_f3_home_sections_proposal.sql, usando EXACTAMENTE los
-- campos que existen en HomepageSection (src/types/cms.ts): id, type, title,
-- isActive, order, content?. No se inventan campos de imagen/alt/href.
--
-- Idempotente (IF NOT EXISTS / DROP ... IF EXISTS): se puede ejecutar más de
-- una vez y también sirve para registrar la migración si se aplica con
-- `supabase db query --linked`.
-- Depende de: 0001 (esquema base), 0002 (patrón RLS), 0003 (set_updated_at).
-- Entorno: proyecto xpphnsozqnajfxjqvtci (autorizado por el propietario).
-- ============================================================================

create table if not exists public.home_sections (
  id text primary key,
  type text not null check (type in (
    'hero', 'categories', 'featured', 'offers', 'newArrivals',
    'banner', 'brands', 'about', 'instagram', 'contact'
  )),
  title text not null,
  is_active boolean not null default true,
  "order" integer not null,
  content jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists home_sections_order_idx on public.home_sections ("order");
create index if not exists home_sections_active_idx on public.home_sections (is_active);

-- ---------------------------------------------------------------------------
-- RLS — default-deny con lectura pública (mismo criterio que store_settings:
-- la UI pública necesita leer el orden/activación de las secciones).
-- Escritura SOLO service_role (la hace el servidor en /api/data/*).
-- ---------------------------------------------------------------------------
alter table public.home_sections enable row level security;

drop policy if exists "home_sections_public_read" on public.home_sections;
create policy "home_sections_public_read"
  on public.home_sections
  for select
  to anon, authenticated
  using (true);

-- Privilegios mínimos (patrón del parche de privilegios de 0002).
revoke all on public.home_sections from public;
grant select on public.home_sections to anon, authenticated;
grant select, insert, update, delete on public.home_sections to service_role;

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
    drop trigger if exists home_sections_set_updated_at on public.home_sections;
    create trigger home_sections_set_updated_at
      before update on public.home_sections
      for each row execute function public.set_updated_at();
  end if;
end $$;

comment on table public.home_sections is
  'Secciones del home (CMS): orden y activación que muestra la página principal. Escritura solo via /api/data/home_sections (service_role).';
