"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useToast } from "@/context/ToastContext";
import { dbProducts } from "@/lib/db";
import { useCatalogSync } from "@/hooks/useCatalogSync";
import { formatPrice } from "@/config/site";
import { useAuth } from "@/context/AuthContext";

// ---------------------------------------------------------------------------
// Zona horaria Argentina (UTC-3, sin DST desde 2009)
// ---------------------------------------------------------------------------
const TZ = "America/Argentina/Buenos_Aires";

function argDateKey(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

function addDays(key: string, n: number): string {
  const d = new Date(key + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function addMonths(key: string, n: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7) + "-01";
}

function startOfDayArt(key: string): string {
  return `${key}T03:00:00.000Z`; // 00:00 ART = 03:00 UTC
}

function endOfDayArt(key: string): string {
  return `${addDays(key, 1)}T02:59:59.999Z`;
}

function mondayOf(key: string): string {
  const d = new Date(key + "T12:00:00Z");
  const day = d.getUTCDay(); // 0=dom
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function firstOfMonth(key: string): string {
  return key.slice(0, 7) + "-01";
}

function lastOfMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 0));
  return d.toISOString().slice(0, 10);
}

type PeriodPreset =
  | "today" | "yesterday" | "7d" | "30d" | "thisWeek" | "lastWeek"
  | "thisMonth" | "lastMonth" | "3m" | "6m" | "thisYear" | "lastYear" | "custom";

const PRESET_LABELS: Record<PeriodPreset, string> = {
  today: "Hoy",
  yesterday: "Ayer",
  "7d": "Últimos 7 días",
  "30d": "Últimos 30 días",
  thisWeek: "Esta semana",
  lastWeek: "Semana anterior",
  thisMonth: "Este mes",
  lastMonth: "Mes anterior",
  "3m": "Últimos 3 meses",
  "6m": "Últimos 6 meses",
  thisYear: "Este año",
  lastYear: "Año anterior",
  custom: "Personalizado",
};

function computeRange(preset: PeriodPreset, customFrom: string, customTo: string): { from: string; to: string; label: string } {
  const today = argDateKey();
  switch (preset) {
    case "today":
      return { from: startOfDayArt(today), to: endOfDayArt(today), label: "Hoy" };
    case "yesterday": {
      const y = addDays(today, -1);
      return { from: startOfDayArt(y), to: endOfDayArt(y), label: "Ayer" };
    }
    case "7d": {
      const from = addDays(today, -6);
      return { from: startOfDayArt(from), to: endOfDayArt(today), label: "Últimos 7 días" };
    }
    case "30d": {
      const from = addDays(today, -29);
      return { from: startOfDayArt(from), to: endOfDayArt(today), label: "Últimos 30 días" };
    }
    case "thisWeek": {
      const mon = mondayOf(today);
      return { from: startOfDayArt(mon), to: endOfDayArt(today), label: "Esta semana" };
    }
    case "lastWeek": {
      const thisMon = mondayOf(today);
      const lastMon = addDays(thisMon, -7);
      const lastSun = addDays(thisMon, -1);
      return { from: startOfDayArt(lastMon), to: endOfDayArt(lastSun), label: "Semana anterior" };
    }
    case "thisMonth": {
      const first = firstOfMonth(today);
      return { from: startOfDayArt(first), to: endOfDayArt(today), label: "Este mes" };
    }
    case "lastMonth": {
      const firstThis = firstOfMonth(today);
      const firstLast = addMonths(firstThis, -1).slice(0, 10);
      const lastLast = lastOfMonth(firstLast);
      return { from: startOfDayArt(firstLast), to: endOfDayArt(lastLast), label: "Mes anterior" };
    }
    case "3m": {
      const from = addMonths(today, -3).slice(0, 10);
      return { from: startOfDayArt(from), to: endOfDayArt(today), label: "Últimos 3 meses" };
    }
    case "6m": {
      const from = addMonths(today, -6).slice(0, 10);
      return { from: startOfDayArt(from), to: endOfDayArt(today), label: "Últimos 6 meses" };
    }
    case "thisYear": {
      const first = `${today.slice(0, 4)}-01-01`;
      return { from: startOfDayArt(first), to: endOfDayArt(today), label: "Este año" };
    }
    case "lastYear": {
      const y = Number(today.slice(0, 4)) - 1;
      return { from: startOfDayArt(`${y}-01-01`), to: endOfDayArt(`${y}-12-31`), label: "Año anterior" };
    }
    case "custom": {
      if (!customFrom || !customTo) return { from: startOfDayArt(today), to: endOfDayArt(today), label: "Personalizado" };
      return { from: startOfDayArt(customFrom), to: endOfDayArt(customTo), label: `${customFrom} → ${customTo}` };
    }
  }
}

interface Kpis {
  totalOrders: number;
  pendingPayment: number;
  paidOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
  collectedRevenue: number;
  pendingCollection: number;
  averageTicket: number;
  pendingDispatch: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  comparison: { revenueChange: number; ordersChange: number; ticketChange: number };
}

interface SeriesPoint { key: string; revenue: number; orders: number; prevRevenue: number; prevOrders: number; }

interface MonthlyRow { month: string; orders: number; revenue: number; collected: number; averageTicket: number; change: number; }

interface ProductRank { productId: string; name: string; brandName: string; imageUrl: string | null; unitsSold: number; orderCount: number; revenue: number; share: number; }

interface PaymentRow { method: string; count: number; collected: number; share: number; }

interface WeekdayRow { day: number; label: string; orders: number; revenue: number; }

interface ActivityItem { id: string; order_id: string; actor: string; event_type: string; field: string | null; old_value: string | null; new_value: string | null; metadata: any; created_at: string; orderNumber: string | null; customerName: string | null; }

interface Alerts {
  pendingPayment: any[];
  paidNotDispatched: any[];
  noTracking: any[];
  shippingProblems: any[];
  lowStock: any[];
  outOfStock: any[];
}

interface Profitability {
  revenue: number;
  cost: number;
  grossProfit: number;
  margin: number;
  hasCostData: boolean;
  ordersWithCost: number;
  ordersWithoutCost: number;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [products, setProducts] = useState<any[]>([]);
  useCatalogSync(() => setProducts(dbProducts.getAll()));

  const [preset, setPreset] = useState<PeriodPreset>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [granularity, setGranularity] = useState<"day" | "week" | "month" | "year">("day");
  const [chartType, setChartType] = useState<"bar" | "line">("bar");
  const [year, setYear] = useState(new Date().getFullYear());

  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [monthly, setMonthly] = useState<{ rows: MonthlyRow[]; bestMonth: string | null; totalRevenue: number; growthVsPrevYear: number } | null>(null);
  const [productsRank, setProductsRank] = useState<{ top: ProductRank[]; least: ProductRank[]; noSales: string[]; topRevenue: ProductRank[] } | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [weekday, setWeekday] = useState<WeekdayRow[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [alerts, setAlerts] = useState<Alerts | null>(null);
  const [profitability, setProfitability] = useState<Profitability | null>(null);
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => computeRange(preset, customFrom, customTo), [preset, customFrom, customTo]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = (extra = "") => `/api/admin/dashboard?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}${extra}`;
      const [k, s, p, pay, wd, act, al, prof] = await Promise.all([
        fetch(qs()).then((r) => r.json()),
        fetch(qs(`&granularity=${granularity}`) + "&section=series").then((r) => r.json()),
        fetch(`/api/admin/dashboard?section=products&from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`).then((r) => r.json()),
        fetch(`/api/admin/dashboard?section=payments&from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`).then((r) => r.json()),
        fetch(`/api/admin/dashboard?section=weekday&from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`).then((r) => r.json()),
        fetch(`/api/admin/dashboard?section=activity`).then((r) => r.json()),
        fetch(`/api/admin/dashboard?section=alerts`).then((r) => r.json()),
        fetch(`/api/admin/dashboard?section=profitability&from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`).then((r) => r.json()),
      ]);
      if (k.ok) setKpis(k);
      if (s.ok) setSeries(s.data);
      if (p.ok) setProductsRank(p);
      if (pay.ok) setPayments(pay.data);
      if (wd.ok) setWeekday(wd.data);
      if (act.ok) setActivity(act.data);
      if (al.ok) setAlerts(al);
      if (prof.ok) setProfitability(prof);

      // monthly
      const mRes = await fetch(`/api/admin/dashboard?section=monthly&year=${year}`);
      const m = await mRes.json();
      if (m.ok) setMonthly(m);
    } catch {
      showToast("No se pudieron cargar las métricas", "error");
    } finally {
      setLoading(false);
    }
  }, [range, granularity, year, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  // auto granularity suggestion
  useEffect(() => {
    const days = (new Date(range.to).getTime() - new Date(range.from).getTime()) / 86400000;
    if (days <= 31) setGranularity("day");
    else if (days <= 90) setGranularity("week");
    else if (days <= 365) setGranularity("month");
    else setGranularity("year");
  }, [range]);

  const maxSeries = Math.max(1, ...series.map((s) => Math.max(s.revenue, s.prevRevenue)));

  const exportCsv = () => {
    const rows = [
      ["Fecha", "Ingresos", "Pedidos", "Ingresos período anterior", "Pedidos período anterior"],
      ...series.map((s) => [s.key, s.revenue, s.orders, s.prevRevenue, s.prevOrders]),
    ];
    const csv = rows.map((r) => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dashboard-${range.label.replace(/\s/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Resumen comercial de Aventus Perfumería · {range.label}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            value={preset}
            onChange={(e) => setPreset(e.target.value as PeriodPreset)}
          >
            {Object.entries(PRESET_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          {preset === "custom" && (
            <>
              <input type="date" className="px-3 py-2 border border-gray-300 rounded-lg text-sm" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              <input type="date" className="px-3 py-2 border border-gray-300 rounded-lg text-sm" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </>
          )}
          <button onClick={load} className="px-3 py-2 text-sm bg-gold-600 text-white rounded-lg hover:bg-gold-700">
            Actualizar
          </button>
          <button onClick={exportCsv} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            Exportar CSV
          </button>
        </div>
      </div>

      {loading && !kpis && (
        <p className="text-sm text-gray-500 mb-6">Cargando métricas...</p>
      )}

      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <KpiCard title="Facturación" value={formatPrice(kpis.totalRevenue)} change={kpis.comparison.revenueChange} />
          <KpiCard title="Cobrado" value={formatPrice(kpis.collectedRevenue)} sub={`${kpis.paidOrders} pagados`} />
          <KpiCard title="Pend. cobro" value={formatPrice(kpis.pendingCollection)} sub={`${kpis.pendingPayment} pedidos`} />
          <KpiCard title="Pedidos" value={kpis.totalOrders} sub={`${kpis.cancelledOrders} cancelados`} change={kpis.comparison.ordersChange} />
          <KpiCard title="Ticket prom." value={formatPrice(kpis.averageTicket)} change={kpis.comparison.ticketChange} />
          <KpiCard title="Pend. despacho" value={kpis.pendingDispatch} sub={`${kpis.lowStockProducts} stock bajo`} />
        </div>
      )}

      {/* Alertas */}
      {alerts && (alerts.pendingPayment.length || alerts.paidNotDispatched.length || alerts.noTracking.length || alerts.shippingProblems.length || alerts.outOfStock.length || alerts.lowStock.length) ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <h3 className="font-semibold text-amber-900 mb-2">Alertas y tareas pendientes</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            {alerts.pendingPayment.length > 0 && <AlertLink href="/admin/pedidos" label={`${alerts.pendingPayment.length} pedidos pendientes de pago`} />}
            {alerts.paidNotDispatched.length > 0 && <AlertLink href="/admin/pedidos" label={`${alerts.paidNotDispatched.length} pagados sin despachar`} />}
            {alerts.noTracking.length > 0 && <AlertLink href="/admin/pedidos" label={`${alerts.noTracking.length} despachados sin tracking`} />}
            {alerts.shippingProblems.length > 0 && <AlertLink href="/admin/pedidos" label={`${alerts.shippingProblems.length} problemas de envío`} />}
            {alerts.outOfStock.length > 0 && <AlertLink href="/admin/productos" label={`${alerts.outOfStock.length} productos sin stock`} />}
            {alerts.lowStock.length > 0 && <AlertLink href="/admin/productos" label={`${alerts.lowStock.length} productos con stock bajo`} />}
          </div>
        </div>
      ) : null}

      {/* Evolución de ventas */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Evolución de ventas</h3>
          <div className="flex items-center gap-2">
            <select className="px-2 py-1 border border-gray-300 rounded text-sm" value={granularity} onChange={(e) => setGranularity(e.target.value as any)}>
              <option value="day">Diaria</option>
              <option value="week">Semanal</option>
              <option value="month">Mensual</option>
              <option value="year">Anual</option>
            </select>
            <button onClick={() => setChartType("bar")} className={`px-2 py-1 text-xs rounded ${chartType === "bar" ? "bg-gold-600 text-white" : "border border-gray-300"}`}>Barras</button>
            <button onClick={() => setChartType("line")} className={`px-2 py-1 text-xs rounded ${chartType === "line" ? "bg-gold-600 text-white" : "border border-gray-300"}`}>Línea</button>
          </div>
        </div>
        {series.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">Sin datos en el período.</p>
        ) : chartType === "bar" ? (
          <div className="overflow-x-auto">
            <div className="flex items-end gap-1 h-48 min-w-[300px]">
              {series.map((s, i) => (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full min-w-[8px]">
                  <div
                    className={`w-full rounded-t ${s.revenue > 0 ? "bg-gold-500" : "bg-gray-100"}`}
                    style={{ height: `${Math.max(2, (s.revenue / maxSeries) * 100)}%` }}
                    title={`${s.key}: ${formatPrice(s.revenue)} · ${s.orders} pedido(s)`}
                  />
                  <span className="text-[9px] text-gray-400 mt-1 truncate w-full text-center">{s.key.slice(-5)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <svg
              viewBox="0 0 100 40"
              preserveAspectRatio="none"
              className="w-full h-48 min-w-[300px]"
              role="img"
              aria-label="Evolución de ventas"
            >
              {/* Línea período anterior (gris, discontinua) */}
              <polyline
                fill="none"
                stroke="#d1d5db"
                strokeWidth="0.8"
                strokeDasharray="2,2"
                points={series
                  .map((s, i) => {
                    const x = series.length > 1 ? (i / (series.length - 1)) * 100 : 50;
                    const y = 40 - (s.prevRevenue / maxSeries) * 40;
                    return `${x},${Math.max(0, Math.min(40, y))}`;
                  })
                  .join(" ")}
              />
              {/* Línea período actual (dorada) */}
              <polyline
                fill="none"
                stroke="#b8956a"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={series
                  .map((s, i) => {
                    const x = series.length > 1 ? (i / (series.length - 1)) * 100 : 50;
                    const y = 40 - (s.revenue / maxSeries) * 40;
                    return `${x},${Math.max(0, Math.min(40, y))}`;
                  })
                  .join(" ")}
              />
              {series.map((s, i) => {
                const x = series.length > 1 ? (i / (series.length - 1)) * 100 : 50;
                const y = 40 - (s.revenue / maxSeries) * 40;
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={Math.max(0, Math.min(40, y))}
                    r="1"
                    fill="#b8956a"
                  >
                    <title>{`${s.key}: ${formatPrice(s.revenue)} · ${s.orders} pedido(s)`}</title>
                  </circle>
                );
              })}
            </svg>
            <div className="flex justify-between text-[9px] text-gray-400 mt-1">
              {series.length > 0 && (
                <>
                  <span>{series[0].key.slice(-5)}</span>
                  {series.length > 2 && <span>{series[Math.floor(series.length / 2)].key.slice(-5)}</span>}
                  <span>{series[series.length - 1].key.slice(-5)}</span>
                </>
              )}
            </div>
          </div>
        )}
        <p className="text-xs text-gray-400 mt-3">
          Comparado con el período anterior equivalente.
        </p>
      </div>

      {/* Rendimiento mensual */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Rendimiento mensual</h3>
          <select className="px-2 py-1 border border-gray-300 rounded text-sm" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        {monthly && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
              <div><p className="text-xs text-gray-500">Mejor mes</p><p className="font-semibold">{monthly.bestMonth || "-"}</p></div>
              <div><p className="text-xs text-gray-500">Total año</p><p className="font-semibold">{formatPrice(monthly.totalRevenue)}</p></div>
              <div><p className="text-xs text-gray-500">Crecimiento vs año anterior</p><p className={`font-semibold ${monthly.growthVsPrevYear >= 0 ? "text-green-600" : "text-red-600"}`}>{monthly.growthVsPrevYear.toFixed(1)}%</p></div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs text-gray-500">Mes</th>
                    <th className="px-3 py-2 text-right text-xs text-gray-500">Pedidos</th>
                    <th className="px-3 py-2 text-right text-xs text-gray-500">Facturación</th>
                    <th className="px-3 py-2 text-right text-xs text-gray-500">Cobrado</th>
                    <th className="px-3 py-2 text-right text-xs text-gray-500">Ticket prom.</th>
                    <th className="px-3 py-2 text-right text-xs text-gray-500">Var %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {monthly.rows.map((r) => (
                    <tr key={r.month} className={r.revenue > 0 ? "" : "text-gray-400"}>
                      <td className="px-3 py-2">{r.month}</td>
                      <td className="px-3 py-2 text-right">{r.orders}</td>
                      <td className="px-3 py-2 text-right">{formatPrice(r.revenue)}</td>
                      <td className="px-3 py-2 text-right">{formatPrice(r.collected)}</td>
                      <td className="px-3 py-2 text-right">{formatPrice(r.averageTicket)}</td>
                      <td className={`px-3 py-2 text-right ${r.change >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {r.orders > 0 ? `${r.change.toFixed(1)}%` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Productos + pagos + weekday */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top productos */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Productos más vendidos</h3>
          {!productsRank || productsRank.top.length === 0 ? (
            <p className="text-sm text-gray-500">Sin ventas en el período.</p>
          ) : (
            <div className="space-y-3">
              {productsRank.top.map((p, i) => (
                <div key={p.productId} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-5">{i + 1}</span>
                  <div className="relative w-10 h-12 bg-gray-100 flex-shrink-0 overflow-hidden">
                    {p.imageUrl && <Image src={p.imageUrl} alt={p.name} fill className="object-cover" sizes="40px" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.brandName} · {p.unitsSold} u. · {p.orderCount} pedidos</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{formatPrice(p.revenue)}</p>
                    <p className="text-xs text-gray-400">{p.share.toFixed(1)}%</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {productsRank && productsRank.noSales.length > 0 && (
            <p className="text-xs text-gray-400 mt-4">
              {productsRank.noSales.length} producto(s) sin ventas en el período.
            </p>
          )}
        </div>

        {/* Métodos de pago */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Métodos de pago (cobrados)</h3>
          {payments.length === 0 ? (
            <p className="text-sm text-gray-500">Sin pagos confirmados.</p>
          ) : (
            <div className="space-y-3">
              {payments.map((p) => (
                <div key={p.method} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 capitalize">{p.method.replace("_", " ")}</p>
                    <p className="text-xs text-gray-500">{p.count} operaciones</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{formatPrice(p.collected)}</p>
                    <p className="text-xs text-gray-400">{p.share.toFixed(1)}%</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Ventas por día de la semana */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Ventas por día de la semana</h3>
        <div className="grid grid-cols-7 gap-2 items-end h-32">
          {weekday.map((d) => {
            const max = Math.max(1, ...weekday.map((x) => x.revenue));
            return (
              <div key={d.day} className="flex flex-col items-center justify-end h-full">
                <div
                  className={`w-full rounded-t ${d.revenue > 0 ? "bg-gold-500" : "bg-gray-100"}`}
                  style={{ height: `${Math.max(4, (d.revenue / max) * 100)}%` }}
                  title={`${d.label}: ${d.orders} pedido(s) · ${formatPrice(d.revenue)}`}
                />
                <span className="text-[10px] text-gray-400 mt-2">{d.label.slice(0, 3)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actividad reciente */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Actividad reciente</h3>
        {activity.length === 0 ? (
          <p className="text-sm text-gray-500">Sin actividad reciente.</p>
        ) : (
          <div className="space-y-2">
            {activity.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm border-b border-gray-100 pb-2">
                <div>
                  <span className="font-medium text-gray-900">{a.event_type}</span>
                  {a.orderNumber && <span className="text-gray-500"> · {a.orderNumber}</span>}
                  {a.customerName && <span className="text-gray-400"> · {a.customerName}</span>}
                </div>
                <span className="text-xs text-gray-400">{new Date(a.created_at).toLocaleString("es-AR")}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rentabilidad */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Rentabilidad</h3>
        {!profitability ? (
          <p className="text-sm text-gray-500">Cargando...</p>
        ) : !profitability.hasCostData ? (
          <p className="text-sm text-gray-500">
            No hay costos de adquisición registrados en los productos (columna <code>cost_cents</code>). Cargá los costos en el catálogo para calcular facturación, costo de mercadería vendida, ganancia bruta y margen. No se inventan valores.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-xs text-gray-500">Facturación</p>
                <p className="text-xl font-bold text-gray-900">{formatPrice(profitability.revenue)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Costo mercadería</p>
                <p className="text-xl font-bold text-gray-900">{formatPrice(profitability.cost)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Ganancia bruta</p>
                <p className={`text-xl font-bold ${profitability.grossProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatPrice(profitability.grossProfit)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Margen</p>
                <p className={`text-xl font-bold ${profitability.margin >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {profitability.margin.toFixed(1)}%
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              Basado en {profitability.ordersWithCost} pedido(s) con costo registrado
              {profitability.ordersWithoutCost > 0 ? ` · ${profitability.ordersWithoutCost} sin costo (excluidos)` : ""}.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function KpiCard({ title, value, sub, change }: { title: string; value: any; sub?: string; change?: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <p className="text-xs text-gray-500 mb-1">{title}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      {typeof change === "number" && (
        <p className={`text-xs mt-1 ${change >= 0 ? "text-green-600" : "text-red-600"}`}>
          {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(1)}% vs período anterior
        </p>
      )}
    </div>
  );
}

function AlertLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="text-amber-800 hover:underline">
      • {label}
    </Link>
  );
}
