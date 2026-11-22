/**
 * Agregaciones del dashboard administrativo (Fase F)
 * =================================================
 * Todas las métricas se calculan en el SERVIDOR (service_role) a partir de
 * los pedidos reales de Supabase. El navegador nunca descarga la lista
 * completa para calcular estadísticas.
 *
 * Convenciones:
 *   - "Venta válida" = pedido NO cancelado (status != cancelado). Se usa
 *     `total_cents` como importe de la venta.
 *   - "Dinero cobrado" = pagos con payment_status = 'paid' (importe total).
 *   - "Pendiente de cobro" = total - cobrado de pedidos no cancelados.
 *   - "Pendiente de despacho" = pedidos pagados con shipping_status != entregado
 *     y != problema... en realidad: pagados y shipping_status in (sin_preparar, preparando).
 *   - Fechas: los parámetros from/to son ISO UTC; la conversión a la zona de
 *     Argentina se hace en el cliente al armar los rangos.
 */

import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { centsToPesos } from "@/lib/orderMapping";

function safeNum(v: any): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

async function fetchOrdersInRange(from: string, to: string): Promise<any[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("orders")
    .select("id, order_number, created_at, payment_status, fulfillment_status, shipping_status, payment_method, total_cents, subtotal_cents, shipping_cents, discount_cents, customer_name, customer_phone, customer_email, user_id, stock_released, order_items(product_id, name, brand_name, quantity, unit_price_cents, line_total_cents, cost_cents)")
    .gte("created_at", from)
    .lte("created_at", to);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface Kpis {
  totalOrders: number;
  pendingPayment: number;
  paidOrders: number;
  cancelledOrders: number;
  totalRevenue: number; // pesos, ventas válidas
  collectedRevenue: number; // pesos, pagado
  pendingCollection: number; // pesos
  averageTicket: number; // pesos
  pendingDispatch: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  comparison: {
    revenueChange: number; // % vs período anterior
    ordersChange: number;
    ticketChange: number;
  };
}

export async function getKpis(from: string, to: string): Promise<Kpis> {
  const admin = getSupabaseAdmin();
  const current = await fetchOrdersInRange(from, to);

  // período anterior (misma duración)
  const duration = new Date(to).getTime() - new Date(from).getTime();
  const prevFrom = new Date(new Date(from).getTime() - duration).toISOString();
  const prevTo = new Date(new Date(to).getTime() - duration).toISOString();
  const previous = await fetchOrdersInRange(prevFrom, prevTo);

  function calc(orders: any[]) {
    const valid = orders.filter((o) => o.payment_status !== "expired" && o.fulfillment_status !== "cancelled");
    // cancelled = fulfillment cancelled OR payment expired/refunded due to cancel
    const cancelled = orders.filter((o) => o.fulfillment_status === "cancelled").length;
    const paid = orders.filter((o) => o.payment_status === "paid");
    const revenue = valid.reduce((a, o) => a + (o.total_cents ?? 0), 0);
    const collected = paid.reduce((a, o) => a + (o.total_cents ?? 0), 0);
    const pendingPayment = orders.filter((o) => o.payment_status === "pending" || o.payment_status === "partial").length;
    const pendingDispatch = paid.filter((o) => o.shipping_status === "sin_preparar" || o.shipping_status === "preparando").length;
    return {
      totalOrders: orders.length,
      cancelled,
      paidOrders: paid.length,
      pendingPayment,
      pendingDispatch,
      revenue,
      collected,
      averageTicket: valid.length > 0 ? revenue / valid.length : 0,
    };
  }

  const c = calc(current);
  const p = calc(previous);

  // stock
  const { data: products } = await admin.from("products").select("stock");
  const lowStock = (products ?? []).filter((pr: any) => pr.stock > 0 && pr.stock <= 5).length;
  const outOfStock = (products ?? []).filter((pr: any) => pr.stock === 0).length;

  const pct = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : 0);

  return {
    totalOrders: c.totalOrders,
    pendingPayment: c.pendingPayment,
    paidOrders: c.paidOrders,
    cancelledOrders: c.cancelled,
    totalRevenue: centsToPesos(c.revenue),
    collectedRevenue: centsToPesos(c.collected),
    pendingCollection: centsToPesos(c.revenue - c.collected),
    averageTicket: centsToPesos(c.averageTicket),
    pendingDispatch: c.pendingDispatch,
    lowStockProducts: lowStock,
    outOfStockProducts: outOfStock,
    comparison: {
      revenueChange: pct(c.revenue, p.revenue),
      ordersChange: pct(c.totalOrders, p.totalOrders),
      ticketChange: pct(c.averageTicket, p.averageTicket),
    },
  };
}

export interface SeriesPoint {
  key: string; // label
  revenue: number; // pesos
  orders: number;
  prevRevenue: number;
  prevOrders: number;
}

export async function getSalesSeries(from: string, to: string, granularity: "day" | "week" | "month" | "year"): Promise<SeriesPoint[]> {
  const duration = new Date(to).getTime() - new Date(from).getTime();
  const prevFrom = new Date(new Date(from).getTime() - duration).toISOString();
  const prevTo = new Date(new Date(to).getTime() - duration).toISOString();

  const [cur, prev] = await Promise.all([fetchOrdersInRange(from, to), fetchOrdersInRange(prevFrom, prevTo)]);

  function bucketKey(iso: string): string {
    const d = new Date(iso);
    if (granularity === "day") return d.toISOString().slice(0, 10);
    if (granularity === "week") {
      // ISO week: Monday-based. Use date of Monday.
      const day = d.getUTCDay();
      const diff = (day === 0 ? -6 : 1) - day;
      const monday = new Date(d);
      monday.setUTCDate(d.getUTCDate() + diff);
      return monday.toISOString().slice(0, 10);
    }
    if (granularity === "month") return d.toISOString().slice(0, 7);
    return d.toISOString().slice(0, 4);
  }

  function aggregate(orders: any[]): Map<string, { revenue: number; orders: number }> {
    const m = new Map<string, { revenue: number; orders: number }>();
    for (const o of orders) {
      if (o.fulfillment_status === "cancelled") continue;
      const k = bucketKey(o.created_at);
      const e = m.get(k) ?? { revenue: 0, orders: 0 };
      e.revenue += o.total_cents ?? 0;
      e.orders += 1;
      m.set(k, e);
    }
    return m;
  }

  const curMap = aggregate(cur);
  const prevMap = aggregate(prev);

  // Build sorted keys from current
  const keys = Array.from(curMap.keys()).sort();
  // Align previous by index (shifted)
  const prevKeys = Array.from(prevMap.keys()).sort();

  return keys.map((k, i) => {
    const c = curMap.get(k)!;
    const pk = prevKeys[i];
    const p = pk ? prevMap.get(pk)! : { revenue: 0, orders: 0 };
    return {
      key: k,
      revenue: centsToPesos(c.revenue),
      orders: c.orders,
      prevRevenue: centsToPesos(p.revenue),
      prevOrders: p.orders,
    };
  });
}

export interface MonthlyRow {
  month: string; // YYYY-MM
  orders: number;
  revenue: number; // pesos
  collected: number;
  averageTicket: number;
  change: number; // % vs mes anterior
}

export async function getMonthly(year: number): Promise<{ rows: MonthlyRow[]; bestMonth: string | null; totalRevenue: number; growthVsPrevYear: number }> {
  const admin = getSupabaseAdmin();
  const from = `${year}-01-01T00:00:00.000Z`;
  const to = `${year}-12-31T23:59:59.999Z`;
  const rows = await fetchOrdersInRange(from, to);

  // previous year for growth
  const prevFrom = `${year - 1}-01-01T00:00:00.000Z`;
  const prevTo = `${year - 1}-12-31T23:59:59.999Z`;
  const prevRows = await fetchOrdersInRange(prevFrom, prevTo);

  const byMonth = new Map<string, { orders: number; revenue: number; collected: number }>();
  for (let m = 1; m <= 12; m++) {
    const k = `${year}-${String(m).padStart(2, "0")}`;
    byMonth.set(k, { orders: 0, revenue: 0, collected: 0 });
  }
  for (const o of rows) {
    if (o.fulfillment_status === "cancelled") continue;
    const k = o.created_at.slice(0, 7);
    const e = byMonth.get(k);
    if (!e) continue;
    e.orders += 1;
    e.revenue += o.total_cents ?? 0;
    if (o.payment_status === "paid") e.collected += o.total_cents ?? 0;
  }

  const result: MonthlyRow[] = [];
  let prevRevenue = 0;
  for (let m = 1; m <= 12; m++) {
    const k = `${year}-${String(m).padStart(2, "0")}`;
    const e = byMonth.get(k)!;
    const change = prevRevenue > 0 ? ((e.revenue - prevRevenue) / prevRevenue) * 100 : 0;
    result.push({
      month: k,
      orders: e.orders,
      revenue: centsToPesos(e.revenue),
      collected: centsToPesos(e.collected),
      averageTicket: e.orders > 0 ? centsToPesos(e.revenue / e.orders) : 0,
      change,
    });
    prevRevenue = e.revenue;
  }

  const best = result.reduce((a, b) => (b.revenue > a.revenue ? b : a), result[0]);
  const bestMonth = best && best.revenue > 0 ? best.month : null;
  const totalRevenue = centsToPesos(result.reduce((a, r) => a + r.revenue * 100, 0));
  const curYearRevenue = result.reduce((a, r) => a + r.revenue, 0) * 100;
  const prevYearRevenue = prevRows.filter((o) => o.fulfillment_status !== "cancelled").reduce((a: number, o: any) => a + (o.total_cents ?? 0), 0);
  const growth = prevYearRevenue > 0 ? ((curYearRevenue - prevYearRevenue) / prevYearRevenue) * 100 : 0;

  return { rows: result, bestMonth, totalRevenue, growthVsPrevYear: growth };
}

export interface ProductRanking {
  productId: string;
  name: string;
  brandName: string;
  imageUrl: string | null;
  unitsSold: number;
  orderCount: number;
  revenue: number; // pesos
  share: number; // % of total revenue
}

export async function getProductRanking(from: string, to: string): Promise<{ top: ProductRanking[]; least: ProductRanking[]; noSales: string[]; topRevenue: ProductRanking[] }> {
  const orders = await fetchOrdersInRange(from, to);
  const valid = orders.filter((o) => o.fulfillment_status !== "cancelled");

  const agg = new Map<string, { name: string; brandName: string; imageUrl: string | null; units: number; orders: Set<string>; revenue: number }>();
  for (const o of valid) {
    for (const it of o.order_items ?? []) {
      const e = agg.get(it.product_id) ?? { name: it.name, brandName: it.brand_name, imageUrl: it.image_url, units: 0, orders: new Set(), revenue: 0 };
      e.units += it.quantity;
      e.orders.add(o.id);
      e.revenue += it.line_total_cents ?? 0;
      if (!e.name) e.name = it.name;
      agg.set(it.product_id, e);
    }
  }

  const totalRevenue = Array.from(agg.values()).reduce((a, e) => a + e.revenue, 0);
  const ranking: ProductRanking[] = Array.from(agg.entries()).map(([id, e]) => ({
    productId: id,
    name: e.name,
    brandName: e.brandName,
    imageUrl: e.imageUrl,
    unitsSold: e.units,
    orderCount: e.orders.size,
    revenue: centsToPesos(e.revenue),
    share: totalRevenue > 0 ? (e.revenue / totalRevenue) * 100 : 0,
  }));

  const top = [...ranking].sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 10);
  const least = [...ranking].sort((a, b) => a.unitsSold - b.unitsSold).slice(0, 10);
  const topRevenue = [...ranking].sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  // Productos sin ventas: todos los activos menos los que aparecen
  const admin = getSupabaseAdmin();
  const { data: allProducts } = await admin.from("products").select("id, name, is_active").eq("is_active", true);
  const soldIds = new Set(agg.keys());
  const noSales = (allProducts ?? []).filter((p: any) => !soldIds.has(p.id)).map((p: any) => p.name);

  return { top, least, noSales, topRevenue };
}

export interface PaymentMethodRow {
  method: string;
  count: number;
  collected: number; // pesos
  share: number;
}

export async function getPaymentMethods(from: string, to: string): Promise<PaymentMethodRow[]> {
  const orders = await fetchOrdersInRange(from, to);
  const paid = orders.filter((o) => o.payment_status === "paid");
  const total = paid.reduce((a, o) => a + (o.total_cents ?? 0), 0);
  const agg = new Map<string, { count: number; collected: number }>();
  for (const o of paid) {
    const m = o.payment_method ?? "otro";
    const e = agg.get(m) ?? { count: 0, collected: 0 };
    e.count += 1;
    e.collected += o.total_cents ?? 0;
    agg.set(m, e);
  }
  return Array.from(agg.entries()).map(([method, e]) => ({
    method,
    count: e.count,
    collected: centsToPesos(e.collected),
    share: total > 0 ? (e.collected / total) * 100 : 0,
  }));
}

export async function getWeekday(from: string, to: string): Promise<{ day: number; label: string; orders: number; revenue: number }[]> {
  const orders = await fetchOrdersInRange(from, to);
  const valid = orders.filter((o) => o.fulfillment_status !== "cancelled");
  const labels = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const agg = Array.from({ length: 7 }, (_, i) => ({ day: i, label: labels[i], orders: 0, revenue: 0 }));
  for (const o of valid) {
    const d = new Date(o.created_at);
    const day = d.getUTCDay();
    agg[day].orders += 1;
    agg[day].revenue += o.total_cents ?? 0;
  }
  return agg.map((a) => ({ ...a, revenue: centsToPesos(a.revenue) }));
}

export async function getRecentActivity(limit = 20): Promise<any[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("order_activity_log")
    .select("id, order_id, actor, event_type, field, old_value, new_value, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  // Resolver order_number
  const orderIds = Array.from(new Set((data ?? []).map((r: any) => r.order_id)));
  const { data: orders } = await admin.from("orders").select("id, order_number, customer_name").in("id", orderIds);
  const byId = new Map((orders ?? []).map((o: any) => [o.id, o]));
  return (data ?? []).map((r: any) => ({
    ...r,
    orderNumber: byId.get(r.order_id)?.order_number ?? null,
    customerName: byId.get(r.order_id)?.customer_name ?? null,
  }));
}

export async function getAlerts(): Promise<{
  pendingPayment: any[];
  paidNotDispatched: any[];
  noTracking: any[];
  shippingProblems: any[];
  lowStock: any[];
  outOfStock: any[];
}> {
  const admin = getSupabaseAdmin();
  const { data: orders } = await admin
    .from("orders")
    .select("id, order_number, customer_name, customer_phone, payment_status, shipping_status, shipping_tracking_code, created_at, total_cents")
    .neq("fulfillment_status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(200);

  const pendingPayment = (orders ?? []).filter((o: any) => o.payment_status === "pending" || o.payment_status === "partial");
  const paidNotDispatched = (orders ?? []).filter((o: any) => o.payment_status === "paid" && (o.shipping_status === "sin_preparar" || o.shipping_status === "preparando"));
  const noTracking = (orders ?? []).filter((o: any) => (o.shipping_status === "despachado" || o.shipping_status === "en_transito") && !o.shipping_tracking_code);
  const shippingProblems = (orders ?? []).filter((o: any) => o.shipping_status === "problema");

  const { data: products } = await admin.from("products").select("id, name, stock, is_active").eq("is_active", true);
  const lowStock = (products ?? []).filter((p: any) => p.stock > 0 && p.stock <= 5);
  const outOfStock = (products ?? []).filter((p: any) => p.stock === 0);

  return { pendingPayment, paidNotDispatched, noTracking, shippingProblems, lowStock, outOfStock };
}

export interface Profitability {
  revenue: number; // pesos
  cost: number; // pesos
  grossProfit: number; // pesos
  margin: number; // %
  hasCostData: boolean;
  ordersWithCost: number;
  ordersWithoutCost: number;
}

export async function getProfitability(from: string, to: string): Promise<Profitability> {
  const orders = await fetchOrdersInRange(from, to);
  const valid = orders.filter((o) => o.fulfillment_status !== "cancelled");

  let revenue = 0;
  let cost = 0;
  let hasCostData = false;
  let ordersWithCost = 0;
  let ordersWithoutCost = 0;

  for (const o of valid) {
    revenue += o.total_cents ?? 0;
    let orderHasCost = true;
    let orderCost = 0;
    for (const it of o.order_items ?? []) {
      if (it.cost_cents == null) {
        orderHasCost = false;
      } else {
        hasCostData = true;
        orderCost += (it.cost_cents ?? 0) * (it.quantity ?? 0);
      }
    }
    if (orderHasCost && (o.order_items ?? []).length > 0) {
      cost += orderCost;
      ordersWithCost += 1;
    } else {
      ordersWithoutCost += 1;
    }
  }

  const grossProfit = revenue - cost;
  const margin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

  return {
    revenue: centsToPesos(revenue),
    cost: centsToPesos(cost),
    grossProfit: centsToPesos(grossProfit),
    margin,
    hasCostData,
    ordersWithCost,
    ordersWithoutCost,
  };
}
