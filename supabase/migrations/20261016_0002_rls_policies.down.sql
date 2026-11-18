-- Reversión de 20261016_0002_rls_policies.sql

drop policy if exists "store_settings_public_read"     on public.store_settings;
drop policy if exists "order_status_history_owner_read" on public.order_status_history;
drop policy if exists "order_items_owner_read"          on public.order_items;
drop policy if exists "orders_owner_read"               on public.orders;
drop policy if exists "product_categories_public_read"  on public.product_categories;
drop policy if exists "products_public_read"            on public.products;
drop policy if exists "brands_public_read"              on public.brands;
drop policy if exists "categories_public_read"          on public.categories;
drop policy if exists "genders_public_read"             on public.genders;
drop policy if exists "addresses_owner_delete"          on public.addresses;
drop policy if exists "addresses_owner_update"          on public.addresses;
drop policy if exists "addresses_owner_insert"          on public.addresses;
drop policy if exists "addresses_owner_select"          on public.addresses;
drop policy if exists "profiles_self_update"            on public.profiles;
drop policy if exists "profiles_self_read"              on public.profiles;

alter table public.store_settings       disable row level security;
alter table public.audit_log            disable row level security;
alter table public.payment_events       disable row level security;
alter table public.idempotency_keys     disable row level security;
alter table public.order_status_history disable row level security;
alter table public.order_items          disable row level security;
alter table public.orders               disable row level security;
alter table public.product_categories   disable row level security;
alter table public.products             disable row level security;
alter table public.brands               disable row level security;
alter table public.categories           disable row level security;
alter table public.genders              disable row level security;
alter table public.addresses            disable row level security;
alter table public.profiles             disable row level security;
