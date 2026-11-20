-- ============================================================================
-- Migración 0009: gestión profesional de pedidos (Aventus)
-- ============================================================================
-- Contexto: el esquema 0001 ya tenía orders/order_items/order_status_history y
-- la RPC create_order_atomic. Esta migración EXTENDE (no reemplaza) ese
-- esquema para soportar:
--   - datos del cliente (nombre/email/teléfono) + provincia,
--   - observaciones internas y para el cliente,
--   - pagos detallados (importe abonado, fecha, transacción, notas, quién),
--   - envíos (transporte, tracking, fecha de despacho, estado, notas),
--   - referencia a WhatsApp (para asociar consultas futuras),
--   - descuento,
--   - historial de actividad rico (order_activity_log, append-only),
--   - secuencia para códigos únicos AV-000001...
--   - user_id nullable (pedidos manuales / invitados).
--   - pagos: estado 'partial' agregado a payment_status.
--
-- Idempotente (IF NOT EXISTS / DROP ... IF EXISTS).
-- Depende de: 0001, 0003 (is_admin/set_updated_at), 0006.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. orders: nuevas columnas
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS customer_email text,
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS ship_province text,
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS customer_notes text,
  ADD COLUMN IF NOT EXISTS discount_cents bigint NOT NULL DEFAULT 0
    CHECK (discount_cents >= 0),
  ADD COLUMN IF NOT EXISTS payment_amount_paid_cents bigint NOT NULL DEFAULT 0
    CHECK (payment_amount_paid_cents >= 0),
  ADD COLUMN IF NOT EXISTS payment_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_transaction_ref text,
  ADD COLUMN IF NOT EXISTS payment_notes text,
  ADD COLUMN IF NOT EXISTS payment_updated_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS payment_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipping_carrier text,
  ADD COLUMN IF NOT EXISTS shipping_tracking_code text,
  ADD COLUMN IF NOT EXISTS shipping_dispatched_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipping_status text NOT NULL DEFAULT 'sin_preparar'
    CHECK (shipping_status IN ('sin_preparar','preparando','despachado','en_transito','entregado','problema')),
  ADD COLUMN IF NOT EXISTS shipping_notes text,
  ADD COLUMN IF NOT EXISTS whatsapp_reference text;

-- payment_status: agregar 'partial' (pago parcial)
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('pending','paid','rejected','refunded','expired','discrepancy','partial'));

-- user_id nullable: pedidos manuales / invitados (solo admin los ve por RLS)
ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Secuencia + función para códigos únicos (AV-000001, AV-000002, ...)
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq
  START WITH 100000 INCREMENT BY 1 NO CYCLE;

-- Sincronizar la secuencia con el máximo existente para no repetir códigos.
DO $$
DECLARE
  maxn bigint;
BEGIN
  SELECT COALESCE(MAX(CAST(regexp_replace(order_number, '\D', '', 'g') AS bigint)), 0)
    INTO maxn
    FROM public.orders
    WHERE order_number ~ '^AV-[0-9]+$';
  IF maxn > 0 THEN
    PERFORM setval('public.order_number_seq', GREATEST(maxn, 100000), true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.next_order_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n bigint;
BEGIN
  n := nextval('public.order_number_seq');
  RETURN 'AV-' || lpad(n::text, 6, '0');
END $$;

GRANT EXECUTE ON FUNCTION public.next_order_number() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Historial de actividad rico (append-only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  actor text NOT NULL,            -- 'system' | 'admin:<uuid>' | 'customer:<uuid>'
  event_type text NOT NULL,       -- created, customer_updated, item_added, ...
  field text,                     -- campo modificado (si aplica)
  old_value text,
  new_value text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_activity_log_order_created_idx
  ON public.order_activity_log (order_id, created_at);

ALTER TABLE public.order_activity_log ENABLE ROW LEVEL SECURITY;

-- Clientes leen el historial de sus propios pedidos; admin/service leen todo.
DROP POLICY IF EXISTS "order_activity_log_select_own" ON public.order_activity_log;
CREATE POLICY "order_activity_log_select_own"
  ON public.order_activity_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND o.user_id = auth.uid()
    )
  );

-- Append-only: bloquear UPDATE y DELETE a nivel de trigger (además de grants).
CREATE OR REPLACE FUNCTION public.order_activity_log_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'order_activity_log is append-only';
END $$;

DROP TRIGGER IF EXISTS order_activity_log_no_update ON public.order_activity_log;
CREATE TRIGGER order_activity_log_no_update
  BEFORE UPDATE ON public.order_activity_log
  FOR EACH ROW EXECUTE FUNCTION public.order_activity_log_append_only();

DROP TRIGGER IF EXISTS order_activity_log_no_delete ON public.order_activity_log;
CREATE TRIGGER order_activity_log_no_delete
  BEFORE DELETE ON public.order_activity_log
  FOR EACH ROW EXECUTE FUNCTION public.order_activity_log_append_only();

-- Grants: solo service_role inserta (el panel usa service_role). authenticated solo SELECT (RLS).
REVOKE ALL ON public.order_activity_log FROM public;
GRANT SELECT ON public.order_activity_log TO authenticated, service_role;
GRANT INSERT ON public.order_activity_log TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Índices para búsquedas frecuentes del panel
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_payment_status_idx ON public.orders (payment_status);
CREATE INDEX IF NOT EXISTS orders_fulfillment_status_idx ON public.orders (fulfillment_status);
CREATE INDEX IF NOT EXISTS orders_shipping_status_idx ON public.orders (shipping_status);
CREATE INDEX IF NOT EXISTS orders_order_number_idx ON public.orders (order_number);
CREATE INDEX IF NOT EXISTS orders_customer_name_idx ON public.orders (customer_name);
CREATE INDEX IF NOT EXISTS orders_customer_phone_idx ON public.orders (customer_phone);

-- ---------------------------------------------------------------------------
-- 5. Comentarios
-- ---------------------------------------------------------------------------
COMMENT ON TABLE public.order_activity_log IS
  'Historial de actividad de pedidos. Append-only: no se puede modificar ni borrar.';
COMMENT ON COLUMN public.orders.internal_notes IS
  'Notas internas, solo visibles para administradores.';
COMMENT ON COLUMN public.orders.customer_notes IS
  'Observaciones que eventualmente se podrán compartir con el cliente.';
COMMENT ON COLUMN public.orders.whatsapp_reference IS
  'Identificador para asociar una consulta de WhatsApp con un pedido sin duplicar.';

-- ============================================================================
-- ROLLBACK (manual): ver 20261119_0009_orders_management.down.sql
-- ============================================================================
