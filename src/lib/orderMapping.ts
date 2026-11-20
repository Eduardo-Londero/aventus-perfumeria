/**
 * Mapeo de pedidos: dominio de la app ⇄ esquema Supabase
 * =======================================================
 * Fuente única de verdad para traducir entre:
 *
 *   - El dominio (`Order`, `OrderStatus` de src/types) que usan las páginas.
 *   - Las filas de `orders` / `order_items` / `order_status_history`
 *     (importes en CENTAVOS, estados partidos en payment/fulfillment).
 *
 * Reglas de estado (ciclo de vida del negocio → columnas de la DB):
 *
 *   no-concretado → pending   + awaiting_payment
 *   confirmado    → paid      + processing
 *   enviado       → paid      + shipped
 *   entregado     → paid      + delivered
 *   cancelado     → (paid→refunded | resto→expired) + cancelled
 *
 * La inversión (DB → dominio) prioriza fulfillment_status, que es el eje
 * logístico que ve el negocio en el panel. Todo puro y testeado
 * (src/lib/orderMapping.test.ts): la RPC decide el servidor, esto solo
 * traduce representaciones.
 */

import type { Order, OrderItemSnapshot, OrderStatus } from "@/types";

// ---------------------------------------------------------------------------
// Filas (shape que devuelve PostgREST con `select("*")`)
// ---------------------------------------------------------------------------

export interface OrderRow {
  id: string;
  order_number: string;
  user_id: string | null;
  delivery_method: "retiro" | "envio";
  payment_method: string;
  payment_status: string;
  fulfillment_status: string;
  subtotal_cents: number;
  shipping_cents: number;
  discount_cents?: number;
  total_cents: number;
  ship_street: string | null;
  ship_city: string | null;
  ship_province: string | null;
  ship_postal_code: string | null;
  ship_recipient_name: string | null;
  ship_recipient_phone: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  internal_notes: string | null;
  customer_notes: string | null;
  payment_amount_paid_cents?: number;
  payment_paid_at: string | null;
  payment_transaction_ref: string | null;
  payment_notes: string | null;
  payment_updated_by: string | null;
  payment_updated_at: string | null;
  shipping_carrier: string | null;
  shipping_tracking_code: string | null;
  shipping_dispatched_at: string | null;
  shipping_status: string | null;
  shipping_notes: string | null;
  whatsapp_reference: string | null;
  stock_released: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderItemRow {
  product_id: string;
  name: string;
  brand_name: string;
  image_url: string | null;
  size: string | null;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
}

export interface OrderHistoryRow {
  payment_status: string | null;
  fulfillment_status: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Conversión de importes: la DB guarda centavos, el dominio pesos ARS
// ---------------------------------------------------------------------------

export function centsToPesos(cents: number): number {
  // Conversión exacta: los importes de la DB son múltiplos de 100 (precios
  // en pesos enteros), y redondear acá podría perder centavos reales.
  return cents / 100;
}

export function pesosToCents(pesos: number): number {
  return Math.round(pesos * 100);
}

// ---------------------------------------------------------------------------
// Estados: dominio → columnas (para ESCRITURAS del panel admin)
// ---------------------------------------------------------------------------

export interface DbStatus {
  payment_status: string;
  fulfillment_status: string;
}

/**
 * Traduce el estado de negocio a las columnas de la DB.
 * `currentPayment` solo se usa en "cancelado": un pedido ya pagado queda
 * como `refunded`, el resto como `expired`.
 */
export function domainToDbStatus(
  status: OrderStatus,
  currentPayment?: string
): DbStatus {
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
        currentPayment === "discrepancy";
      return {
        payment_status: paid ? "refunded" : "expired",
        fulfillment_status: "cancelled",
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Estados: columnas → dominio (para LECTURAS)
// ---------------------------------------------------------------------------

export function dbToDomainStatus(
  paymentStatus: string,
  fulfillmentStatus: string
): OrderStatus {
  switch (fulfillmentStatus) {
    case "cancelled":
      return "cancelado";
    case "delivered":
      return "entregado";
    case "shipped":
      return "enviado";
    case "processing":
    case "ready_for_pickup":
      return "confirmado";
    case "awaiting_payment":
    default:
      // Pago rechazado/expirado sin logística = no concretado.
      if (paymentStatus === "rejected" || paymentStatus === "expired") {
        return "cancelado";
      }
      return "no-concretado";
  }
}

// ---------------------------------------------------------------------------
// Filas → dominio
// ---------------------------------------------------------------------------

function splitFullName(fullName: string | null): { name: string; lastName: string } {
  const [name, ...rest] = (fullName ?? "").trim().split(" ");
  return { name: name ?? "", lastName: rest.join(" ") };
}

export function mapItemRow(row: OrderItemRow): OrderItemSnapshot {
  return {
    productId: row.product_id,
    name: row.name,
    brand: row.brand_name,
    image: row.image_url ?? "",
    size: row.size ?? "",
    quantity: row.quantity,
    unitPrice: centsToPesos(row.unit_price_cents),
    subtotal: centsToPesos(row.line_total_cents),
  };
}

export function mapHistoryRows(rows: OrderHistoryRow[]): {
  status: OrderStatus;
  date: string;
}[] {
  return rows
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((row) => ({
      status: dbToDomainStatus(
        row.payment_status ?? "pending",
        row.fulfillment_status ?? "awaiting_payment"
      ),
      date: row.created_at,
    }));
}

/**
 * Filas embebidas (`orders` + `order_items` + `order_status_history`) al
 * tipo `Order`. `customerEmail` lo aporta el servidor (viene de auth.users,
 * no de la tabla): en el panel queda vacío si no se pudo resolver.
 */
export function mapOrderRow(
  row: OrderRow & {
    order_items?: OrderItemRow[];
    order_status_history?: OrderHistoryRow[];
  },
  customerEmail = ""
): Order {
  const recipient = splitFullName(row.ship_recipient_name);
  const items = (row.order_items ?? []).map(mapItemRow);
  let statusHistory = mapHistoryRows(row.order_status_history ?? []);
  if (statusHistory.length === 0) {
    // Defensa: sin historial, al menos dejar el estado actual y la fecha.
    statusHistory = [
      {
        status: dbToDomainStatus(row.payment_status, row.fulfillment_status),
        date: row.created_at,
      },
    ];
  }

  return {
    id: row.order_number,
    date: row.created_at,
    customer: {
      name: row.customer_name ?? recipient.name,
      lastName: recipient.lastName,
      phone: row.customer_phone ?? row.ship_recipient_phone ?? "",
      email: customerEmail || row.customer_email || "",
      address: row.ship_street ?? undefined,
      city: row.ship_city ?? undefined,
      province: row.ship_province ?? undefined,
      postalCode: row.ship_postal_code ?? undefined,
    },
    items,
    subtotal: centsToPesos(row.subtotal_cents),
    shippingCost: centsToPesos(row.shipping_cents),
    discount: centsToPesos(row.discount_cents ?? 0),
    total: centsToPesos(row.total_cents),
    deliveryMethod: row.delivery_method,
    paymentMethod: row.payment_method,
    status: dbToDomainStatus(row.payment_status, row.fulfillment_status),
    statusHistory,
    userId: row.user_id ?? undefined,
    observations: row.shipping_notes ?? row.internal_notes ?? undefined,
    stockReserved: !row.stock_released,
    customerProvince: row.ship_province ?? undefined,
    internalNotes: row.internal_notes ?? undefined,
    customerNotes: row.customer_notes ?? undefined,
    paymentStatus: row.payment_status,
    paymentAmountPaid: centsToPesos(row.payment_amount_paid_cents ?? 0),
    paymentPaidAt: row.payment_paid_at ?? undefined,
    paymentTransactionRef: row.payment_transaction_ref ?? undefined,
    paymentNotes: row.payment_notes ?? undefined,
    paymentUpdatedBy: row.payment_updated_by ?? undefined,
    paymentUpdatedAt: row.payment_updated_at ?? undefined,
    shippingCarrier: row.shipping_carrier ?? undefined,
    shippingTrackingCode: row.shipping_tracking_code ?? undefined,
    shippingDispatchedAt: row.shipping_dispatched_at ?? undefined,
    shippingStatus: row.shipping_status ?? undefined,
    shippingNotes: row.shipping_notes ?? undefined,
    whatsappReference: row.whatsapp_reference ?? undefined,
    updatedAt: row.updated_at,
  };
}
