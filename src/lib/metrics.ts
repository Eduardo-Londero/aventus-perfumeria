/**
 * Indicadores del panel — FUENTE ÚNICA DE VERDAD
 * ==============================================
 * Funciones puras y testeables. El dashboard (y más adelante el reporte de
 * ventas) deben calcular los KPIs acá, no reimplementarlos en la vista.
 *
 * Regla de negocio documentada (Fase 8.1):
 *  - VENTA CONFIRMADA = pedido cuyo estado es "confirmado", "enviado" o
 *    "entregado".
 *  - NO cuentan como venta: "no-concretado" (pedido sin confirmar) y
 *    "cancelado". Así ningún pedido fallido ni pendiente infla las cifras.
 *  - Los importes se toman de `order.total` (subtotal + envío) ya calculado
 *    por el motor de precios en el momento de crear el pedido.
 *  - La evolución diaria agrupa por fecha UTC (`YYYY-MM-DD`) para que el
 *    cálculo sea determinista y no dependa de la zona horaria del navegador.
 */

import type { Order, OrderStatus, Product } from "@/types";

/** Estados que sí representan una venta confirmada. */
export const CONFIRMED_SALE_STATUSES: readonly OrderStatus[] = [
  "confirmado",
  "enviado",
  "entregado",
];

/** Estados que jamás cuentan como venta. */
export const EXCLUDED_SALE_STATUSES: readonly OrderStatus[] = [
  "no-concretado",
  "cancelado",
];

/** Umbral por defecto de "stock bajo" (unidades). */
export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

export interface DailySales {
  /** Fecha en formato YYYY-MM-DD (UTC). */
  date: string;
  orders: number;
  revenue: number;
}

export interface DashboardMetrics {
  totalOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  confirmedOrders: number;
  /** Suma de `total` de los pedidos confirmados. */
  confirmedRevenue: number;
  /** Ticket promedio de los pedidos confirmados (0 si no hay). */
  averageTicket: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  /** Serie de `days` días terminando en `now`, con días vacíos en 0. */
  salesByDay: DailySales[];
}

export interface MetricsOptions {
  /** Fecha de referencia (por defecto, ahora). Útil para pruebas. */
  now?: Date;
  /** Cantidad de días de la serie. */
  days?: number;
  /** Umbral de stock bajo. */
  lowStockThreshold?: number;
}

export function isConfirmedSale(status: OrderStatus): boolean {
  return CONFIRMED_SALE_STATUSES.includes(status);
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

export function computeDashboardMetrics(
  orders: readonly Order[],
  products: readonly Product[],
  options: MetricsOptions = {}
): DashboardMetrics {
  const now = options.now ?? new Date();
  const days = Math.max(1, options.days ?? 7);
  const lowStockThreshold = options.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;

  const confirmed = orders.filter((order) => isConfirmedSale(order.status));
  const pendingOrders = orders.filter((order) => order.status === "no-concretado");
  const cancelledOrders = orders.filter((order) => order.status === "cancelado");

  const confirmedRevenue = confirmed.reduce((sum, order) => sum + order.total, 0);

  // Serie diaria: mapa fecha -> acumulado
  const byDay = new Map<string, DailySales>();
  for (const order of confirmed) {
    const timestamp = new Date(order.date).getTime();
    if (Number.isNaN(timestamp)) continue;
    const key = toDateKey(new Date(timestamp));
    const entry = byDay.get(key) ?? { date: key, orders: 0, revenue: 0 };
    entry.orders += 1;
    entry.revenue += order.total;
    byDay.set(key, entry);
  }

  // Relleno de la serie (de más viejo a más reciente, incluyendo hoy)
  const today = toDateKey(now);
  const series: DailySales[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const key = toDateKey(addDays(new Date(now.getTime()), -offset));
    const found = byDay.get(key);
    series.push(found ?? { date: key, orders: 0, revenue: 0 });
  }
  // Garantiza que hoy esté siempre presente aunque `now` sea futurista
  if (series[series.length - 1]?.date !== today && days > 0) {
    series[series.length - 1] = { date: today, orders: 0, revenue: 0 };
  }

  return {
    totalOrders: orders.length,
    pendingOrders: pendingOrders.length,
    cancelledOrders: cancelledOrders.length,
    confirmedOrders: confirmed.length,
    confirmedRevenue,
    averageTicket: confirmed.length > 0 ? confirmedRevenue / confirmed.length : 0,
    lowStockProducts: products.filter(
      (product) => product.stock > 0 && product.stock <= lowStockThreshold
    ).length,
    outOfStockProducts: products.filter((product) => product.stock === 0).length,
    salesByDay: series,
  };
}
