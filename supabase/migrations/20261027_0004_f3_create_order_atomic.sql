-- ============================================================================
-- F3 — create_order_atomic (PREPARADO, NO EJECUTADO en esta fase)
-- ============================================================================
-- Estado: archivo local preparado para revisión. NO se ha ejecutado contra el
-- proyecto remoto. Requiere autorización expresa del propietario y respaldo
-- pg_dump previo antes de aplicarse (P1.3.42).
--
-- Propósito: creación transaccional de un pedido con validación server-side
-- de productos, precios, stock, dirección, medio de pago, idempotencia y
-- reserva de inventario. El cliente NO decide precios, stock, propietario ni
-- estado de pago.
--
-- Entrada: un único argumento `payload jsonb` con:
--   items: [{ product_id, quantity, client_price? }]
--   delivery_method: 'retiro' | 'envio'
--   payment_method: 'transferencia' | 'efectivo' | 'mercado_pago'
--   customer: { name, last_name, phone, email, address?, city?, postal_code? }
--   idempotency_key: text (opcional)
--   user_id se toma de auth.uid() (NULL para invitado).
--
-- Salida: jsonb { ok, order_id?, order_number?, error? { code, message } }
-- ============================================================================

create or replace function public.create_order_atomic(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();          -- NULL para invitado
  v_items jsonb := coalesce(payload->'items', '[]'::jsonb);
  v_delivery text := payload->>'delivery_method';
  v_payment text := payload->>'payment_method';
  v_customer jsonb := coalesce(payload->'customer', '{}'::jsonb);
  v_idem_key text := nullif(payload->>'idempotency_key', '');
  v_subtotal bigint := 0;
  v_shipping bigint := 0;
  v_total bigint := 0;
  v_order_id uuid;
  v_order_number text;
  v_now timestamptz := now();
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty integer;
  v_free_threshold bigint := 20000000;  -- 200.000 ARS en centavos (ajustable en store_settings)
  v_shipping_cost bigint := 250000;      -- 2.500 ARS en centavos
  v_existing_order uuid;
  v_price_mismatch boolean := false;
begin
  -- Validación de entrega / pago.
  if v_delivery not in ('retiro','envio') then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code','invalid_input','message','Método de entrega inválido.'));
  end if;
  if v_payment not in ('transferencia','efectivo','mercado_pago') then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code','invalid_payment_method','message','Medio de pago inválido.'));
  end if;

  -- Validación de cliente.
  if coalesce(v_customer->>'name','') = '' or coalesce(v_customer->>'last_name','') = '' or
     coalesce(v_customer->>'phone','') = '' or coalesce(v_customer->>'email','') = '' then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code','invalid_input','message','Datos del cliente incompletos.'));
  end if;
  if v_delivery = 'envio' and (
       coalesce(v_customer->>'address','') = '' or
       coalesce(v_customer->>'city','') = '' or
       coalesce(v_customer->>'postal_code','') = '' ) then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code','shipping_address_required','message','Dirección de envío incompleta.'));
  end if;

  if jsonb_array_length(v_items) = 0 then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code','empty_cart','message','El carrito está vacío.'));
  end if;

  -- Idempotencia (clave opcional). Solo reutiliza si pertenece al mismo usuario.
  if v_idem_key is not null then
    select order_id into v_existing_order
      from public.idempotency_keys
     where key = v_idem_key
       and (user_id = v_user_id or (v_user_id is null and user_id = '00000000-0000-0000-0000-000000000000'::uuid))
     for update;
    if v_existing_order is not null then
      return jsonb_build_object('ok', true, 'order_id', v_existing_order, 'idempotent', true);
    end if;
    -- Si la clave existe para otro usuario → conflicto.
    if exists (select 1 from public.idempotency_keys where key = v_idem_key) then
      return jsonb_build_object('ok', false, 'error', jsonb_build_object('code','idempotency_conflict','message','Clave de idempotencia pertenece a otro usuario.'));
    end if;
  end if;

  -- Validación de ítems + bloqueo de stock (FOR UPDATE).
  for v_item in select * from jsonb_array_elements(v_items) loop
    v_qty := (v_item->>'quantity')::integer;
    if v_qty is null or v_qty < 1 then
      return jsonb_build_object('ok', false, 'error', jsonb_build_object('code','invalid_quantity','message','Cantidad inválida.'));
    end if;

    select * into v_product
      from public.products
     where id = v_item->>'product_id'
     for update;
    if not found then
      return jsonb_build_object('ok', false, 'error', jsonb_build_object('code','product_not_found','message','Producto no encontrado.'));
    end if;
    if not v_product.is_active then
      return jsonb_build_object('ok', false, 'error', jsonb_build_object('code','product_inactive','message','Producto inactivo.'));
    end if;
    if v_product.stock < v_qty then
      return jsonb_build_object('ok', false, 'error', jsonb_build_object('code','insufficient_stock','message','Stock insuficiente.'));
    end if;

    v_subtotal := v_subtotal + v_product.price_cents * v_qty;
    -- client_price se ignora (no confiable); se podría registrar discrepancia.
  end loop;

  -- Envío (autoridad del servidor).
  if v_subtotal >= v_free_threshold then
    v_shipping := 0;
  elsif v_delivery = 'envio' then
    v_shipping := v_shipping_cost;
  else
    v_shipping := 0;
  end if;
  v_total := v_subtotal + v_shipping;

  -- Invitados: el esquema actual exige user_id NOT NULL → profiles.
  -- Hasta que se decida y migre (permitir NULL o cuenta obligatoria), la RPC
  -- no crea pedidos de invitado. Ver docs/INFORME_F3_PERFILES_PEDIDOS.md §3.
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code','guest_not_supported','message','Compra como invitado no soportada hasta decisión de esquema (user_id NOT NULL).'));
  end if;

  -- Número de pedido.
  v_order_number := 'AV-' || (1048 + (select count(*) from public.orders)::integer);

  -- Crear pedido (pago SIEMPRE pending).
  insert into public.orders (
    order_number, user_id, delivery_method, payment_method,
    payment_status, fulfillment_status,
    subtotal_cents, shipping_cents, total_cents,
    ship_street, ship_city, ship_postal_code,
    ship_recipient_name, ship_recipient_phone,
    stock_released, created_at, updated_at
  ) values (
    v_order_number, v_user_id, v_delivery, v_payment,
    'pending', 'awaiting_payment',
    v_subtotal, v_shipping, v_total,
    nullif(v_customer->>'address',''), nullif(v_customer->>'city',''), nullif(v_customer->>'postal_code',''),
    (v_customer->>'name') || ' ' || (v_customer->>'last_name'),
    nullif(v_customer->>'phone',''),
    false, v_now, v_now
  ) returning id into v_order_id;

  -- Ítems (snapshot).
  for v_item in select * from jsonb_array_elements(v_items) loop
    insert into public.order_items (
      order_id, product_id, name, brand_name, image_url, size,
      quantity, unit_price_cents, line_total_cents
    )
    select v_order_id, p.id, p.name, b.name, p.images[1], p.size,
           (v_item->>'quantity')::integer,
           p.price_cents,
           p.price_cents * (v_item->>'quantity')::integer
      from public.products p
      join public.brands b on b.id = p.brand_id
     where p.id = v_item->>'product_id';
  end loop;

  -- Historial inicial.
  insert into public.order_status_history (order_id, actor, payment_status, fulfillment_status, reason, created_at)
  values (v_order_id, coalesce('customer:' || v_user_id::text, 'system'), 'pending', 'awaiting_payment', 'creación del pedido', v_now);

  -- Reserva de stock.
  for v_item in select * from jsonb_array_elements(v_items) loop
    update public.products
       set stock = stock - (v_item->>'quantity')::integer
     where id = v_item->>'product_id';
  end loop;

  -- Idempotencia.
  if v_idem_key is not null then
    insert into public.idempotency_keys (key, user_id, operation, content_hash, order_id, created_at, expires_at)
    values (v_idem_key, coalesce(v_user_id, '00000000-0000-0000-0000-000000000000'::uuid),
            'create_order', md5(v_items::text), v_order_id, v_now, v_now + interval '24 hours')
    on conflict (key) do nothing;
  end if;

  return jsonb_build_object('ok', true, 'order_id', v_order_id, 'order_number', v_order_number);
exception when others then
  -- Rollback automático de la transacción por el motor; devolver error controlado.
  return jsonb_build_object('ok', false, 'error', jsonb_build_object('code','internal_error','message', SQLERRM));
end;
$$;

-- Grants: solo service_role (el servidor). El cliente no ejecuta la RPC directamente.
revoke all on function public.create_order_atomic(jsonb) from public;
grant execute on function public.create_order_atomic(jsonb) to service_role;
