-- Reversión de 20261109_0006_auth_profiles_orders.sql
-- NOTA: revocar el grant deja de habilitar pedidos desde el cliente; el
-- trigger se elimina pero los profiles ya creados se conservan (datos).

revoke execute on function public.create_order_atomic(jsonb) from authenticated;

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
