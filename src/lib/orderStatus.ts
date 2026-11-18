/**
 * Máquina de estados de pedidos — FUENTE ÚNICA DE VERDAD
 * ======================================================
 * Controla qué transiciones de estado están permitidas. El panel administrativo
 * debe limitar las opciones a las válidas y rechazar el resto en el servidor de
 * datos (aquí, en la capa `dbOrders`), no solo ocultarlas en la interfaz.
 *
 * Ciclo de vida definido:
 *
 *   no-concretado ──▶ confirmado ──▶ enviado ──▶ entregado (final)
 *         │                │
 *         └──▶ cancelado (final) ◀──┘
 *
 *  - "cancelado" y "entregado" son estados terminales: no se reabren. Para
 *    reinstaurar un pedido cancelado hay que crear uno nuevo (histórico limpio).
 *  - Un pedido no concretado no puede "confirmarse solo"; depende de la
 *    confirmación explícita del negocio (WhatsApp / pago).
 */

import type { Order, OrderStatus } from "@/types";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  "no-concretado": "No concretado",
  confirmado: "Confirmado",
  enviado: "Enviado",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  "no-concretado": "bg-yellow-100 text-yellow-700",
  confirmado: "bg-blue-100 text-blue-700",
  enviado: "bg-indigo-100 text-indigo-700",
  entregado: "bg-green-100 text-green-700",
  cancelado: "bg-red-100 text-red-700",
};

export const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  "no-concretado": ["confirmado", "cancelado"],
  confirmado: ["enviado", "cancelado"],
  enviado: ["entregado"],
  entregado: [],
  cancelado: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Estados destino disponibles desde el estado actual (para poblar selects). */
export function allowedNextStatuses(from: OrderStatus): OrderStatus[] {
  return [...ALLOWED_TRANSITIONS[from]];
}

/**
 * Aplica una transición validada. Devuelve el pedido actualizado, o `null`
 * cuando la transición no está permitida (no se debe persistir nada).
 * Siempre agrega el evento al historial.
 */
export function applyStatusTransition(
  order: Order,
  next: OrderStatus,
  at: string = new Date().toISOString()
): Order | null {
  if (!canTransition(order.status, next)) return null;
  return {
    ...order,
    status: next,
    statusHistory: [...order.statusHistory, { status: next, date: at }],
  };
}
