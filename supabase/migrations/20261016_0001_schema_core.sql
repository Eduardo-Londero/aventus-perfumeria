-- ============================================================================
-- AVT-DOM-2026-01 — F1 — Migración 0001: esquema base
-- ============================================================================
-- Autorización: F1 (16/10/2026). REV-009 abierto.
-- ENTORNO: ejecutar EXCLUSIVAMENTE en proyecto Supabase de desarrollo/staging
-- verificado como no productivo. NO PROBADO en esta fase (PEND DE ENTORNO).
-- Dependencias: ninguna (primera migración).
-- Reversión: ver 20261016_0001_schema_core.down.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- profiles — 1:1 con auth.users. Sin email propio: auth.users es la fuente.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'customer'
    check (role in ('customer', 'admin')),
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Perfil por usuario autenticado. role nunca es editable por el propio usuario (trigger 0003).';

-- ---------------------------------------------------------------------------
-- addresses — direcciones del cliente, RLS de dueño (0002)
-- ---------------------------------------------------------------------------
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  alias text,
  street text not null,
  city text not null,
  postal_code text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index addresses_user_id_idx on public.addresses (user_id);

-- ---------------------------------------------------------------------------
-- Catálogo: genders, categories, brands, products, product_categories
-- Ids TEXT para continuidad con la semilla actual (productos "1".."20").
-- Importes SIEMPRE en centavos enteros (bigint). Autoridad final: PostgreSQL.
-- ---------------------------------------------------------------------------
create table public.genders (
  id text primary key,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.categories (
  id text primary key,
  slug text not null unique,
  name text not null,
  description text,
  image_url text,
  "order" integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.brands (
  id text primary key,
  slug text not null unique,
  name text not null,
  description text,
  image_url text,
  "order" integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id text primary key,
  slug text not null unique,
  name text not null,
  brand_id text not null references public.brands (id),
  gender_id text not null references public.genders (id),
  description text,
  long_description text,
  price_cents bigint not null check (price_cents >= 0),
  previous_price_cents bigint check (previous_price_cents >= 0),
  discount integer check (discount between 0 and 100),
  images text[] not null default '{}',
  size text,
  concentration text,
  olfactory_family text,
  notes_top text[] not null default '{}',
  notes_heart text[] not null default '{}',
  notes_base text[] not null default '{}',
  stock integer not null default 0 check (stock >= 0),
  featured boolean not null default false,
  is_active boolean not null default true,
  is_on_sale boolean not null default false,
  is_new boolean not null default false,
  sold_count integer not null default 0 check (sold_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_brand_idx on public.products (brand_id);
create index products_gender_idx on public.products (gender_id);
create index products_active_idx on public.products (is_active);

create table public.product_categories (
  product_id text not null references public.products (id) on delete cascade,
  category_id text not null references public.categories (id) on delete cascade,
  primary key (product_id, category_id)
);

-- ---------------------------------------------------------------------------
-- Pedidos — payment_status y fulfillment_status separados (AVT-DOM-2026-01).
-- El cliente NO inserta ni actualiza esta tabla: solo la RPC de F3 y service_role.
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid not null references public.profiles (id),
  delivery_method text not null check (delivery_method in ('retiro', 'envio')),
  payment_method text not null
    check (payment_method in ('transferencia', 'efectivo', 'mercado_pago')),
  payment_status text not null default 'pending'
    check (payment_status in
      ('pending', 'paid', 'rejected', 'refunded', 'expired', 'discrepancy')),
  fulfillment_status text not null default 'awaiting_payment'
    check (fulfillment_status in
      ('awaiting_payment', 'processing', 'ready_for_pickup',
       'shipped', 'delivered', 'cancelled')),
  subtotal_cents bigint not null check (subtotal_cents >= 0),
  shipping_cents bigint not null check (shipping_cents >= 0),
  total_cents bigint not null check (total_cents >= 0),
  -- snapshot de entrega (dirección vigente al momento del pedido)
  ship_street text,
  ship_city text,
  ship_postal_code text,
  ship_recipient_name text,
  ship_recipient_phone text,
  -- reserva de stock
  reservation_expires_at timestamptz,
  stock_released boolean not null default false,
  payment_reference text, -- external_reference del proveedor de pago (F4)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- coherencia: dirección obligatoria solo para envío
  constraint orders_envio_requires_address
    check (delivery_method <> 'envio'
           or (ship_street is not null and ship_city is not null
               and ship_postal_code is not null))
);

create index orders_user_idx on public.orders (user_id);
create index orders_payment_status_idx on public.orders (payment_status);
create index orders_reservation_expires_idx
  on public.orders (reservation_expires_at)
  where stock_released = false;

-- snapshot histórico de items: inmutable una vez creado el pedido
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id text not null,
  name text not null,
  brand_name text not null,
  image_url text,
  size text,
  quantity integer not null check (quantity > 0),
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  line_total_cents bigint not null check (line_total_cents >= 0)
);

create index order_items_order_idx on public.order_items (order_id);

-- ---------------------------------------------------------------------------
-- Historial de transiciones de estado — append-only
-- ---------------------------------------------------------------------------
create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  actor text not null,           -- 'system' | 'admin:<uuid>' | 'customer:<uuid>'
  payment_status text,
  fulfillment_status text,
  reason text,
  created_at timestamptz not null default now()
);

create index order_status_history_order_idx
  on public.order_status_history (order_id);

-- ---------------------------------------------------------------------------
-- Claves de idempotencia del checkout — SIN datos personales.
-- ---------------------------------------------------------------------------
create table public.idempotency_keys (
  key text primary key,
  user_id uuid not null,
  operation text not null,
  content_hash text not null,
  order_id uuid not null references public.orders (id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index idempotency_keys_user_idx on public.idempotency_keys (user_id);
create index idempotency_keys_expires_idx on public.idempotency_keys (expires_at);

-- ---------------------------------------------------------------------------
-- Eventos de pago recibidos — registro crudo idempotente (F4 los procesará)
-- ---------------------------------------------------------------------------
create table public.payment_events (
  id text primary key,           -- identificador del evento en el proveedor
  provider text not null default 'mercado_pago',
  payment_id text,
  event_type text,
  raw_payload jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Auditoría — append-only (sin UPDATE/DELETE para ningún rol; trigger 0003)
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor text not null,
  action text not null,
  entity text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  ip inet,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Ajustes de la tienda (umbral/tarifa de envío) — autoridad única del servidor
-- ---------------------------------------------------------------------------
create table public.store_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
