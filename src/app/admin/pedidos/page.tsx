"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useToast } from "@/context/ToastContext";
import { formatPrice } from "@/config/site";
import { dbOrders, Order, OrderStatus } from "@/lib/db";

const statusLabels: Record<OrderStatus, string> = {
  "no-concretado": "No concretado",
  confirmado: "Confirmado",
  enviado: "Enviado",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

const statusColors: Record<OrderStatus, string> = {
  "no-concretado": "bg-yellow-100 text-yellow-700",
  confirmado: "bg-blue-100 text-blue-700",
  enviado: "bg-indigo-100 text-indigo-700",
  entregado: "bg-green-100 text-green-700",
  cancelado: "bg-red-100 text-red-700",
};

export default function AdminPedidosPage() {
  const { showToast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    setOrders(dbOrders.getAll());
  }, []);

  const handleStatusChange = (orderId: string, newStatus: OrderStatus) => {
    dbOrders.updateStatus(orderId, newStatus);
    setOrders(dbOrders.getAll());
    if (selectedOrder?.id === orderId) {
      setSelectedOrder({ ...selectedOrder, status: newStatus });
    }
    showToast(`Estado actualizado a "${statusLabels[newStatus]}"`);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Pedidos</h1>
        <p className="text-sm text-gray-500 mt-1">Gestioná los pedidos de la tienda</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Orders List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pedido</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className={`hover:bg-gray-50 cursor-pointer ${selectedOrder?.id === order.id ? "bg-gold-50" : ""}`}
                  >
                    <td className="px-4 py-4 text-sm font-medium text-gray-900">#{order.id}</td>
                    <td className="px-4 py-4">
                      <p className="text-sm text-gray-900">{order.customer.name} {order.customer.lastName}</p>
                      <p className="text-xs text-gray-500">{order.customer.email}</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {new Date(order.date).toLocaleDateString("es-AR")}
                    </td>
                    <td className="px-4 py-4 text-sm font-medium text-gray-900">
                      {formatPrice(order.total)}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[order.status]}`}>
                        {statusLabels[order.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Order Detail */}
        <div className="lg:col-span-1">
          {selectedOrder ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 sticky top-28">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Pedido #{selectedOrder.id}
              </h3>

              <div className="space-y-4 mb-6">
                <div>
                  <p className="text-xs text-gray-500">Cliente</p>
                  <p className="text-sm font-medium">{selectedOrder.customer.name} {selectedOrder.customer.lastName}</p>
                  <p className="text-xs text-gray-500">{selectedOrder.customer.email}</p>
                  <p className="text-xs text-gray-500">{selectedOrder.customer.phone}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Fecha</p>
                  <p className="text-sm">{new Date(selectedOrder.date).toLocaleString("es-AR")}</p>
                </div>
              </div>

              {/* Status */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
                <select
                  value={selectedOrder.status}
                  onChange={(e) => handleStatusChange(selectedOrder.id, e.target.value as OrderStatus)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                >
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Items */}
              <div className="space-y-3 mb-6">
                <p className="text-sm font-medium text-gray-700">Productos</p>
                {selectedOrder.items.map((item, index) => (
                  <div key={index} className="flex gap-3">
                    <div className="relative w-12 h-14 bg-gray-100 flex-shrink-0">
                      {item.image && <Image src={item.image} alt={item.name} fill className="object-cover" sizes="48px" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.size} · Cant: {item.quantity}</p>
                      <p className="text-xs text-gray-500">{formatPrice(item.unitPrice)} c/u</p>
                    </div>
                    <p className="text-sm font-medium text-gray-900">{formatPrice(item.subtotal)}</p>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-2 pt-4 border-t border-gray-200">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span>{formatPrice(selectedOrder.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Envío</span>
                  <span>{selectedOrder.shippingCost === 0 ? "Gratis" : formatPrice(selectedOrder.shippingCost)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
                  <span>Total</span>
                  <span>{formatPrice(selectedOrder.total)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
              <p className="text-gray-500">Seleccioná un pedido para ver el detalle</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
