-- Reversión de 20261016_0001_schema_core.sql
-- Ejecutar en orden inverso. ADVERTENCIA: destruye datos de las tablas.
-- En entorno con datos reales: usar estrategia _new + migración (P1.3.7 §11).

drop table if exists public.store_settings       cascade;
drop table if exists public.audit_log            cascade;
drop table if exists public.payment_events       cascade;
drop table if exists public.idempotency_keys     cascade;
drop table if exists public.order_status_history cascade;
drop table if exists public.order_items          cascade;
drop table if exists public.orders               cascade;
drop table if exists public.product_categories   cascade;
drop table if exists public.products             cascade;
drop table if exists public.brands               cascade;
drop table if exists public.categories           cascade;
drop table if exists public.genders              cascade;
drop table if exists public.addresses            cascade;
drop table if exists public.profiles             cascade;
