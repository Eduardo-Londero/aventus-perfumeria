-- ============================================================================
-- Migración 0006 — Auth: perfiles automáticos + grants para pedidos
-- ============================================================================
-- Propósito: habilitar Supabase Auth como sistema de login de clientes.
--
--  1. `handle_new_user`: al registrarse un usuario en auth.users se crea
--     automáticamente su fila en public.profiles (1:1), que es la que exige
--     orders.user_id (FK) y donde viven role/full_name/phone.
--     SECURITY DEFINER: el insert corre con privilegios del owner; el propio
--     usuario no necesita (ni tiene) policy de INSERT sobre profiles.
--
--  2. Grant de EXECUTE sobre create_order_atomic a `authenticated`:
--     la migración 0004 lo dejó solo para service_role. El cliente autenticado
--     debe poder crear SU pedido; la RPC usa SECURITY DEFINER + auth.uid()
--     (el servidor decide precios/stock/propietario, nunca el cliente).
--
-- NOTAS:
--   - El bucket de Storage `imagenes` NO se crea acá: lo crea automáticamente
--     el endpoint POST /api/upload con la service_role (idempotente), para no
--     depender de privilegios sobre storage.buckets desde SQL.
--   - Reversión: ver 20261109_0006_auth_profiles_orders.down.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Perfil automático por registro
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_full_name text;
begin
  -- full_name = "name lastName" (los metadatos vienen del formulario de
  -- registro: options.data = { name, lastName, phone }).
  v_full_name := nullif(
    trim(
      coalesce(v_meta->>'name', '') || ' ' || coalesce(v_meta->>'lastName', '')
    ),
    ''
  );

  insert into public.profiles (id, role, full_name, phone, created_at, updated_at)
  values (
    new.id,
    'customer',                       -- role NUNCA editable por el propio usuario (trigger 0003)
    v_full_name,
    nullif(coalesce(v_meta->>'phone', ''), ''),
    now(),
    now()
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        phone     = excluded.phone,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

grant execute on function public.handle_new_user() to postgres;
comment on function public.handle_new_user() is
  'Crea public.profiles al registrarse un usuario en auth.users (Supabase Auth).';

-- ---------------------------------------------------------------------------
-- 2. Pedidos: el cliente autenticado ejecuta la RPC
-- ---------------------------------------------------------------------------
-- 0004 hizo: revoke all ... from public; grant ... to service_role;
-- Acá se habilita explícitamente para clientes autenticados. La función es
-- SECURITY DEFINER: valida precios, stock, dirección y dueño (auth.uid()) en
-- el servidor con search_path fijo.
grant execute on function public.create_order_atomic(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Liberación de stock al cancelar (panel admin, vía service_role)
-- ---------------------------------------------------------------------------
-- Espejo exacto de la liberación que el flujo local hace en
-- src/lib/inventory.ts: se devuelve el stock UNA sola vez por pedido
-- (guarda `stock_released`), de modo que un doble click en "Cancelar" no
-- duplica unidades. SECURITY DEFINiner: corre con privilegios del owner y
-- transaccionaliza el FOR UPDATE del pedido.
create or replace function public.release_order_stock(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order
    from public.orders
   where id = p_order_id
   for update;

  if not found then
    return false;
  end if;
  if v_order.stock_released then
    return false; -- ya se liberó: no duplicar unidades
  end if;

  update public.products p
     set stock = p.stock + i.quantity
    from public.order_items i
   where i.order_id = p_order_id
     and p.id = i.product_id;

  update public.orders
     set stock_released = true,
         updated_at = now()
   where id = p_order_id;

  return true;
end;
$$;

grant execute on function public.release_order_stock(uuid) to service_role;
comment on function public.release_order_stock(uuid) is
  'Devuelve al stock los ítems de un pedido cancelado, exactamente una vez.';
