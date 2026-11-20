/**
 * Tipos canónicos de dominio — AVT-DOM-2026-01
 * =============================================
 * F1 (autorizada 16/10/2026): tipos alineados con el esquema de migraciones
 * en supabase/migrations/. IMPORTES EN CENTAVOS ENTEROS (bigint).
 *
 * Estos tipos son ADITIVOS: no reemplazan aún a src/types/index.ts, que el
 * código actual (localStorage) sigue usando. La migración de la capa de datos
 * ocurre en F2/F3 con autorización propia.
 */

/** Estados de pago del pedido (eje dinero). */
export type PaymentStatus =
  | "pending"
  | "paid"
  | "rejected"
  | "refunded"
  | "expired"
  | "discrepancy"
  | "partial";

/** Estados logísticos del pedido (eje operación). */
export type FulfillmentStatus =
  | "awaiting_payment"
  | "processing"
  | "ready_for_pickup"
  | "shipped"
  | "delivered"
  | "cancelled";

export type ShippingStatus =
  | "sin_preparar"
  | "preparando"
  | "despachado"
  | "en_transito"
  | "entregado"
  | "problema";

export type DeliveryMethod = "retiro" | "envio";
export type PaymentMethod = "transferencia" | "efectivo";

export interface OrderActivityLog {
  id: string;
  orderId: string;
  actor: string;
  eventType: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}
export type UserRole = "customer" | "admin";

/** Perfil — espejo de public.profiles. */
export interface Profile {
  id: string; // uuid de auth.users
  role: UserRole;
  fullName: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Pedido — espejo de public.orders. Importes en centavos. */
export interface Order {
  id: string;
  orderNumber: string;
  userId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  deliveryMethod: DeliveryMethod;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  subtotalCents: number;
  shippingCents: number;
  discountCents: number;
  totalCents: number;
  shipStreet: string | null;
  shipCity: string | null;
  shipProvince: string | null;
  shipPostalCode: string | null;
  shipRecipientName: string | null;
  shipRecipientPhone: string | null;
  reservationExpiresAt: string | null;
  stockReleased: boolean;
  paymentReference: string | null;
  paymentAmountPaidCents: number;
  paymentPaidAt: string | null;
  paymentTransactionRef: string | null;
  paymentNotes: string | null;
  paymentUpdatedBy: string | null;
  paymentUpdatedAt: string | null;
  shippingCarrier: string | null;
  shippingTrackingCode: string | null;
  shippingDispatchedAt: string | null;
  shippingStatus: ShippingStatus;
  shippingNotes: string | null;
  internalNotes: string | null;
  customerNotes: string | null;
  whatsappReference: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Snapshot inmutable de ítem — espejo de public.order_items. */
export interface OrderItemSnapshot {
  id: string;
  orderId: string;
  productId: string;
  name: string;
  brandName: string;
  imageUrl: string | null;
  size: string | null;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

/** Ajustes de la tienda (autoridad del servidor para envío). */
export interface StoreSettings {
  shippingFreeThresholdCents: number;
  shippingDefaultCostCents: number;
}
