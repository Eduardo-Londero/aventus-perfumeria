"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { dbProducts } from "@/lib/db";
import { useCatalogSync } from "@/hooks/useCatalogSync";
import { formatPrice } from "@/config/site";
import { useAuth } from "@/context/AuthContext";
import { useOrders } from "@/context/OrdersContext";
import { computeDashboardMetrics } from "@/lib/metrics";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [products, setProducts] = useState(dbProducts.getAll());
  const { orders } = useOrders();

  useCatalogSync(() => setProducts(dbProducts.getAll()));

  // KPIs con reglas de negocio únicas (src/lib/metrics.ts):
  // solo cuentan "confirmado" / "enviado" / "entregado".
  const metrics = useMemo(
    () => computeDashboardMetrics(orders, products),
    [orders, products]
  );
  const maxDailyRevenue = Math.max(
    1,
    ...metrics.salesByDay.map((day) => day.revenue)
  );

  // Stats calculadas de productos reales desde la base de datos
  const totalProducts = products.length;
  const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
  const outOfStock = products.filter((p) => p.stock === 0).length;
  const onSale = products.filter((p) => p.isOnSale).length;
  const totalValue = products.reduce((sum, p) => sum + p.price * p.stock, 0);
  const bestSellers = [...products]
    .sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0))
    .slice(0, 5);

  return (
    <div>
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Hola, {user?.name || "Admin"}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Resumen de tu tienda
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total productos</p>
              <p className="text-2xl font-bold text-gray-900">{totalProducts}</p>
            </div>
            <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Stock total</p>
              <p className="text-2xl font-bold text-gray-900">{totalStock}</p>
            </div>
            <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Sin stock</p>
              <p className="text-2xl font-bold text-red-600">{outOfStock}</p>
            </div>
            <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">En oferta</p>
              <p className="text-2xl font-bold text-gold-600">{onSale}</p>
            </div>
            <div className="w-12 h-12 bg-gold-500 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Sales KPIs — estados que cuentan como venta: confirmado/enviado/entregado */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <p className="text-sm text-gray-500">Ventas confirmadas</p>
          <p className="text-2xl font-bold text-gray-900">{metrics.confirmedOrders}</p>
          <p className="text-xs text-gray-400 mt-1">
            {metrics.cancelledOrders} canceladas · {metrics.pendingOrders} sin confirmar
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <p className="text-sm text-gray-500">Ingresos confirmados</p>
          <p className="text-2xl font-bold text-emerald-600">
            {formatPrice(metrics.confirmedRevenue)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Excluye pedidos cancelados y pendientes</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <p className="text-sm text-gray-500">Ticket promedio</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatPrice(metrics.averageTicket)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Promedio de ventas confirmadas</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <p className="text-sm text-gray-500">Stock bajo</p>
          <p className="text-2xl font-bold text-amber-600">{metrics.lowStockProducts}</p>
          <p className="text-xs text-gray-400 mt-1">
            {metrics.outOfStockProducts} productos agotados
          </p>
        </div>
      </div>

      {/* Evolución de ventas — últimos 7 días */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8">
        <div className="flex items-baseline justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Evolución de ventas</h3>
          <span className="text-xs text-gray-400">Últimos 7 días · pedidos confirmados</span>
        </div>
        <div className="grid grid-cols-7 gap-3 items-end h-40">
          {metrics.salesByDay.map((day) => (
            <div key={day.date} className="flex flex-col items-center justify-end h-full">
              <span className="text-[10px] text-gray-500 mb-1">
                {day.revenue > 0 ? formatPrice(day.revenue) : ""}
              </span>
              <div
                className={`w-full rounded-t ${day.revenue > 0 ? "bg-gold-500" : "bg-gray-100"}`}
                style={{
                  height: `${Math.max(4, (day.revenue / maxDailyRevenue) * 100)}%`,
                }}
                title={`${day.date}: ${day.orders} pedido(s) · ${formatPrice(day.revenue)}`}
              />
              <span className="text-[10px] text-gray-400 mt-2">
                {day.date.slice(8, 10)}/{day.date.slice(5, 7)}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-4 text-center">
          {metrics.confirmedOrders === 0
            ? "Todavía no hay pedidos confirmados: los indicadores permanecen en cero."
            : `${metrics.confirmedOrders} venta(s) confirmada(s) en el período total.`}
        </p>
      </div>

      {/* Inventory Value + Best Sellers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inventory Value */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Valor del inventario
          </h3>
          <p className="text-3xl font-bold text-gold-600 mb-4">
            {formatPrice(totalValue)}
          </p>
          <Link
            href="/admin/productos"
            className="text-sm text-gold-600 hover:text-gold-700 font-medium"
          >
            Ver productos →
          </Link>
        </div>

        {/* Best Sellers */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Más vendidos
          </h3>
          <div className="space-y-3">
            {bestSellers.map((product, index) => (
              <div key={product.id} className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-500 w-6">
                  #{index + 1}
                </span>
                <div className="relative w-10 h-10 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                  <Image
                    src={product.images[0]}
                    alt={product.name}
                    fill
                    className="object-cover"
                    sizes="40px"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {product.name}
                  </p>
                  <p className="text-xs text-gray-500">{product.brand}</p>
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {product.soldCount || 0} ventas
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
