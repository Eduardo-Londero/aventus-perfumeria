/**
 * Referencia local de creación atómica de pedidos — Fase F3 (sin escrituras remotas)
 * ============================================================================
 * Implementa en memoria la semántica que tendrá la futura RPC
 * `public.create_order_atomic` (ver supabase/migrations/20261027_0004_*.sql).
 * Sirve para validar reglas, flujos y casos límite sin tocar Supabase.
 *
 * Invariantes:
 *   - Los precios, stock y existencia de productos se leen del "servidor" (store),
 *     nunca del cliente.
 *   - El pago se crea SIEMPRE en estado `pending`; confirmarlo es otra operación.
 *   - La creación es transaccional: ante cualquier error se revierte stock, pedido,
 *     ítems, historial e idempotencia.
 *   - La idempotencia se basa en una clave provista por el cliente (o derivada).
 *
 * Concurrencia: JS es single-threaded, por lo que la ejecución secuencial ya es
 * atómica en este entorno. En Postgres la atomicidad real requiere
 * `SELECT ... FOR UPDATE` (o advisory lock) sobre los productos y la clave de
 * idempotencia dentro de la transacción. Las pruebas de "última unidad" verifican
 * el resultado observable (sin stock negativo), no la carrera real.
 */
import type { PaymentStatus, FulfillmentStatus } from "@/types/domain";

export interface ProductRecord {
  id: string;
  name: string;
  brand: string;
  image: string;
  size?: string;
  price: number; // ARS, fuente de verdad del servidor
  stock: number;
  isActive: boolean;
}

export interface AtomicCustomer {
  name: string;
  lastName: string;
  phone: string;
  email: string;
  address?: string;
  city?: string;
  postalCode?: string;
}

export interface AtomicItemInput {
  productId: string;
  quantity: number;
  // Precio que envía el navegador (NO confiable). Se ignora para el cálculo;
  // si difiere del del servidor se reporta `priceMismatch`.
  clientPrice?: number;
}

export interface AtomicOrderInput {
  items: AtomicItemInput[];
  deliveryMethod: "retiro" | "envio";
  paymentMethod: "transferencia" | "efectivo";
  customer: AtomicCustomer;
  userId: string | null; // null = invitado
  idempotencyKey?: string;
}

export interface OrderRecord {
  id: string;
  orderNumber: string;
  userId: string | null;
  deliveryMethod: "retiro" | "envio";
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  subtotal: number;
  shippingCost: number;
  total: number;
  customer: AtomicCustomer;
  stockReleased: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItemRecord {
  orderId: string;
  productId: string;
  name: string;
  brand: string;
  image: string;
  size: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface OrderHistoryRecord {
  orderId: string;
  actor: string;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  reason: string;
  createdAt: string;
}

export interface IdempotencyRecord {
  key: string;
  orderId: string;
  userId: string | null;
  createdAt: string;
}

export interface OrderStore {
  products: Map<string, ProductRecord>;
  orders: Map<string, OrderRecord>;
  items: Map<string, OrderItemRecord[]>; // orderId -> items
  history: Map<string, OrderHistoryRecord[]>; // orderId -> history
  idempotency: Map<string, IdempotencyRecord>;
  orderCounter: number;
  idempotencyCounter: number;
}

export function createOrderStore(
  products: ProductRecord[] = []
): OrderStore {
  const store: OrderStore = {
    products: new Map(products.map((p) => [p.id, { ...p, size: p.size ?? "100 ml" }])),
    orders: new Map(),
    items: new Map(),
    history: new Map(),
    idempotency: new Map(),
    orderCounter: 1047,
    idempotencyCounter: 0,
  };
  return store;
}

export type AtomicErrorCode =
  | "invalid_input"
  | "empty_cart"
  | "invalid_quantity"
  | "product_not_found"
  | "product_inactive"
  | "insufficient_stock"
  | "shipping_address_required"
  | "invalid_payment_method"
  | "idempotency_conflict";

export interface AtomicOrderResult {
  ok: boolean;
  order?: OrderRecord;
  items?: OrderItemRecord[];
  idempotent?: boolean;
  priceMismatch?: boolean;
  error?: { code: AtomicErrorCode; message: string };
}

const SHIPPING_COST = 2500; // ARS, autoridad del servidor (no del cliente)
const FREE_SHIPPING_THRESHOLD = 50000;

export function createOrderAtomic(
  store: OrderStore,
  input: AtomicOrderInput,
  now: () => string = () => new Date().toISOString()
): AtomicOrderResult {
  // Snapshot para rollback transaccional.
  const snapshot = {
    products: new Map(Array.from(store.products.entries()).map(([k, v]) => [k, { ...v }])),
    orders: new Map(store.orders),
    items: new Map(Array.from(store.items.entries()).map(([k, v]) => [k, v.map((x) => ({ ...x }))])),
    history: new Map(Array.from(store.history.entries()).map(([k, v]) => [k, v.map((x) => ({ ...x }))])),
    idempotency: new Map(store.idempotency),
    orderCounter: store.orderCounter,
  };

  const rollback = () => {
    store.products = snapshot.products;
    store.orders = snapshot.orders;
    store.items = snapshot.items;
    store.history = snapshot.history;
    store.idempotency = snapshot.idempotency;
    store.orderCounter = snapshot.orderCounter;
  };

  try {
    // 1. Validación de entrada básica.
    if (!input || !Array.isArray(input.items) || input.items.length === 0) {
      throw { code: "empty_cart" as AtomicErrorCode, message: "El carrito está vacío." };
    }
    if (input.deliveryMethod !== "retiro" && input.deliveryMethod !== "envio") {
      throw { code: "invalid_input" as AtomicErrorCode, message: "Método de entrega inválido." };
    }
    if (!["transferencia", "efectivo"].includes(input.paymentMethod)) {
      throw { code: "invalid_payment_method" as AtomicErrorCode, message: "Medio de pago inválido." };
    }
    const c = input.customer;
    if (!c?.name?.trim() || !c?.lastName?.trim() || !c?.phone?.trim() || !c?.email?.trim()) {
      throw { code: "invalid_input" as AtomicErrorCode, message: "Datos del cliente incompletos." };
    }
    if (input.deliveryMethod === "envio") {
      if (!c.address?.trim() || !c.city?.trim() || !c.postalCode?.trim()) {
        throw { code: "shipping_address_required" as AtomicErrorCode, message: "Dirección de envío incompleta." };
      }
    }

    // 2. Idempotencia.
    const key = input.idempotencyKey?.trim();
    if (key) {
      const existing = store.idempotency.get(key);
      if (existing) {
        if (existing.userId !== input.userId) {
          throw { code: "idempotency_conflict" as AtomicErrorCode, message: "Clave de idempotencia pertenece a otro usuario." };
        }
        const existingOrder = store.orders.get(existing.orderId);
        if (existingOrder) {
          return {
            ok: true,
            order: existingOrder,
            items: store.items.get(existing.orderId) ?? [],
            idempotent: true,
          };
        }
      }
    }

    // 3. Validar ítems contra el servidor: existencia, activo, stock, cantidad.
    let priceMismatch = false;
    const validated: Array<{ product: ProductRecord; quantity: number; clientPrice?: number }> = [];
    for (const it of input.items) {
      if (!Number.isInteger(it.quantity) || it.quantity < 1) {
        throw { code: "invalid_quantity" as AtomicErrorCode, message: "Cantidad inválida." };
      }
      const product = store.products.get(it.productId);
      if (!product) {
        throw { code: "product_not_found" as AtomicErrorCode, message: `Producto no encontrado: ${it.productId}.` };
      }
      if (!product.isActive) {
        throw { code: "product_inactive" as AtomicErrorCode, message: `Producto inactivo: ${it.productId}.` };
      }
      if (product.stock < it.quantity) {
        throw { code: "insufficient_stock" as AtomicErrorCode, message: `Stock insuficiente para ${it.productId}.` };
      }
      if (it.clientPrice !== undefined && it.clientPrice !== product.price) {
        priceMismatch = true;
      }
      validated.push({ product, quantity: it.quantity, clientPrice: it.clientPrice });
    }

    // 4. Cálculo con precios del servidor.
    const subtotal = validated.reduce((acc, v) => acc + v.product.price * v.quantity, 0);
    const shippingCost = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : (input.deliveryMethod === "envio" ? SHIPPING_COST : 0);
    const total = subtotal + shippingCost;

    // 5. Reserva de stock (dentro de la transacción).
    for (const v of validated) {
      const p = store.products.get(v.product.id)!;
      p.stock -= v.quantity;
    }

    // 6. Crear pedido + ítems + historial.
    store.orderCounter += 1;
    const orderId = `ord-${store.orderCounter}`;
    const orderNumber = `AV-${store.orderCounter}`;
    const nowIso = now();
    const fulfillmentStatus: FulfillmentStatus = "awaiting_payment";
    const paymentStatus: PaymentStatus = "pending";

    const order: OrderRecord = {
      id: orderId,
      orderNumber,
      userId: input.userId,
      deliveryMethod: input.deliveryMethod,
      paymentMethod: input.paymentMethod,
      paymentStatus,
      fulfillmentStatus,
      subtotal,
      shippingCost,
      total,
      customer: { ...input.customer },
      stockReleased: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    store.orders.set(orderId, order);

    const items: OrderItemRecord[] = validated.map((v) => ({
      orderId,
      productId: v.product.id,
      name: v.product.name,
      brand: v.product.brand,
      image: v.product.image,
      size: v.product.size ?? "100 ml",
      quantity: v.quantity,
      unitPrice: v.product.price,
      subtotal: v.product.price * v.quantity,
    }));
    store.items.set(orderId, items);

    store.history.set(orderId, [
      {
        orderId,
        actor: input.userId ? `customer:${input.userId}` : "system",
        paymentStatus,
        fulfillmentStatus,
        reason: "creación del pedido",
        createdAt: nowIso,
      },
    ]);

    // 7. Idempotencia (dentro de la transacción).
    if (key) {
      store.idempotency.set(key, {
        key,
        orderId,
        userId: input.userId,
        createdAt: nowIso,
      });
    }

    return { ok: true, order, items, priceMismatch };
  } catch (err: any) {
    rollback();
    const code: AtomicErrorCode = err?.code ?? "invalid_input";
    const message: string = err?.message ?? "Error al crear el pedido.";
    return { ok: false, error: { code, message } };
  }
}

// Lectura segura de un pedido (aislamiento por usuario).
export function getOrderForUser(
  store: OrderStore,
  orderId: string,
  requesterUserId: string | null,
  isAdmin: boolean
): OrderRecord | null {
  const order = store.orders.get(orderId);
  if (!order) return null;
  if (isAdmin) return order;
  if (requesterUserId && order.userId === requesterUserId) return order;
  return null; // pedido ajeno o de invitado consultado por usuario distinto
}

// Confirmación de pago (operación separada de la creación).
export function confirmPayment(
  store: OrderStore,
  orderId: string,
  status: "paid" | "rejected",
  actor: string
): { ok: boolean; error?: string } {
  const order = store.orders.get(orderId);
  if (!order) return { ok: false, error: "Pedido no encontrado." };
  const nowIso = new Date().toISOString();
  if (status === "paid") {
    order.paymentStatus = "paid";
    order.fulfillmentStatus = "processing";
  } else {
    order.paymentStatus = "rejected";
    order.fulfillmentStatus = "cancelled";
    // Liberar stock si estaba reservado.
    if (!order.stockReleased) {
      const its = store.items.get(orderId) ?? [];
      for (const it of its) {
        const p = store.products.get(it.productId);
        if (p) p.stock += it.quantity;
      }
      order.stockReleased = true;
    }
  }
  order.updatedAt = nowIso;
  store.history.get(orderId)?.push({
    orderId,
    actor,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    reason: `confirmación de pago: ${status}`,
    createdAt: nowIso,
  });
  return { ok: true };
}
