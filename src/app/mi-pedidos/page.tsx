"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useOrders } from "@/context/OrdersContext";
import { formatPrice } from "@/config/site";
import { Order, OrderStatus } from "@/types";

const statusLabels: Record<OrderStatus, string> = {
  "no-concretado": "No concretado",
  confirmado: "Confirmado",
  enviado: "Enviado",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

const statusMessages: Record<OrderStatus, string> = {
  "no-concretado": "Pedido generado. La compra todavía no fue confirmada.",
  confirmado: "Tu compra fue confirmada.",
  enviado: "Tu pedido fue enviado.",
  entregado: "Tu pedido fue entregado.",
  cancelado: "Este pedido fue cancelado.",
};

const statusColors: Record<OrderStatus, string> = {
  "no-concretado": "bg-yellow-100 text-yellow-700",
  confirmado: "bg-blue-100 text-blue-700",
  enviado: "bg-indigo-100 text-indigo-700",
  entregado: "bg-green-100 text-green-700",
  cancelado: "bg-red-100 text-red-700",
};

export default function MiPedidosPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { getUserOrders, isLoading: ordersLoading } = useOrders();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-gold-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <h1 className="font-serif text-2xl text-charcoal-900 mb-3">Iniciá sesión para ver tus pedidos</h1>
          <Link href="/login" className="btn-primary">INGRESAR</Link>
        </div>
      </div>
    );
  }

  if (authLoading || ordersLoading) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-gold-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const orders = user ? getUserOrders(user.id) : [];

  return (
    <div className="min-h-screen bg-cream-50">
      <div className="bg-charcoal-950 text-cream-50 py-16">
        <div className="container-aventus">
          <p className="text-xs tracking-widest2 uppercase text-gold-400 mb-3">Mi cuenta</p>
          <h1 className="font-serif text-4xl sm:text-5xl mb-4">Mis Pedidos</h1>
        </div>
      </div>

      <div className="container-aventus py-12">
        {orders.length === 0 ? (
          <div className="text-center py-20">
            <svg className="w-16 h-16 text-charcoal-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="font-serif text-2xl text-charcoal-900 mb-2">Todavía no tenés pedidos</h3>
            <p className="text-charcoal-500 mb-6">Explorá nuestra colección y hacé tu primer pedido.</p>
            <Link href="/perfumes" className="btn-primary">EXPLORAR PERFUMES</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Orders List */}
            <div className="lg:col-span-2 space-y-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrder(selectedOrder?.id === order.id ? null : order)}
                  className={`bg-white rounded-xl border p-6 cursor-pointer transition-all ${
                    selectedOrder?.id === order.id ? "border-gold-500 shadow-md" : "border-charcoal-100 hover:border-gold-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-medium text-charcoal-900">Pedido #{order.id}</p>
                      <p className="text-sm text-charcoal-500">
                        {new Date(order.date).toLocaleDateString("es-AR")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${statusColors[order.status]}`}>
                        {statusLabels[order.status]}
                      </span>
                      <p className="font-medium text-charcoal-900">{formatPrice(order.total)}</p>
                    </div>
                  </div>

                  {/* Status message */}
                  <p className="text-sm text-charcoal-600 mb-4">{statusMessages[order.status]}</p>

                  {/* Products preview */}
                  <div className="flex items-center gap-4">
                    {order.items.slice(0, 3).map((item, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="relative w-10 h-12 bg-cream-100 flex-shrink-0">
                          {item.image && <Image src={item.image} alt={item.name} fill className="object-cover" sizes="40px" />}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-charcoal-900 truncate max-w-[120px]">{item.name}</p>
                          <p className="text-[10px] text-charcoal-500">{item.size} × {item.quantity}</p>
                        </div>
                      </div>
                    ))}
                    {order.items.length > 3 && (
                      <p className="text-xs text-charcoal-500">+{order.items.length - 3} más</p>
                    )}
                  </div>

                  {/* Expanded detail */}
                  {selectedOrder?.id === order.id && (
                    <div className="mt-6 pt-6 border-t border-charcoal-100">
                      <div className="space-y-3 mb-6">
                        {order.items.map((item, index) => (
                          <div key={index} className="flex gap-4">
                            <div className="relative w-16 h-20 bg-cream-100 flex-shrink-0">
                              {item.image && <Image src={item.image} alt={item.name} fill className="object-cover" sizes="64px" />}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-charcoal-900">{item.name}</p>
                              {item.concentration && <p className="text-sm text-charcoal-500">{item.concentration}</p>}
                              <p className="text-sm text-charcoal-500">{item.size}</p>
                              <p className="text-sm text-charcoal-500">Cantidad: {item.quantity}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-charcoal-900">{formatPrice(item.subtotal)}</p>
                              <p className="text-xs text-charcoal-500">{formatPrice(item.unitPrice)} c/u</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2 pt-4 border-t border-charcoal-100">
                        <div className="flex justify-between text-sm">
                          <span className="text-charcoal-600">Subtotal</span>
                          <span>{formatPrice(order.subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-charcoal-600">Envío</span>
                          <span>{order.shippingCost === 0 ? "Gratis" : formatPrice(order.shippingCost)}</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold pt-2 border-t border-charcoal-100">
                          <span>Total</span>
                          <span>{formatPrice(order.total)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl border border-charcoal-100 p-6 sticky top-28">
                <h3 className="font-serif text-lg text-charcoal-900 mb-4">Resumen</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-charcoal-600">Total pedidos</span>
                    <span className="font-medium">{orders.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-charcoal-600">Total gastado</span>
                    <span className="font-medium">
                      {formatPrice(orders.reduce((sum, o) => sum + o.total, 0))}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
