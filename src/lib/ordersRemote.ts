/**
 * Pedidos en modo `supabase` — flujo del cliente
 * ===============================================
 * Complementa src/lib/db.ts, donde `dbOrders.*` sigue bloqueado a propósito
 * en el backend remoto (la API síncrona no puede hablar con la red). Este
 * módulo expone las operaciones ASÍNCRONAS que sí usan las páginas:
 *
 *   - `createRemoteOrder`   → RPC `create_order_atomic` (el servidor valida
 *                             precios, stock y dueño; el cliente solo manda
 *                             items + datos de entrega).
 *   - `fetchUserRemoteOrders` → SELECT de los PEDIDOS PROPIOS (RLS:
 *                             `orders_owner_read` solo deja ver lo del JWT).
 *   - `fetchAllOrdersAdmin` / `updateRemoteOrderStatus` → van por
 *     /api/admin/orders (service_role tras la cookie del panel): el
 *     administrador NO tiene sesión de Supabase Auth, así que no puede
 *     leer/escribir pedidos ajenos por RLS.
 *
 * El cliente jamás decide precios, stock, estado de pago ni propietario.
 */

import { getSupabase } from "@/lib/supabaseClient";
import {
  mapOrderRow,
  type OrderHistoryRow,
  type OrderItemRow,
  type OrderRow,
} from "@/lib/orderMapping";
import { mirrorStockReserve } from "@/lib/db";
import type { Order, OrderItemSnapshot, OrderStatus } from "@/types";

/** Selección con items + historial embebidos (PostgREST). */
const ORDER_SELECT = "*, order_items(*), order_status_history(*)";

type OrderWithRelations = OrderRow & {
  order_items?: OrderItemRow[];
  order_status_history?: OrderHistoryRow[];
};

export interface RemoteCreateOrderInput {
  items: OrderItemSnapshot[];
  deliveryMethod: "retiro" | "envio";
  paymentMethod: string;
  customer: {
    name: string;
    lastName: string;
    phone: string;
    email: string;
    address?: string;
    city?: string;
    postalCode?: string;
  };
}

interface OrderRpcResult {
  ok: boolean;
  order_id?: string;
  order_number?: string;
  idempotent?: boolean;
  error?: { code?: string; message?: string };
}

/** Construye un pedido "a confirmación" cuando el SELECT de vuelta falla. */
function fallbackOrder(
  input: RemoteCreateOrderInput,
  orderNumber: string,
  userId: string
): Order {
  const now = new Date().toISOString();
  return {
    id: orderNumber,
    date: now,
    customer: input.customer,
    items: input.items,
    subtotal: input.items.reduce((sum, i) => sum + i.subtotal, 0),
    shippingCost: 0,
    total: input.items.reduce((sum, i) => sum + i.subtotal, 0),
    deliveryMethod: input.deliveryMethod,
    paymentMethod: input.paymentMethod,
    status: "no-concretado",
    statusHistory: [{ status: "no-concretado", date: now }],
    userId,
    stockReserved: true,
  };
}

/**
 * Crea el pedido contra la RPC `create_order_atomic`.
 * Lanza `Error` con mensaje apto para el usuario (la RPC responde en
 * español: stock insuficiente, datos incompletos…).
 */
export async function createRemoteOrder(
  input: RemoteCreateOrderInput
): Promise<Order> {
  const supabase = getSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) {
    throw new Error("Iniciá sesión para completar la compra.");
  }

  const payload = {
    items: input.items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
      client_price: item.unitPrice, // el servidor lo ignora: solo referencia
    })),
    delivery_method: input.deliveryMethod,
    payment_method: input.paymentMethod,
    customer: {
      name: input.customer.name,
      last_name: input.customer.lastName,
      phone: input.customer.phone,
      email: input.customer.email,
      ...(input.deliveryMethod === "envio"
        ? {
            address: input.customer.address ?? "",
            city: input.customer.city ?? "",
            postal_code: input.customer.postalCode ?? "",
          }
        : {}),
    },
    idempotency_key:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : undefined,
  };

  const { data, error } = await supabase.rpc("create_order_atomic", {
    payload,
  });
  if (error) {
    throw new Error(`No se pudo crear el pedido: ${error.message}`);
  }

  const result = data as OrderRpcResult | null;
  if (!result?.ok) {
    throw new Error(
      result?.error?.message ?? "No se pudo crear el pedido. Intentá nuevamente."
    );
  }

  // Reserva reflejada en el catálogo en memoria (la RPC ya descontó en la DB):
  // así el carrito no ofrece unidades que ya no existen hasta el próximo
  // arranque. Si falla, el siguiente checkout lo frenará el servidor igual.
  try {
    mirrorStockReserve(input.items);
  } catch {
    // degradación cosmética: no bloquea la compra confirmada
  }

  // Volver a leer el pedido creado (importes reales calculados por el
  // servidor: el envío gratis/valorado lo decide la RPC, no el cliente).
  try {
    const { data: row } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("id", result.order_id!)
      .maybeSingle();
    if (row) {
      return mapOrderRow(row as OrderWithRelations, input.customer.email);
    }
  } catch {
    // cae al fallback de abajo
  }

  return fallbackOrder(
    input,
    result.order_number ?? "AV-?",
    session.user.id
  );
}

/** Pedidos del usuario autenticado (RLS ya filtra; el eq es redundante y explícito). */
export async function fetchUserRemoteOrders(): Promise<Order[]> {
  const supabase = getSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return [];

  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`No se pudieron cargar tus pedidos: ${error.message}`);
  }

  const email = session.user.email ?? "";
  return ((data ?? []) as OrderWithRelations[]).map((row) =>
    mapOrderRow(row, email)
  );
}

// ---------------------------------------------------------------------------
// Panel de administración (vía API con service_role)
// ---------------------------------------------------------------------------

async function adminFetch<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await res.json().catch(() => null)) as
    | { ok?: boolean; message?: string }
    | null;
  if (!res.ok || !body?.ok) {
    throw new Error(
      body?.message ?? `Error al consultar los pedidos (${res.status}).`
    );
  }
  return body as T;
}

/** Todos los pedidos de la tienda (solo con sesión de administrador). */
export async function fetchAllOrdersAdmin(): Promise<Order[]> {
  const body = await adminFetch<{ ok: true; orders: Order[] }>(
    "/api/admin/orders"
  );
  return body.orders;
}

/**
 * Cambia el estado de un pedido desde el panel. La transición se valida en
 * el servidor con la MISMA máquina de estados (src/lib/orderStatus.ts);
 * acá solo se propone. `orderId` es el número de pedido (AV-…).
 */
export async function updateRemoteOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<void> {
  await adminFetch<{ ok: true }>(
    `/api/admin/orders/${encodeURIComponent(orderId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }
  );
}
