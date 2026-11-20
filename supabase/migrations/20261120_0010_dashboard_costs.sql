-- ============================================================================
-- Migración 0010: soporte para dashboard de análisis (costos + índices)
-- ============================================================================
-- Agrega costo de adquisición a productos (cost_cents) y su snapshot en
-- order_items, para poder calcular rentabilidad SIN inventar valores. Si el
-- costo es NULL, la rentabilidad se muestra como "no disponible".
--
-- Idempotente. Depende de 0001, 0009.
-- ============================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cost_cents bigint CHECK (cost_cents IS NULL OR cost_cents >= 0);

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS cost_cents bigint CHECK (cost_cents IS NULL OR cost_cents >= 0);

-- Índices para agregaciones por fecha (ya existen en orders; se refuerzan)
CREATE INDEX IF NOT EXISTS orders_created_at_payment_idx
  ON public.orders (created_at, payment_status);
CREATE INDEX IF NOT EXISTS orders_created_at_fulfillment_idx
  ON public.orders (created_at, fulfillment_status);

COMMENT ON COLUMN public.products.cost_cents IS
  'Costo de adquisición en centavos. NULL = sin costo registrado (rentabilidad no calculable).';
COMMENT ON COLUMN public.order_items.cost_cents IS
  'Snapshot del costo al momento de la venta (inmutable).';
