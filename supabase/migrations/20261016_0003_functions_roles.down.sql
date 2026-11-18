-- Reversión de 20261016_0003_functions_roles.sql

drop trigger if exists audit_log_no_update        on public.audit_log;
drop trigger if exists profiles_prevent_role_change on public.profiles;
drop trigger if exists orders_set_updated_at       on public.orders;
drop trigger if exists products_set_updated_at     on public.products;
drop trigger if exists profiles_set_updated_at     on public.profiles;

drop function if exists public.audit_log_append_only();
drop function if exists public.admin_promote_user(uuid);
drop function if exists public.prevent_role_change();
drop function if exists public.set_updated_at();
drop function if exists public.is_admin();

delete from public.store_settings
 where key in ('shipping_free_threshold_cents', 'shipping_default_cost_cents');
