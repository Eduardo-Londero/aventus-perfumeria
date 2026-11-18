-- ============================================================================
-- AVT-DOM-2026-01 — F1 — Migración 0003: funciones, triggers y privilegios
-- ============================================================================
-- ENTORNO: solo desarrollo/staging verificado. NO PROBADO (PEND DE ENTORNO).
-- Dependencias: 0001_schema_core.sql, 0002_rls_policies.sql
-- Reversión: 20261016_0003_functions_roles.down.sql
--
-- Reglas de propiedad (P1.3.7 B1 corregido — decisión T4):
--   * Toda SECURITY DEFINER: OWNER TO service_role, SET search_path = ''.
--   * REVOKE ALL FROM PUBLIC en cada función.
--   * is_admin(): GRANT EXECUTE a authenticated (lectura, usada por UI/admin
--     futuro y por el trigger de roles); NO a anon.
--   * Escrituras (admin_promote_user): GRANT EXECUTE solo a service_role.
--     El cliente NUNCA invoca RPC de escritura directamente (F3 la usará
--     desde el servidor).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- is_admin(): lectura del rol del usuario autenticado, sin RLS recursivo.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;

-- Propiedad (invariante T4/P1.3.7-B1): SECURITY DEFINER debe ser dueño
-- service_role para que el cuerpo lea profiles sin aplicar RLS recursiva y
-- para que current_user sea predecible. Si el rol no existe (instalación no
-- Supabase), la instalación falla de forma explícita en lugar de quedar
-- silenciosamente con un dueño incorrecto.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    alter function public.is_admin() owner to service_role;
  else
    raise exception 'ROLE_MISSING: service_role no existe; migración 0003 requiere Supabase.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- set_updated_at(): helper de timestamps.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- prevent_role_change(): nadie cambia role salvo service_role vía RPC propia.
-- Cubre tanto UPDATE directo (bloqueado igualmente por RLS) como cualquier
-- ruta indirecta; el único camino válido es admin_promote_user (service_role).
-- ---------------------------------------------------------------------------
create or replace function public.prevent_role_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and current_user <> 'service_role' then
    raise exception 'FORBIDDEN_ROLE_CHANGE'
      using hint = 'Use admin_promote_user via server (service_role).';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_role_change() from public;

create trigger profiles_prevent_role_change
  before update on public.profiles
  for each row execute function public.prevent_role_change();

-- ---------------------------------------------------------------------------
-- admin_promote_user(): única vía de promoción administrativa. Auditada.
-- ---------------------------------------------------------------------------
create or replace function public.admin_promote_user(p_target_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_user <> 'service_role' then
    raise exception 'FORBIDDEN'
      using hint = 'admin_promote_user is server-only (service_role).';
  end if;

  update public.profiles
     set role = 'admin'
   where id = p_target_user;

  insert into public.audit_log (actor, action, entity, entity_id, after_data)
  values (
    'service_role',
    'admin_promote_user',
    'profiles',
    p_target_user::text,
    jsonb_build_object('role', 'admin')
  );
end;
$$;

revoke all on function public.admin_promote_user(uuid) from public;
revoke all on function public.admin_promote_user(uuid) from anon;
revoke all on function public.admin_promote_user(uuid) from authenticated;
grant execute on function public.admin_promote_user(uuid) to service_role;

-- Dueño service_role: con SECURITY DEFINER, current_user dentro de la
-- función = 'service_role', por lo que su propio guard y el trigger
-- prevent_role_change (invoker) permiten la promoción legítima del servidor
-- y bloquean cualquier otro llamante.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    alter function public.admin_promote_user(uuid) owner to service_role;
  else
    raise exception 'ROLE_MISSING: service_role no existe; migración 0003 requiere Supabase.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Audit log: append-only real (trigger; las políticas RLS ya impiden acceso
-- de cliente, pero el trigger protege también contra errores de servicio).
-- ---------------------------------------------------------------------------
create or replace function public.audit_log_append_only()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'AUDIT_LOG_APPEND_ONLY'
    using hint = 'Rows in audit_log cannot be updated or deleted.';
end;
$$;

revoke all on function public.audit_log_append_only() from public;

create trigger audit_log_no_update
  before update or delete on public.audit_log
  for each row execute function public.audit_log_append_only();

-- ---------------------------------------------------------------------------
-- Semilla de store_settings: ELIMINADA en P1.3.37 (decisión P1.3.36 §E.6).
-- store_settings queda VACÍA (0 filas) tras aplicar esta migración.
-- Motivo: los valores previstos (umbral de envío gratis 50.000 / tarifa
-- 2.500 de P1.3.20 §4.8) nunca fueron confirmados como política comercial
-- aprobada del proyecto; no deben insertarse reglas de envío inventadas en
-- la base. La configuración real (umbral, tarifa, zonas, transportistas:
-- Correo Argentino / Andreani / OCA como evaluación futura) se cargará desde
-- el panel de administración cuando exista ese flujo (F2/F3), o mediante una
-- migración de datos con valores reales acordados con el cliente.
-- ---------------------------------------------------------------------------
