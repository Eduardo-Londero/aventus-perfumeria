/**
 * Preparación de la migración de PEDIDOS — Fase E (solo local, sin escrituras)
 * ==========================================================================
 * Mapea el modelo actual de pedidos (src/types/index.ts — pesos, estado único
 * de 5 valores, cliente embebido) al esquema Supabase `public.orders` +
 * `order_items` + `order_status_history` (migración 0001), y detecta los
 * bloqueos que impiden importarlos hoy:
 *
 *   - `user_id uuid not null → profiles`: el id local (`user-123`, `customer-1`)
 *     NO es un uuid ni existe en profiles → pedido bloqueado (requiere F3).
 *   - Pedidos de invitado (sin userId) → bloqueados por diseño del esquema.
 *   - El eje de pago no existe en el modelo local → inferido (conservador).
 *
 * NO escribe nada ni llama a la red. Produce filas en snake_case listas para
 * un futuro `upsert` (identificadores determinísticos vía src/lib/uuidv5.ts
 * para ser re-ejecutable sin DELETE, que service_role no tiene en esas tablas).
 */
import { uuidv5, AVT_NAMESPACE } from "@/lib/uuidv5";
import { canTransition } from "@/lib/orderStatus";
import type { Order, OrderStatus } from "@/types";
import type {
  PaymentStatus,
  FulfillmentStatus,
  PaymentMethod,
} from "@/types/domain";

export const ORDER_MIGRATION_NAMESPACE = AVT_NAMESPACE;

// Eje logístico (fulfillment) por estado legacy — fuente única para la migración.
export const LEGACY_STATUS_TO_FULFILLMENT: Record<OrderStatus, FulfillmentStatus> = {
  "no-concretado": "awaiting_payment",
  confirmado: "processing",
  enviado: "shipped",
  entregado: "delivered",
  cancelado: "cancelled",
};

// Eje de pago por estado legacy. INFERENCIA CONSERVADORA (requiere confirmación
// del propietario por pedido): solo "entregado" se considera pagado; el resto
// queda "pending" porque el modelo local no registra el pago de forma fiable.
export const LEGACY_STATUS_TO_PAYMENT: Record<OrderStatus, PaymentStatus> = {
  "no-concretado": "pending",
  confirmado: "pending",
  enviado: "pending",
  entregado: "paid",
  cancelado: "pending",
};

export type OrderBlockerCode =
  | "guest_order"
  | "user_id_not_uuid"
  | "user_id_unverifiable"
  | "payment_method_invalid"
  | "shipping_address_incomplete"
  | "amount_invalid"
  | "order_number_missing"
  | "order_number_duplicate"
  | "item_quantity_invalid"
  | "item_missing_fields"
  | "status_invalid"
  | "status_history_empty";

export type OrderWarningCode =
  | "total_mismatch"
  | "item_total_mismatch"
  | "amount_precision_loss"
  | "pii_email_not_stored"
  | "pii_phone_not_stored"
  | "payment_status_inferred"
  | "status_history_non_adjacent"
  | "status_history_missing"
  | "user_id_unverifiable";

export interface OrderRow {
  id: string;
  order_number: string;
  user_id: string;
  delivery_method: "retiro" | "envio";
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  fulfillment_status: FulfillmentStatus;
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
  ship_street: string | null;
  ship_city: string | null;
  ship_postal_code: string | null;
  ship_recipient_name: string | null;
  ship_recipient_phone: string | null;
  reservation_expires_at: string | null;
  stock_released: boolean;
  payment_reference: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
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
  id: string;
  order_id: string;
  actor: string;
  payment_status: PaymentStatus | null;
  fulfillment_status: FulfillmentStatus | null;
  reason: string | null;
  created_at: string;
}

export interface OrderMigrationResult {
  orderId: string;
  status: "ready" | "blocked";
  blockers: OrderBlockerCode[];
  warnings: OrderWarningCode[];
  rows:
    | {
        order: OrderRow;
        items: OrderItemRow[];
        history: OrderHistoryRow[];
      }
    | null;
}

export interface OrderMigrationPlan {
  total: number;
  ready: number;
  blocked: number;
  results: OrderMigrationResult[];
  blockers: Record<string, number>;
  dependencies: string[];
}

const VALID_PAYMENT_METHODS: ReadonlySet<string> = new Set([
  "transferencia",
  "efectivo",
]);

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

export function legacyOrderUuid(orderId: string): string {
  return uuidv5(ORDER_MIGRATION_NAMESPACE, `order:${orderId}`);
}

function toCents(value: number): { cents: number; precisionLoss: boolean } | null {
  if (!Number.isFinite(value) || value < 0) return null;
  const raw = value * 100;
  const rounded = Math.round(raw);
  return { cents: rounded, precisionLoss: Math.abs(raw - rounded) > 1e-6 };
}

function mapPaymentMethod(value: string): PaymentMethod | null {
  return VALID_PAYMENT_METHODS.has(value)
    ? (value as PaymentMethod)
    : null;
}

export function mapLegacyStatus(status: OrderStatus): {
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
} {
  return {
    paymentStatus: LEGACY_STATUS_TO_PAYMENT[status],
    fulfillmentStatus: LEGACY_STATUS_TO_FULFILLMENT[status],
  };
}

const VALID_LEGACY_STATUSES: ReadonlySet<OrderStatus> = new Set([
  "no-concretado",
  "confirmado",
  "enviado",
  "entregado",
  "cancelado",
]);

export function migrateOrder(
  order: Order,
  context: { seenOrderNumbers: Set<string> } = { seenOrderNumbers: new Set() }
): OrderMigrationResult {
  const blockers: OrderBlockerCode[] = [];
  const warnings: OrderWarningCode[] = [];

  // 1. Identificador del pedido (order_number).
  const orderNumber = (order.id ?? "").trim();
  if (!orderNumber) {
    blockers.push("order_number_missing");
  } else if (context.seenOrderNumbers.has(orderNumber)) {
    blockers.push("order_number_duplicate");
  }

  // 2. Usuario (FK a profiles).
  const userId = order.userId?.trim();
  if (!userId) {
    blockers.push("guest_order");
  } else if (!isUuid(userId)) {
    blockers.push("user_id_not_uuid");
  } else {
    // Presencia en profiles no verificable sin base: aviso, FK puede fallar.
    warnings.push("user_id_unverifiable");
  }

  // 3. Medio de pago (CHECK constraint).
  const paymentMethod = mapPaymentMethod(order.paymentMethod);
  if (!paymentMethod) {
    blockers.push("payment_method_invalid");
  }

  // 4. Dirección para envíos (constraint orders_envio_requires_address).
  if (order.deliveryMethod === "envio") {
    if (
      !order.customer.address?.trim() ||
      !order.customer.city?.trim() ||
      !order.customer.postalCode?.trim()
    ) {
      blockers.push("shipping_address_incomplete");
    }
  }

  // 5. Montos.
  const subtotal = toCents(order.subtotal);
  const shipping = toCents(order.shippingCost);
  const total = toCents(order.total);
  if (!subtotal || !shipping || !total) {
    blockers.push("amount_invalid");
  } else {
    if (subtotal.precisionLoss || shipping.precisionLoss || total.precisionLoss) {
      warnings.push("amount_precision_loss");
    }
    if (Math.abs(total.cents - (subtotal.cents + shipping.cents)) > 0) {
      warnings.push("total_mismatch");
    }
  }

  // 6. Estado legacy válido.
  if (!VALID_LEGACY_STATUSES.has(order.status)) {
    blockers.push("status_invalid");
  }
  if (!Array.isArray(order.statusHistory) || order.statusHistory.length === 0) {
    warnings.push("status_history_missing");
  } else {
    // Validar cada entrada del historial.
    for (const entry of order.statusHistory) {
      if (!VALID_LEGACY_STATUSES.has(entry.status)) {
        blockers.push("status_invalid");
      }
    }
  }

  // 7. PII: email no tiene columna en el esquema remoto.
  if (order.customer.email?.trim()) {
    warnings.push("pii_email_not_stored");
  }
  if (
    order.deliveryMethod === "retiro" &&
    (order.customer.phone ?? "").trim() === ""
  ) {
    warnings.push("pii_phone_not_stored");
  }

  if (blockers.length > 0) {
    return {
      orderId: order.id,
      status: "blocked",
      blockers: Array.from(new Set(blockers)),
      warnings: Array.from(new Set(warnings)),
      rows: null,
    };
  }

  // Eje de pago inferido: aviso en todos los pedidos (el eje es inferido).
  warnings.push("payment_status_inferred");

  // --- Construcción de filas (solo si no hay bloqueos) ---
  const orderId = legacyOrderUuid(orderNumber);
  const subtotalCents = subtotal!.cents;
  const shippingCents = shipping!.cents;
  const totalCents = total!.cents;

  const mapped = mapLegacyStatus(order.status);
  // Nota: el eje de pago de cada evento del historial se infiere del estado
  // de ese evento (no del estado final).
  const history: OrderHistoryRow[] = (order.statusHistory?.length
    ? order.statusHistory
    : [{ status: order.status, date: order.date }]
  ).map((entry, index) => {
    const entryMapped = mapLegacyStatus(entry.status as OrderStatus);
    return {
      id: uuidv5(ORDER_MIGRATION_NAMESPACE, `history:${orderNumber}:${index}`),
      order_id: orderId,
      actor: "system",
      payment_status: entryMapped.paymentStatus,
      fulfillment_status: entryMapped.fulfillmentStatus,
      reason: `migración histórica Fase E (estado legacy: ${entry.status})`,
      created_at: entry.date,
    };
  });

  // Aviso si el historial no es adyacente según la máquina de estados.
  if (order.statusHistory && order.statusHistory.length > 1) {
    for (let i = 1; i < order.statusHistory.length; i++) {
      const prev = order.statusHistory[i - 1].status as OrderStatus;
      const cur = order.statusHistory[i].status as OrderStatus;
      if (!canTransition(prev, cur)) {
        warnings.push("status_history_non_adjacent");
        break;
      }
    }
  }

  const items: OrderItemRow[] = order.items.map((item, index) => {
    const unit = toCents(item.unitPrice);
    const line = toCents(item.subtotal);
    if (line && unit) {
      if (Math.abs(line.cents - unit.cents * item.quantity) > 0) {
        warnings.push("item_total_mismatch");
      }
    }
    if (item.quantity < 1 || !Number.isInteger(item.quantity)) {
      // ya bloqueado antes? no: lo marcamos aquí como bloqueante
    }
    return {
      id: uuidv5(ORDER_MIGRATION_NAMESPACE, `item:${orderNumber}:${index}`),
      order_id: orderId,
      product_id: item.productId,
      name: item.name,
      brand_name: item.brand,
      image_url: item.image || null,
      size: item.size || null,
      quantity: item.quantity,
      unit_price_cents: unit ? unit.cents : 0,
      line_total_cents: line ? line.cents : 0,
    };
  });

  // Validación de ítems (bloqueante) — se evalúa antes de devolver ready.
  const itemBlockers: OrderBlockerCode[] = [];
  for (const item of order.items) {
    if (
      !Number.isInteger(item.quantity) ||
      item.quantity < 1
    ) {
      itemBlockers.push("item_quantity_invalid");
    }
    if (!item.name?.trim() || !item.brand?.trim()) {
      itemBlockers.push("item_missing_fields");
    }
  }
  if (itemBlockers.length > 0) {
    return {
      orderId: order.id,
      status: "blocked",
      blockers: Array.from(new Set(itemBlockers)),
      warnings: Array.from(new Set(warnings)),
      rows: null,
    };
  }

  const orderRow: OrderRow = {
    id: orderId,
    order_number: orderNumber,
    user_id: userId as string, // es uuid válido en este punto
    delivery_method: order.deliveryMethod,
    payment_method: paymentMethod as PaymentMethod,
    payment_status: mapped.paymentStatus,
    fulfillment_status: mapped.fulfillmentStatus,
    subtotal_cents: subtotalCents,
    shipping_cents: shippingCents,
    total_cents: totalCents,
    ship_street: order.customer.address?.trim() || null,
    ship_city: order.customer.city?.trim() || null,
    ship_postal_code: order.customer.postalCode?.trim() || null,
    ship_recipient_name:
      `${order.customer.name} ${order.customer.lastName}`.trim() || null,
    ship_recipient_phone: order.customer.phone?.trim() || null,
    reservation_expires_at: null,
    stock_released: !(order.stockReserved === true),
    payment_reference: null,
    created_at: order.date,
    updated_at: order.date,
  };

  context.seenOrderNumbers.add(orderNumber);

  return {
    orderId: order.id,
    status: "ready",
    blockers: [],
    warnings: Array.from(new Set(warnings)),
    rows: { order: orderRow, items, history },
  };
}

export function planOrderMigration(
  orders: Order[]
): OrderMigrationPlan {
  const seen = new Set<string>();
  const results = orders.map((o) => migrateOrder(o, { seenOrderNumbers: seen }));
  const blockers: Record<string, number> = {};
  for (const r of results) {
    for (const b of r.blockers) {
      blockers[b] = (blockers[b] ?? 0) + 1;
    }
  }
  return {
    total: orders.length,
    ready: results.filter((r) => r.status === "ready").length,
    blocked: results.filter((r) => r.status === "blocked").length,
    results,
    blockers,
    dependencies: [
      "auth_profiles: user_id debe ser uuid de public.profiles (F3)",
      "guest_orders: el esquema exige user_id NOT NULL; requiere decisión de diseño",
      "payment_status: inferido (requiere confirmación del propietario)",
      "pii_email: sin columna en 0001; requiere decisión (snapshot o archivo)",
      "import_script: añadir paso 'orders' (upsert por order_number) cuando se autorice",
    ],
  };
}
