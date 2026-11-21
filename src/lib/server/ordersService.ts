/**
 * Gestión de pedidos desde el panel administrativo (Fase E)
 * =========================================================
 * Creación MANUAL de pedidos (no se crean desde el checkout: el checkout
 * solo abre WhatsApp). Reserva/libera stock, genera código único AV-000001,
 * registra historial (order_status_history + order_activity_log) y expone
 * consultas paginadas/filtradas para el panel.
 *
 * Todo corre con service_role (cookie de admin verificada en la ruta). Los
 * clientes/visitantes nunca tocan estos endpoints.
 */

import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { mapOrderRow, centsToPesos, pesosToCents } from "@/lib/orderMapping";
import { sendEmail } from "@/lib/server/emailService";
import { orderReceivedEmail, orderShippedEmail, orderCancelledEmail } from "@/lib/server/emailTemplates";
import type { Order, OrderStatus } from "@/types";
import type {
  DeliveryMethod,
  PaymentMethod,
  PaymentStatus,
  FulfillmentStatus,
  ShippingStatus,
} from "@/types/domain";

// ---------------------------------------------------------------------------
// Tipos de entrada
// ---------------------------------------------------------------------------

export interface ManualOrderItemInput {
  productId: string;
  quantity: number;
}

export interface ManualOrderInput {
  customer: {
    name: string;
    lastName: string;
    phone: string;
    email?: string;
    address?: string;
    city?: string;
    province?: string;
    postalCode?: string;
  };
  deliveryMethod: DeliveryMethod;
  paymentMethod: PaymentMethod;
  items: ManualOrderItemInput[];
  discount?: number; // en pesos
  shippingCost?: number; // en pesos (0 = gratis)
  internalNotes?: string;
  customerNotes?: string;
  whatsappReference?: string;
}

export interface OrderFilters {
  search?: string;
  paymentStatus?: string;
  shippingStatus?: string;
  fulfillmentStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: "created_at" | "total_cents";
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nowIso(): string {
  return new Date().toISOString();
}

function domainToDbStatus(status: OrderStatus, currentPayment?: string): { payment_status: string; fulfillment_status: string } {
  switch (status) {
    case "no-concretado":
      return { payment_status: "pending", fulfillment_status: "awaiting_payment" };
    case "confirmado":
      return { payment_status: "paid", fulfillment_status: "processing" };
    case "enviado":
      return { payment_status: "paid", fulfillment_status: "shipped" };
    case "entregado":
      return { payment_status: "paid", fulfillment_status: "delivered" };
    case "cancelado": {
      const paid =
        currentPayment === "paid" ||
        currentPayment === "refunded" ||
        currentPayment === "discrepancy" ||
        currentPayment === "partial";
      return {
        payment_status: paid ? "refunded" : "expired",
        fulfillment_status: "cancelled",
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Creación manual
// ---------------------------------------------------------------------------

export async function createManualOrder(
  input: ManualOrderInput,
  actor: string
): Promise<Order> {
  const admin = getSupabaseAdmin();

  // 1. Validar y snapshotear productos
  const productIds = input.items.map((i) => i.productId);
  const { data: products, error: pErr } = await admin
    .from("products")
    .select("id, name, brand_id, brand_name, image, size, price_cents, stock, is_active")
    .in("id", productIds);
  if (pErr) throw new Error(`No se pudieron leer los productos: ${pErr.message}`);

  const byId = new Map((products ?? []).map((p: any) => [p.id, p]));
  const itemRows: any[] = [];
  let subtotalCents = 0;

  for (const it of input.items) {
    const p = byId.get(it.productId);
    if (!p) throw new Error(`Producto no encontrado: ${it.productId}`);
    if (!p.is_active) throw new Error(`El producto "${p.name}" está inactivo.`);
    const qty = Math.max(1, Math.floor(it.quantity || 1));
    if (qty > (p.stock ?? 0)) {
      throw new Error(`Stock insuficiente para "${p.name}" (disponible: ${p.stock}).`);
    }
    const unitPrice = p.price_cents ?? 0;
    const lineTotal = unitPrice * qty;
    subtotalCents += lineTotal;
    itemRows.push({
      product_id: p.id,
      name: p.name,
      brand_name: p.brand_name ?? p.brand_id ?? "",
      image_url: Array.isArray(p.image) ? p.image[0] : (p.image ?? null),
      size: p.size ?? null,
      quantity: qty,
      unit_price_cents: unitPrice,
      line_total_cents: lineTotal,
    });
  }

  if (itemRows.length === 0) throw new Error("El pedido debe tener al menos un producto.");

  // 2. Código único
  const { data: numData, error: numErr } = await admin.rpc("next_order_number");
  if (numErr) throw new Error(`No se pudo generar el código: ${numErr.message}`);
  const orderNumber = numData as string;

  // 3. Envío
  const deliveryMethod = input.deliveryMethod;
  const shippingCents =
    deliveryMethod === "envio" ? pesosToCents(input.shippingCost ?? 2500) : 0;
  // envío gratis si subtotal >= 200000 ARS
  const freeShipping = deliveryMethod === "envio" && subtotalCents >= 20000000;
  const finalShipping = freeShipping ? 0 : shippingCents;

  const discountCents = pesosToCents(input.discount ?? 0);
  const totalCents = Math.max(0, subtotalCents + finalShipping - discountCents);

  // 4. Insertar order
  const customerName = `${input.customer.name} ${input.customer.lastName}`.trim();
  const orderPayload: any = {
    order_number: orderNumber,
    user_id: null,
    delivery_method: deliveryMethod,
    payment_method: input.paymentMethod,
    payment_status: "pending",
    fulfillment_status: "awaiting_payment",
    subtotal_cents: subtotalCents,
    shipping_cents: finalShipping,
    discount_cents: discountCents,
    total_cents: totalCents,
    ship_street: input.customer.address ?? null,
    ship_city: input.customer.city ?? null,
    ship_province: input.customer.province ?? null,
    ship_postal_code: input.customer.postalCode ?? null,
    ship_recipient_name: customerName,
    ship_recipient_phone: input.customer.phone,
    customer_name: customerName,
    customer_email: input.customer.email ?? null,
    customer_phone: input.customer.phone,
    internal_notes: input.internalNotes ?? null,
    customer_notes: input.customerNotes ?? null,
    whatsapp_reference: input.whatsappReference ?? null,
    shipping_status: "sin_preparar",
    stock_released: false,
  };

  const { data: orderRow, error: oErr } = await admin
    .from("orders")
    .insert(orderPayload)
    .select("*")
    .single();
  if (oErr) throw new Error(`No se pudo crear el pedido: ${oErr.message}`);

  const orderId = orderRow.id;

  // 5. Insertar items
  const itemsToInsert = itemRows.map((r) => ({ ...r, order_id: orderId }));
  const { error: iErr } = await admin.from("order_items").insert(itemsToInsert);
  if (iErr) {
    // compensación: borrar el pedido huérfano
    await admin.from("orders").delete().eq("id", orderId);
    throw new Error(`No se pudieron guardar los items: ${iErr.message}`);
  }

  // 6. Reservar stock
  for (const it of input.items) {
    const p = byId.get(it.productId);
    const qty = Math.max(1, Math.floor(it.quantity || 1));
    const { error: sErr } = await admin
      .from("products")
      .update({ stock: (p.stock ?? 0) - qty, sold_count: (p.sold_count ?? 0) + qty })
      .eq("id", it.productId);
    if (sErr) console.error("stock reserve error", sErr.message);
  }

  // 7. Historial de estado (order_status_history)
  await admin.from("order_status_history").insert({
    order_id: orderId,
    actor,
    payment_status: "pending",
    fulfillment_status: "awaiting_payment",
    reason: "Pedido creado manualmente",
  });

  // 8. Actividad
  await admin.from("order_activity_log").insert({
    order_id: orderId,
    actor,
    event_type: "created",
    metadata: { orderNumber, itemCount: itemRows.length, totalCents: totalCents },
  });

  // 9. Email de pedido recibido (si hay email)
  if (input.customer.email) {
    const tpl = orderReceivedEmail({
      orderNumber,
      customerName: customerName,
      customerEmail: input.customer.email,
      total: centsToPesos(totalCents).toLocaleString("es-AR", { style: "currency", currency: "ARS" }),
      items: itemRows.map((r: any) => ({
        name: r.name,
        quantity: r.quantity,
        subtotal: centsToPesos(r.line_total_cents).toLocaleString("es-AR", { style: "currency", currency: "ARS" }),
      })),
    });
    void sendEmail({ to: input.customer.email, subject: tpl.subject, html: tpl.html }).catch(() => undefined);
  }

  // 10. Re-leer con items e historial
  const { data: full } = await admin
    .from("orders")
    .select("*, order_items(*), order_status_history(*)")
    .eq("id", orderId)
    .single();

  return mapOrderRow(full as any, input.customer.email ?? "");
}

// ---------------------------------------------------------------------------
// Actualización (pago, envío, notas, estado, items)
// ---------------------------------------------------------------------------

export interface OrderUpdateInput {
  status?: OrderStatus;
  customer?: {
    name?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    province?: string;
    postalCode?: string;
  };
  payment?: {
    status?: PaymentStatus;
    amountPaid?: number; // pesos
    transactionRef?: string;
    notes?: string;
  };
  shipping?: {
    carrier?: string;
    trackingCode?: string;
    status?: ShippingStatus;
    notes?: string;
    dispatchedAt?: string;
  };
  internalNotes?: string;
  customerNotes?: string;
  discount?: number; // pesos
  shippingCost?: number; // pesos
  items?: ManualOrderItemInput[]; // reemplaza todos los items
  whatsappReference?: string;
}

export async function updateOrder(
  orderNumber: string,
  input: OrderUpdateInput,
  actor: string
): Promise<Order> {
  const admin = getSupabaseAdmin();

  // Leer pedido actual
  const { data: current, error: cErr } = await admin
    .from("orders")
    .select("*, order_items(*)")
    .eq("order_number", orderNumber)
    .single();
  if (cErr || !current) throw new Error("Pedido no encontrado.");

  const orderId = current.id;
  const patch: any = {};
  const activity: any[] = [];

  // Cliente
  if (input.customer) {
    const c = input.customer;
    const newName = c.name ?? current.customer_name?.split(" ")[0] ?? "";
    const newLast = c.lastName ?? current.customer_name?.split(" ").slice(1).join(" ") ?? "";
    const fullName = `${newName} ${newLast}`.trim() || current.customer_name;
    if (fullName !== current.customer_name) {
      patch.customer_name = fullName;
      patch.ship_recipient_name = fullName;
      activity.push({ event_type: "customer_updated", field: "name", old_value: current.customer_name, new_value: fullName });
    }
    if (c.phone !== undefined && c.phone !== current.customer_phone) {
      patch.customer_phone = c.phone;
      patch.ship_recipient_phone = c.phone;
      activity.push({ event_type: "customer_updated", field: "phone", old_value: current.customer_phone, new_value: c.phone });
    }
    if (c.email !== undefined && c.email !== current.customer_email) {
      patch.customer_email = c.email;
      activity.push({ event_type: "customer_updated", field: "email", old_value: current.customer_email, new_value: c.email });
    }
    if (c.address !== undefined && c.address !== current.ship_street) {
      patch.ship_street = c.address;
      activity.push({ event_type: "customer_updated", field: "address", old_value: current.ship_street, new_value: c.address });
    }
    if (c.city !== undefined && c.city !== current.ship_city) {
      patch.ship_city = c.city;
      activity.push({ event_type: "customer_updated", field: "city", old_value: current.ship_city, new_value: c.city });
    }
    if (c.province !== undefined && c.province !== current.ship_province) {
      patch.ship_province = c.province;
      activity.push({ event_type: "customer_updated", field: "province", old_value: current.ship_province, new_value: c.province });
    }
    if (c.postalCode !== undefined && c.postalCode !== current.ship_postal_code) {
      patch.ship_postal_code = c.postalCode;
      activity.push({ event_type: "customer_updated", field: "postal_code", old_value: current.ship_postal_code, new_value: c.postalCode });
    }
  }

  // Pago
  if (input.payment) {
    const pay = input.payment;
    if (pay.status !== undefined && pay.status !== current.payment_status) {
      patch.payment_status = pay.status;
      activity.push({ event_type: "payment_status_changed", field: "payment_status", old_value: current.payment_status, new_value: pay.status });
      if (pay.status === "paid" && !current.payment_paid_at) {
        patch.payment_paid_at = nowIso();
        activity.push({ event_type: "payment_confirmed", field: "payment_paid_at", old_value: null, new_value: patch.payment_paid_at });
      }
    }
    if (pay.amountPaid !== undefined) {
      const cents = pesosToCents(pay.amountPaid);
      if (cents !== (current.payment_amount_paid_cents ?? 0)) {
        patch.payment_amount_paid_cents = cents;
        activity.push({ event_type: "payment_amount_changed", field: "amount_paid", old_value: String(current.payment_amount_paid_cents), new_value: String(cents) });
      }
    }
    if (pay.transactionRef !== undefined && pay.transactionRef !== current.payment_transaction_ref) {
      patch.payment_transaction_ref = pay.transactionRef;
      activity.push({ event_type: "payment_reference_changed", field: "transaction_ref", old_value: current.payment_transaction_ref, new_value: pay.transactionRef });
    }
    if (pay.notes !== undefined && pay.notes !== current.payment_notes) {
      patch.payment_notes = pay.notes;
      activity.push({ event_type: "payment_notes_changed", field: "payment_notes", old_value: current.payment_notes, new_value: pay.notes });
    }
    patch.payment_updated_by = actor.replace("admin:", "");
    patch.payment_updated_at = nowIso();
  }

  // Envío
  if (input.shipping) {
    const sh = input.shipping;
    if (sh.carrier !== undefined && sh.carrier !== current.shipping_carrier) {
      patch.shipping_carrier = sh.carrier;
      activity.push({ event_type: "shipping_carrier_changed", field: "shipping_carrier", old_value: current.shipping_carrier, new_value: sh.carrier });
    }
    if (sh.trackingCode !== undefined && sh.trackingCode !== current.shipping_tracking_code) {
      patch.shipping_tracking_code = sh.trackingCode;
      activity.push({ event_type: "shipping_tracking_changed", field: "shipping_tracking_code", old_value: current.shipping_tracking_code, new_value: sh.trackingCode });
    }
    if (sh.status !== undefined && sh.status !== current.shipping_status) {
      patch.shipping_status = sh.status;
      activity.push({ event_type: "shipping_status_changed", field: "shipping_status", old_value: current.shipping_status, new_value: sh.status });
      if (sh.status === "despachado" && !current.shipping_dispatched_at) {
        patch.shipping_dispatched_at = nowIso();
      }
      // Email de despacho
      if (sh.status === "despachado" && current.customer_email) {
        const tpl = orderShippedEmail({
          orderNumber,
          customerName: current.customer_name ?? "Cliente",
          customerEmail: current.customer_email,
          total: centsToPesos(current.total_cents ?? 0).toLocaleString("es-AR", { style: "currency", currency: "ARS" }),
          items: [],
          trackingCode: sh.trackingCode ?? current.shipping_tracking_code ?? undefined,
          carrier: sh.carrier ?? current.shipping_carrier ?? undefined,
        });
        void sendEmail({ to: current.customer_email, subject: tpl.subject, html: tpl.html }).catch(() => undefined);
      }
    }
    if (sh.notes !== undefined && sh.notes !== current.shipping_notes) {
      patch.shipping_notes = sh.notes;
      activity.push({ event_type: "shipping_notes_changed", field: "shipping_notes", old_value: current.shipping_notes, new_value: sh.notes });
    }
    if (sh.dispatchedAt !== undefined) {
      patch.shipping_dispatched_at = sh.dispatchedAt;
    }
  }

  // Notas
  if (input.internalNotes !== undefined && input.internalNotes !== current.internal_notes) {
    patch.internal_notes = input.internalNotes;
    activity.push({ event_type: "internal_notes_changed", field: "internal_notes", old_value: current.internal_notes, new_value: input.internalNotes });
  }
  if (input.customerNotes !== undefined && input.customerNotes !== current.customer_notes) {
    patch.customer_notes = input.customerNotes;
    activity.push({ event_type: "customer_notes_changed", field: "customer_notes", old_value: current.customer_notes, new_value: input.customerNotes });
  }
  if (input.whatsappReference !== undefined && input.whatsappReference !== current.whatsapp_reference) {
    patch.whatsapp_reference = input.whatsappReference;
    activity.push({ event_type: "whatsapp_reference_changed", field: "whatsapp_reference", old_value: current.whatsapp_reference, new_value: input.whatsappReference });
  }

  // Descuento / envío
  if (input.discount !== undefined) {
    const cents = pesosToCents(input.discount);
    if (cents !== (current.discount_cents ?? 0)) {
      patch.discount_cents = cents;
      activity.push({ event_type: "discount_changed", field: "discount_cents", old_value: String(current.discount_cents), new_value: String(cents) });
    }
  }
  if (input.shippingCost !== undefined) {
    const cents = pesosToCents(input.shippingCost);
    if (cents !== (current.shipping_cents ?? 0)) {
      patch.shipping_cents = cents;
      activity.push({ event_type: "shipping_cost_changed", field: "shipping_cents", old_value: String(current.shipping_cents), new_value: String(cents) });
    }
  }

  // Estado de negocio (status)
  if (input.status !== undefined) {
    const db = domainToDbStatus(input.status, current.payment_status);
    if (db.payment_status !== current.payment_status || db.fulfillment_status !== current.fulfillment_status) {
      patch.payment_status = db.payment_status;
      patch.fulfillment_status = db.fulfillment_status;
      activity.push({ event_type: "status_changed", field: "status", old_value: current.fulfillment_status, new_value: db.fulfillment_status });

      // Cancelar → liberar stock (una vez)
      if (input.status === "cancelado" && !current.stock_released) {
        const { data: items } = await admin.from("order_items").select("product_id, quantity").eq("order_id", orderId);
        for (const it of items ?? []) {
          const { data: prod } = await admin.from("products").select("stock, sold_count").eq("id", it.product_id).single();
          if (prod) {
            await admin.from("products").update({
              stock: (prod.stock ?? 0) + it.quantity,
              sold_count: Math.max(0, (prod.sold_count ?? 0) - it.quantity),
            }).eq("id", it.product_id);
          }
        }
        patch.stock_released = true;
        await admin.from("order_status_history").insert({
          order_id: orderId,
          actor,
          payment_status: db.payment_status,
          fulfillment_status: db.fulfillment_status,
          reason: "Cancelado desde el panel",
        });
        if (current.customer_email) {
          const tpl = orderCancelledEmail({
            orderNumber,
            customerName: current.customer_name ?? "Cliente",
            customerEmail: current.customer_email,
            total: centsToPesos(current.total_cents ?? 0).toLocaleString("es-AR", { style: "currency", currency: "ARS" }),
            items: [],
          });
          void sendEmail({ to: current.customer_email, subject: tpl.subject, html: tpl.html }).catch(() => undefined);
        }
        await admin.from("order_activity_log").insert({
          order_id: orderId,
          actor,
          event_type: "stock_released",
          metadata: { reason: "cancelled" },
        });
      }
    }
  }

  // Items (reemplazar todos)
  if (input.items && input.items.length > 0) {
    // liberar stock de los items actuales (si no liberado)
    if (!current.stock_released) {
      const { data: oldItems } = await admin.from("order_items").select("product_id, quantity").eq("order_id", orderId);
      for (const it of oldItems ?? []) {
        const { data: prod } = await admin.from("products").select("stock, sold_count").eq("id", it.product_id).single();
        if (prod) {
          await admin.from("products").update({
            stock: (prod.stock ?? 0) + it.quantity,
            sold_count: Math.max(0, (prod.sold_count ?? 0) - it.quantity),
          }).eq("id", it.product_id);
        }
      }
    }
    // borrar items viejos
    await admin.from("order_items").delete().eq("order_id", orderId);

    // snapshot nuevos
    const productIds = input.items.map((i) => i.productId);
    const { data: products } = await admin.from("products").select("id, name, brand_id, brand_name, image, size, price_cents, stock, is_active").in("id", productIds);
    const byId = new Map((products ?? []).map((p: any) => [p.id, p]));
    const newItems: any[] = [];
    let newSubtotal = 0;
    for (const it of input.items) {
      const p = byId.get(it.productId);
      if (!p) throw new Error(`Producto no encontrado: ${it.productId}`);
      const qty = Math.max(1, Math.floor(it.quantity || 1));
      const unitPrice = p.price_cents ?? 0;
      newItems.push({
        order_id: orderId,
        product_id: p.id,
        name: p.name,
        brand_name: p.brand_name ?? p.brand_id ?? "",
        image_url: Array.isArray(p.image) ? p.image[0] : (p.image ?? null),
        size: p.size ?? null,
        quantity: qty,
        unit_price_cents: unitPrice,
        line_total_cents: unitPrice * qty,
      });
      newSubtotal += unitPrice * qty;
    }
    await admin.from("order_items").insert(newItems);

    // reservar stock nuevos
    if (!current.stock_released) {
      for (const it of input.items) {
        const p = byId.get(it.productId);
        const qty = Math.max(1, Math.floor(it.quantity || 1));
        await admin.from("products").update({
          stock: Math.max(0, (p.stock ?? 0) - qty),
          sold_count: (p.sold_count ?? 0) + qty,
        }).eq("id", it.productId);
      }
    }

    patch.subtotal_cents = newSubtotal;
    const disc = patch.discount_cents ?? current.discount_cents ?? 0;
    const ship = patch.shipping_cents ?? current.shipping_cents ?? 0;
    patch.total_cents = Math.max(0, newSubtotal + ship - disc);
    activity.push({ event_type: "items_replaced", metadata: { count: newItems.length } });
  }

  // Recalcular total si cambiaron subtotal/shipping/discount y no items
  if (!input.items && (patch.subtotal_cents === undefined)) {
    // nothing
  }
  if (patch.discount_cents !== undefined || patch.shipping_cents !== undefined) {
    const sub = patch.subtotal_cents ?? current.subtotal_cents;
    const ship = patch.shipping_cents ?? current.shipping_cents;
    const disc = patch.discount_cents ?? current.discount_cents ?? 0;
    patch.total_cents = Math.max(0, sub + ship - disc);
  }

  // Aplicar patch
  if (Object.keys(patch).length > 0) {
    patch.updated_at = nowIso();
    const { error: uErr } = await admin.from("orders").update(patch).eq("id", orderId);
    if (uErr) throw new Error(`No se pudo actualizar el pedido: ${uErr.message}`);
  }

  // Actividad
  if (activity.length > 0) {
    const rows = activity.map((a) => ({
      order_id: orderId,
      actor,
      event_type: a.event_type,
      field: a.field ?? null,
      old_value: a.old_value ?? null,
      new_value: a.new_value ?? null,
      metadata: a.metadata ?? null,
    }));
    await admin.from("order_activity_log").insert(rows);
  }

  // Re-leer
  const { data: full } = await admin
    .from("orders")
    .select("*, order_items(*), order_status_history(*)")
    .eq("id", orderId)
    .single();

  return mapOrderRow(full as any, full.customer_email ?? "");
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

export async function fetchOrders(filters: OrderFilters = {}): Promise<{ orders: Order[]; total: number }> {
  const admin = getSupabaseAdmin();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));

  let query = admin
    .from("orders")
    .select("*, order_items(*), order_status_history(*)", { count: "exact" });

  if (filters.paymentStatus) query = query.eq("payment_status", filters.paymentStatus);
  if (filters.shippingStatus) query = query.eq("shipping_status", filters.shippingStatus);
  if (filters.fulfillmentStatus) query = query.eq("fulfillment_status", filters.fulfillmentStatus);
  if (filters.dateFrom) query = query.gte("created_at", filters.dateFrom);
  if (filters.dateTo) query = query.lte("created_at", filters.dateTo);

  if (filters.search) {
    const s = `%${filters.search}%`;
    query = query.or(`order_number.ilike.${s},customer_name.ilike.${s},customer_phone.ilike.${s},ship_recipient_name.ilike.${s},ship_recipient_phone.ilike.${s}`);
  }

  const sortCol = filters.sort === "total_cents" ? "total_cents" : "created_at";
  const asc = filters.order === "asc";
  query = query.order(sortCol, { ascending: asc });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw new Error(`No se pudieron leer los pedidos: ${error.message}`);

  const orders = (data ?? []).map((r: any) => mapOrderRow(r, r.customer_email ?? ""));
  return { orders, total: count ?? 0 };
}

export async function fetchOrderSummary(dateFrom?: string, dateTo?: string): Promise<{
  totalOrders: number;
  pendingPayment: number;
  paid: number;
  pendingDispatch: number;
  totalSales: number;
}> {
  const admin = getSupabaseAdmin();
  let query = admin.from("orders").select("payment_status, shipping_status, total_cents, created_at");
  if (dateFrom) query = query.gte("created_at", dateFrom);
  if (dateTo) query = query.lte("created_at", dateTo);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  return {
    totalOrders: rows.length,
    pendingPayment: rows.filter((r: any) => r.payment_status === "pending" || r.payment_status === "partial").length,
    paid: rows.filter((r: any) => r.payment_status === "paid").length,
    pendingDispatch: rows.filter((r: any) => r.shipping_status !== "entregado" && r.shipping_status !== "problema").length,
    totalSales: centsToPesos(rows.filter((r: any) => r.payment_status === "paid").reduce((a: number, r: any) => a + (r.total_cents ?? 0), 0)),
  };
}

export async function fetchCustomers(): Promise<any[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name, phone, role, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchOrder(orderNumber: string): Promise<Order | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("orders")
    .select("*, order_items(*), order_status_history(*)")
    .eq("order_number", orderNumber)
    .single();
  if (error || !data) return null;
  return mapOrderRow(data as any, data.customer_email ?? "");
}
