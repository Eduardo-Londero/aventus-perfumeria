/**
 * Tipos TypeScript de Aventus Perfumería
 * ========================================
 * Estructura de datos preparada para conectar con una base de datos real.
 */

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string; // ID de la marca
  description: string;
  longDescription?: string;
  price: number;
  previousPrice?: number;
  discount?: number;
  images: string[];
  categories: string[]; // IDs de categorías (múltiples)
  gender: string; // ID del género (único)
  size: string;
  concentration: string;
  olfactoryFamily: string;
  notes: {
    top: string[];
    heart: string[];
    base: string[];
  };
  stock: number;
  featured: boolean;
  isActive: boolean;
  isOnSale: boolean;
  isNew: boolean;
  createdAt: string;
  soldCount?: number;
}

export interface Brand {
  id: string;
  slug: string;
  name: string;
  description?: string;
  logo?: string;
  image?: string;
  website?: string;
  isActive: boolean;
  order: number;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
  image: string;
  isActive: boolean;
  order: number;
  parentId?: string;
}

export interface Gender {
  id: string;
  name: string;
  isActive: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface OrderItemSnapshot {
  productId: string;
  name: string;
  brand: string;
  image: string;
  size: string;
  concentration?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export type OrderStatus =
  | "no-concretado"
  | "confirmado"
  | "enviado"
  | "entregado"
  | "cancelado";

export interface Order {
  id: string;
  date: string;
  customer: {
    name: string;
    lastName: string;
    phone: string;
    email: string;
    address?: string;
    city?: string;
    province?: string;
    postalCode?: string;
  };
  items: OrderItemSnapshot[];
  subtotal: number;
  shippingCost: number;
  total: number;
  deliveryMethod: "retiro" | "envio";
  paymentMethod: string;
  status: OrderStatus;
  statusHistory: { status: OrderStatus; date: string }[];
  userId?: string;
  /**
   * Observaciones del admin (transporte, código de seguimiento, etc.).
   */
  observations?: string;
  /**
   * Indica si este pedido descontó stock al crearse (reserva activa).
   * Se usa para liberar el inventario exactamente una vez al cancelar:
   * pedidos antiguos sin este campo nunca reservaron y no lo liberan.
   */
  stockReserved?: boolean;
  // Campos extendidos (gestión profesional de pedidos)
  customerProvince?: string;
  internalNotes?: string;
  customerNotes?: string;
  discount?: number;
  paymentStatus?: string;
  paymentAmountPaid?: number;
  paymentPaidAt?: string;
  paymentTransactionRef?: string;
  paymentNotes?: string;
  paymentUpdatedBy?: string;
  paymentUpdatedAt?: string;
  shippingCarrier?: string;
  shippingTrackingCode?: string;
  shippingDispatchedAt?: string;
  shippingStatus?: string;
  shippingNotes?: string;
  whatsappReference?: string;
  updatedAt?: string;
}

export interface FilterState {
  search: string;
  categories: string[];
  brands: string[];
  priceRange: [number, number];
  sizes: string[];
  gender: string[];
  olfactoryFamily: string[];
  onlyOffers: boolean;
  onlyNew: boolean;
  onlyInStock: boolean;
  sortBy: SortOption;
}

export type SortOption =
  | "featured"
  | "best-sellers"
  | "price-asc"
  | "price-desc"
  | "newest";

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
}
