/**
 * Motor de cálculo de importes — FUENTE ÚNICA DE VERDAD
 * =====================================================
 * Todas las pantallas (carrito, drawer, checkout, resumen) deben calcular
 * subtotal, envío y total con estas funciones. No duplicar la lógica.
 *
 * Reglas vigentes (provisionales, pendientes de confirmación comercial):
 *  - Retiro en local: envío $0.
 *  - Envío a domicilio: costo por defecto hasta alcanzar el umbral de envío
 *    gratis; desde ahí, $0.
 *  - Los valores viven únicamente en `siteConfig.shipping`.
 *
 * Importes en pesos argentinos (enteros de cara al usuario), tal como los
 * usa la capa de datos local. La versión en centavos del esquema Supabase
 * vive en src/types/domain.ts y se aplicará al migrar la capa de datos.
 */

import { siteConfig } from "@/config/site";

/** Lee la configuración de envíos guardada por el admin (localStorage). */
function getShippingConfig(): { freeThreshold: number; defaultCost: number } {
  if (typeof window === "undefined") {
    return {
      freeThreshold: siteConfig.shipping.freeThreshold,
      defaultCost: siteConfig.shipping.defaultCost,
    };
  }
  try {
    const raw = localStorage.getItem("aventus-shipping-config");
    if (raw) {
      const parsed = JSON.parse(raw) as { freeThreshold?: number; defaultCost?: number };
      const freeThreshold =
        typeof parsed.freeThreshold === "number" && parsed.freeThreshold >= 0
          ? parsed.freeThreshold
          : siteConfig.shipping.freeThreshold;
      const defaultCost =
        typeof parsed.defaultCost === "number" && parsed.defaultCost >= 0
          ? parsed.defaultCost
          : siteConfig.shipping.defaultCost;
      return { freeThreshold, defaultCost };
    }
  } catch {
    // ignore
  }
  return {
    freeThreshold: siteConfig.shipping.freeThreshold,
    defaultCost: siteConfig.shipping.defaultCost,
  };
}

export type DeliveryMethod = "retiro" | "envio";

export interface PricedLine {
  price: number;
  quantity: number;
}

/** Límite de unidades por producto (máximo = stock disponible). */
export function clampQuantity(quantity: number, stock: number): number {
  if (!Number.isFinite(quantity) || quantity < 1) return stock > 0 ? 1 : 0;
  if (stock <= 0) return 0;
  return Math.min(Math.floor(quantity), stock);
}

/** Suma de precio × cantidad para todas las líneas. */
export function computeSubtotal(lines: readonly PricedLine[]): number {
  return lines.reduce(
    (sum, line) => sum + line.price * Math.max(0, line.quantity),
    0
  );
}

/**
 * Costo de envío para un subtotal dado.
 * `retiro` siempre es $0; `envio` aplica umbral de envío gratis.
 */
export function computeShipping(
  subtotal: number,
  deliveryMethod: DeliveryMethod
): number {
  if (deliveryMethod === "retiro") return 0;
  if (subtotal <= 0) return 0;
  const { freeThreshold, defaultCost } = getShippingConfig();
  if (freeThreshold > 0 && subtotal >= freeThreshold) return 0;
  return defaultCost;
}

/** Total = subtotal + envío. */
export function computeTotal(
  subtotal: number,
  deliveryMethod: DeliveryMethod
): number {
  return subtotal + computeShipping(subtotal, deliveryMethod);
}

/** Cuánto falta (>=0) para desbloquear envío gratis; 0 si ya está desbloqueado. */
export function freeShippingRemaining(subtotal: number): number {
  const { freeThreshold } = getShippingConfig();
  if (freeThreshold <= 0) return 0;
  return Math.max(0, freeThreshold - subtotal);
}

/** Progreso (0-100) hacia el envío gratis. */
export function freeShippingProgress(subtotal: number): number {
  const { freeThreshold } = getShippingConfig();
  if (freeThreshold <= 0) return 100;
  return Math.min((subtotal / freeThreshold) * 100, 100);
}

export interface StockCheckItem {
  productId: string;
  quantity: number;
  /** Stock actual (reconsultado en el momento de confirmar). */
  stock: number;
}

export interface StockIssue {
  productId: string;
  requested: number;
  available: number;
}

/**
 * Detecta líneas cuya cantidad supera el stock vigente. Se usa en el checkout
 * para revalidar contra la fuente de datos antes de crear el pedido.
 */
export function findStockIssues(items: readonly StockCheckItem[]): StockIssue[] {
  return items
    .filter((item) => item.quantity > item.stock || item.stock <= 0)
    .map((item) => ({
      productId: item.productId,
      requested: item.quantity,
      available: Math.max(0, item.stock),
    }));
}
