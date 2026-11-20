-- Reversión de 0010
DROP INDEX IF EXISTS orders_created_at_payment_idx;
DROP INDEX IF EXISTS orders_created_at_fulfillment_idx;
ALTER TABLE public.products DROP COLUMN IF EXISTS cost_cents;
ALTER TABLE public.order_items DROP COLUMN IF EXISTS cost_cents;
