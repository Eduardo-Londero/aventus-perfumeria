-- Reversión de 0009 — gestión profesional de pedidos
DROP TABLE IF EXISTS public.order_activity_log CASCADE;
DROP FUNCTION IF EXISTS public.next_order_number();
DROP SEQUENCE IF EXISTS public.order_number_seq;
ALTER TABLE public.orders DROP COLUMN IF EXISTS customer_name;
ALTER TABLE public.orders DROP COLUMN IF EXISTS customer_email;
ALTER TABLE public.orders DROP COLUMN IF EXISTS customer_phone;
ALTER TABLE public.orders DROP COLUMN IF EXISTS ship_province;
ALTER TABLE public.orders DROP COLUMN IF EXISTS internal_notes;
ALTER TABLE public.orders DROP COLUMN IF EXISTS customer_notes;
ALTER TABLE public.orders DROP COLUMN IF EXISTS discount_cents;
ALTER TABLE public.orders DROP COLUMN IF EXISTS payment_amount_paid_cents;
ALTER TABLE public.orders DROP COLUMN IF EXISTS payment_paid_at;
ALTER TABLE public.orders DROP COLUMN IF EXISTS payment_transaction_ref;
ALTER TABLE public.orders DROP COLUMN IF EXISTS payment_notes;
ALTER TABLE public.orders DROP COLUMN IF EXISTS payment_updated_by;
ALTER TABLE public.orders DROP COLUMN IF EXISTS payment_updated_at;
ALTER TABLE public.orders DROP COLUMN IF EXISTS shipping_carrier;
ALTER TABLE public.orders DROP COLUMN IF EXISTS shipping_tracking_code;
ALTER TABLE public.orders DROP COLUMN IF EXISTS shipping_dispatched_at;
ALTER TABLE public.orders DROP COLUMN IF EXISTS shipping_status;
ALTER TABLE public.orders DROP COLUMN IF EXISTS shipping_notes;
ALTER TABLE public.orders DROP COLUMN IF EXISTS whatsapp_reference;
ALTER TABLE public.orders ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('pending','paid','rejected','refunded','expired','discrepancy'));
