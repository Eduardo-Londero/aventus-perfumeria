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
  user_id: string;
  delivery_method: "retiro" | "envio";
  payment_method: string;
  payment_status: string;
  fulfillment_status: string;
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
  ship_street: string | null;
  ship_city: string | null;
  ship_postal_code: string | null;
  ship_recipient_name: string | null;
  ship_recipient_phone: string | null;
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
      name: recipient.name,
      lastName: recipient.lastName,
      phone: row.ship_recipient_phone ?? "",
      email: customerEmail,
      address: row.ship_street ?? undefined,
      city: row.ship_city ?? undefined,
      postalCode: row.ship_postal_code ?? undefined,
    },
    items,
    subtotal: centsToPesos(row.subtotal_cents),
    shippingCost: centsToPesos(row.shipping_cents),
    total: centsToPesos(row.total_cents),
    deliveryMethod: row.delivery_method,
    paymentMethod: row.payment_method,
    status: dbToDomainStatus(row.payment_status, row.fulfillment_status),
    statusHistory,
    userId: row.user_id,
    // Reserva activa = el pedido aún no liberó el stock (la liberación solo
    // ocurre al cancelar, desde el panel admin).
    stockReserved: !row.stock_released,
  };
}
