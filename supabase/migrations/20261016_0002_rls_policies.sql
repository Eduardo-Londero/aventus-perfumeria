-- ============================================================================
-- AVT-DOM-2026-01 — F1 — Migración 0002: RLS y políticas
-- ============================================================================
-- ENTORNO: solo desarrollo/staging verificado. NO PROBADO (PEND DE ENTORNO).
-- Dependencias: 20261016_0001_schema_core.sql
-- Reversión: 20261016_0002_rls_policies.down.sql
-- Principio: default-deny. Sin política = sin acceso.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Habilitar RLS en TODAS las tablas
-- ---------------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.addresses           enable row level security;
alter table public.genders             enable row level security;
alter table public.categories          enable row level security;
alter table public.brands              enable row level security;
alter table public.products            enable row level security;
alter table public.product_categories  enable row level security;
alter table public.orders              enable row level security;
alter table public.order_items         enable row level security;
alter table public.order_status_history enable row level security;
alter table public.idempotency_keys    enable row level security;
alter table public.payment_events      enable row level security;
alter table public.audit_log           enable row level security;
alter table public.store_settings      enable row level security;

-- Nota: FORCE no se aplica; service_role (RPC en servidor) BYPASSRLS por rol.

-- ---------------------------------------------------------------------------
-- profiles: lectura propia, actualización propia SIN la columna role
-- (el trigger de 0003 bloquea el cambio de role de cualquier forma).
-- ---------------------------------------------------------------------------
create policy "profiles_self_read"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "profiles_self_update"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- addresses: CRUD de dueño
-- ---------------------------------------------------------------------------
create policy "addresses_owner_select"
  on public.addresses for select
  to authenticated
  using (auth.uid() = user_id);

create policy "addresses_owner_insert"
  on public.addresses for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "addresses_owner_update"
  on public.addresses for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "addresses_owner_delete"
  on public.addresses for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Catálogo: lectura pública de filas activas. Escritura SOLO por servidor
-- (service_role BYPASSRLS); no se crean políticas de escritura para clientes.
-- ---------------------------------------------------------------------------
create policy "genders_public_read"
  on public.genders for select
  to anon, authenticated
  using (is_active = true);

create policy "categories_public_read"
  on public.categories for select
  to anon, authenticated
  using (is_active = true);

create policy "brands_public_read"
  on public.brands for select
  to anon, authenticated
  using (is_active = true);

create policy "products_public_read"
  on public.products for select
  to anon, authenticated
  using (is_active = true);

create policy "product_categories_public_read"
  on public.product_categories for select
  to anon, authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_id and p.is_active = true
  ));

-- ---------------------------------------------------------------------------
-- Pedidos: el cliente SOLO lee los suyos. Sin política de insert/update/delete:
-- la creación ocurre exclusivamente vía RPC con service_role (F3).
-- ---------------------------------------------------------------------------
create policy "orders_owner_read"
  on public.orders for select
  to authenticated
  using (auth.uid() = user_id);

create policy "order_items_owner_read"
  on public.order_items for select
  to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_id and o.user_id = auth.uid()
  ));

create policy "order_status_history_owner_read"
  on public.order_status_history for select
  to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_id and o.user_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- idempotency_keys, payment_events, audit_log: SIN acceso de cliente.
-- Solo service_role (RPC/servidor). No se crea ninguna política = denegado.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- store_settings: lectura pública (la UI estima importes), escritura solo
-- servidor (sin política de escritura para clientes).
-- ---------------------------------------------------------------------------
create policy "store_settings_public_read"
  on public.store_settings for select
  to anon, authenticated
  using (true);

-- ===========================================================================
-- P1.3.37 — Parche de privilegios (aprobado en P1.3.34–P1.3.36)
-- ===========================================================================
-- Las 15 políticas anteriores definen QUÉ filas son visibles; los GRANT/REVOKE
-- siguientes definen SI el rol puede ejecutar la operación en absoluto:
-- en PostgreSQL, RLS sin GRANT = denegado por defecto, y GRANT sin RLS =
-- demasiado permiso. Por eso este bloque va en la misma migración que las
-- políticas (default-deny + mínimo privilegio). Verificado sobre la copia
-- remota de PostgreSQL 17.11 (proyecto xpphnsozqnajfxjqvtci, P1.3.36 §A).
-- NO se usa ALTER DEFAULT PRIVILEGES: las tablas las crea el rol postgres y
-- cada tabla futura deberá recibir privilegios caso por caso tras revisión.
-- Verificación post-aplicación: supabase/tests/negative_tests.sql (N-GRANTS).

-- ---------------------------------------------------------------------------
-- (1) REVOKE de los privilegios heredados del ACL por defecto de postgres
-- ({..., anon=Dxtm, authenticated=Dxtm, service_role=Dxtm}, P1.3.34 §H1):
--   * TRUNCATE no está filtrado por RLS (las políticas NO se aplican a
--     TRUNCATE): ningún rol de aplicación lo necesita.
--   * REFERENCES/TRIGGER/MAINTAIN tampoco los necesitan estos roles; MAINTAIN
--     existe desde PostgreSQL 17, compatible con la 17.11 remota.
-- No se revoca nada al rol postgres (dueño): sus privilegios son inherentes
-- y no revocables.
-- ---------------------------------------------------------------------------
revoke truncate, references, trigger, maintain
  on all tables in schema public
  from anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- (2) anon: SOLO lectura del catálogo público y de la configuración de
-- envío, siempre filtrada por las políticas RLS existentes (filas
-- is_active=true / public read). Ningún privilegio de escritura para anon.
-- ---------------------------------------------------------------------------
grant select on public.genders, public.categories, public.brands,
                 public.products, public.product_categories, public.store_settings
   to anon;

-- ---------------------------------------------------------------------------
-- (3) authenticated: catálogo (igual que anon) + SOLO sus datos, filtrados
-- por las políticas RLS de la sección anterior. Sin privilegios sobre
-- idempotency_keys / payment_events / audit_log (invariante README #5).
-- ---------------------------------------------------------------------------
grant select on public.genders, public.categories, public.brands,
                 public.products, public.product_categories, public.store_settings
   to authenticated;

-- profiles: SELECT propio (política profiles_self_read) y UPDATE POR COLUMNA.
-- Se excluye "role" (refuerzo anti-escalada a nivel de privilegio, capa
-- adicional al trigger prevent_role_change de la migración 0003), "id" (no
-- re-apuntar el perfil) y "created_at" (no retro-fechar). "updated_at" sí se
-- concede porque el trigger set_updated_at la sobrescribe con now() igual.
-- NO se concede INSERT de profiles: el alta de perfiles aún no está
-- implementada ni autorizada (decisión P1.3.36 §E.5; creación vía trigger en
-- auth.users queda para fase posterior).
grant select on public.profiles to authenticated;
grant update (full_name, phone, updated_at) on public.profiles to authenticated;

-- addresses: CRUD del dueño (RLS por user_id + WITH CHECK auth.uid()=user_id).
-- Decisión P1.3.37 §2 (revisión solicitada): INSERT y UPDATE se limitan por
-- columna para excluir id y created_at, de modo que el cliente no decide el
-- identificador ni la fecha de creación (los aportan gen_random_uuid() y
-- now() por defecto). user_id se mantiene en los grants porque WITH CHECK ya
-- impide asignarlo a otro usuario y los flujos F2 podrían reenviarlo.
-- Sin rompimiento: no existe implementación de cliente todavía (F2/F3
-- pendientes); el formulario futuro solo enviará estos campos.
-- Nota: un hipotético "upsert" que enviara id o created_at explícitos
-- fallaría por diseño (privilegio denegado); usar insert/update normales.
grant select on public.addresses to authenticated;
grant insert (user_id, alias, street, city, postal_code, is_default)
   on public.addresses to authenticated;
grant update (user_id, alias, street, city, postal_code, is_default)
   on public.addresses to authenticated;
grant delete on public.addresses to authenticated;

-- Pedidos: SOLO lectura de los propios (políticas orders_owner_read y las
-- subconsultas de order_items / order_status_history). Las altas se harán
-- exclusivamente vía RPC backend con service_role (F3); por eso NO existen
-- grants de escritura para clientes en orders / order_items /
-- order_status_history.
grant select on public.orders, public.order_items, public.order_status_history
   to authenticated;

-- ---------------------------------------------------------------------------
-- (4) service_role: mínimo por tabla y operación (matriz P1.3.35 §4 /
-- P1.3.36 §E.3). service_role es BYPASSRLS: queda eximido de las políticas
-- pero NO de estos GRANT; sin ellos, las funciones de 0003 (is_admin,
-- admin_promote_user) y las futuras RPC de F3 fallarían. Restricciones
-- deliberadas: SIN INSERT en profiles (alta de perfiles pendiente);
-- SIN privilegios sobre payment_events (F4/Mercado Pago postergada);
-- SIN DELETE en orders/order_items/order_status_history/audit_log
-- (append-only / cancelación por cambio de estado, no por borrado);
-- SIN UPDATE en order_items (snapshot inmutable del pedido); addresses solo
-- SELECT (escritura server-side pendiente de diseño); audit_log solo
-- SELECT/INSERT (el trigger audit_log_no_update de 0003 además lo bloquea a
-- nivel de fila).
-- ---------------------------------------------------------------------------
grant select on public.profiles, public.addresses, public.genders,
                 public.categories, public.brands, public.products,
                 public.product_categories, public.orders, public.order_items,
                 public.order_status_history, public.idempotency_keys,
                 public.audit_log, public.store_settings
   to service_role;

grant update on public.profiles to service_role;  -- promoción admin (admin_promote_user)

grant insert, update, delete on public.genders, public.categories,
      public.brands, public.products, public.product_categories
   to service_role;  -- catálogo: panel admin / semillas F2-F3

grant insert, update on public.orders to service_role;        -- RPC create_order_atomic (F3)
grant insert on public.order_items to service_role;           -- snapshot por ítem (F3)
grant insert on public.order_status_history to service_role;  -- transiciones de estado (F3)
grant insert, delete on public.idempotency_keys to service_role;  -- alta y purga por expires_at (F3)
grant select, insert on public.audit_log to service_role;     -- admin_promote_user + auditorías
grant select, insert, update on public.store_settings to service_role;  -- ajustes server-side (sin DELETE)

-- ---------------------------------------------------------------------------
-- (5) Secuencia de audit_log (id bigint GENERATED ALWAYS AS IDENTITY):
-- NO se concede USAGE. Las columnas IDENTITY usan nextval interno sin
-- chequeo de ACL (a diferencia de las columnas serial, que sí requieren
-- USAGE en la secuencia). Si la prueba N-GRANTS-9 (insert como service_role
-- en audit_log) fallara con "permission denied for sequence", conceder:
--   grant usage on sequence public.audit_log_id_seq to service_role;
-- (Prueba preparada en supabase/tests/negative_tests.sql; NO ejecutar aún.)
-- ---------------------------------------------------------------------------
