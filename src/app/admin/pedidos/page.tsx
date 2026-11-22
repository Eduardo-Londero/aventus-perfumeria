"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useToast } from "@/context/ToastContext";
import { dbProducts } from "@/lib/db";
import { formatPrice } from "@/config/site";
import { useCatalogSync } from "@/hooks/useCatalogSync";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import type { Product } from "@/types";
import type { Order } from "@/types";

const PAYMENT_LABELS: Record<string, string> = {
  pending: "Pendiente",
  partial: "Pago parcial",
  paid: "Pagado",
  refunded: "Reembolsado",
  expired: "Cancelado",
  discrepancy: "Discrepancia",
  rejected: "Rechazado",
};

const SHIPPING_LABELS: Record<string, string> = {
  sin_preparar: "Sin preparar",
  preparando: "Preparando",
  despachado: "Despachado",
  en_transito: "En tránsito",
  entregado: "Entregado",
  problema: "Problema",
};

const PAYMENT_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  partial: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  refunded: "bg-purple-100 text-purple-700",
  expired: "bg-gray-100 text-gray-600",
  discrepancy: "bg-red-100 text-red-700",
  rejected: "bg-red-100 text-red-700",
};

const SHIPPING_COLORS: Record<string, string> = {
  sin_preparar: "bg-gray-100 text-gray-600",
  preparando: "bg-blue-100 text-blue-700",
  despachado: "bg-indigo-100 text-indigo-700",
  en_transito: "bg-amber-100 text-amber-700",
  entregado: "bg-green-100 text-green-700",
  problema: "bg-red-100 text-red-700",
};

interface Summary {
  totalOrders: number;
  pendingPayment: number;
  paid: number;
  pendingDispatch: number;
  totalSales: number;
}

interface OrderItemDraft {
  productId: string;
  quantity: number;
}

export default function AdminPedidosPage() {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  useCatalogSync(() => setProducts(dbProducts.getAll()));

  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [shippingFilter, setShippingFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [summary, setSummary] = useState<Summary | null>(null);

  const [selected, setSelected] = useState<Order | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [custName, setCustName] = useState("");
  const [custLast, setCustLast] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [custAddress, setCustAddress] = useState("");
  const [custCity, setCustCity] = useState("");
  const [custProvince, setCustProvince] = useState("");
  const [custPostal, setCustPostal] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<"retiro" | "envio">("retiro");
  const [paymentMethod, setPaymentMethod] = useState("efectivo");
  const [discount, setDiscount] = useState(0);
  const [shippingCost, setShippingCost] = useState(2500);
  const [internalNotes, setInternalNotes] = useState("");
  const [items, setItems] = useState<OrderItemDraft[]>([]);
  const [productQuery, setProductQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (paymentFilter) params.set("paymentStatus", paymentFilter);
      if (shippingFilter) params.set("shippingStatus", shippingFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      params.set("sort", "created_at");
      params.set("order", "desc");

      const res = await fetch(`/api/admin/orders?${params.toString()}`);
      const data = await res.json();
      if (data.ok) {
        setOrders(data.orders);
        setTotal(data.total);
      }

      const sParams = new URLSearchParams();
      if (dateFrom) sParams.set("dateFrom", dateFrom);
      if (dateTo) sParams.set("dateTo", dateTo);
      sParams.set("summary", "1");
      const sRes = await fetch(`/api/admin/orders?${sParams.toString()}`);
      const sData = await sRes.json();
      if (sData.ok) {
        setSummary({
          totalOrders: sData.totalOrders,
          pendingPayment: sData.pendingPayment,
          paid: sData.paid,
          pendingDispatch: sData.pendingDispatch,
          totalSales: sData.totalSales,
        });
      }
    } catch {
      showToast("No se pudieron cargar los pedidos", "error");
    } finally {
      setLoading(false);
    }
  }, [search, paymentFilter, shippingFilter, dateFrom, dateTo, page, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (order: Order) => {
    // Re-fetch full detail (with all fields) from the API
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(order.id)}`);
      const data = await res.json();
      if (data.ok) setSelected(data.order);
      else setSelected(order);
    } catch {
      setSelected(order);
    }
    setDetailOpen(true);
  };

  const patchOrder = async (id: string, body: any, msg?: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        showToast(data?.message || "No se pudo actualizar el pedido", "error");
        return false;
      }
      if (msg) showToast(msg, "success");
      await load();
      // update selected
      if (selected?.id === id) {
        const r = await fetch(`/api/admin/orders/${encodeURIComponent(id)}`);
        const d = await r.json();
        if (d.ok) setSelected(d.order);
      }
      return true;
    } catch {
      showToast("Error de red", "error");
      return false;
    }
  };

  const handleCreate = async () => {
    if (!custName.trim() || !custLast.trim() || !custPhone.trim()) {
      showToast("Completá nombre, apellido y teléfono", "error");
      return;
    }
    if (items.length === 0) {
      showToast("Agregá al menos un producto", "error");
      return;
    }
    setCreating(true);
    try {
      const body = {
        customer: {
          name: custName,
          lastName: custLast,
          phone: custPhone,
          email: custEmail,
          address: custAddress,
          city: custCity,
          province: custProvince,
          postalCode: custPostal,
        },
        deliveryMethod,
        paymentMethod,
        items,
        discount,
        shippingCost: deliveryMethod === "envio" ? shippingCost : 0,
        internalNotes,
        customerNotes: "",
      };
      const res = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        showToast(data?.message || "No se pudo crear el pedido", "error");
        return;
      }
      showToast(`Pedido ${data.order.id} creado`, "success");
      setCreateOpen(false);
      resetCreateForm();
      await load();
    } catch {
      showToast("Error de red", "error");
    } finally {
      setCreating(false);
    }
  };

  const resetCreateForm = () => {
    setCustName("");
    setCustLast("");
    setCustPhone("");
    setCustEmail("");
    setCustAddress("");
    setCustCity("");
    setCustProvince("");
    setCustPostal("");
    setDeliveryMethod("retiro");
    setPaymentMethod("efectivo");
    setDiscount(0);
    setShippingCost(2500);
    setInternalNotes("");
    setItems([]);
    setProductQuery("");
  };

  const addItem = (productId: string) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === productId);
      if (existing) {
        return prev.map((i) =>
          i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { productId, quantity: 1 }];
    });
  };

  const updateItemQty = (productId: string, qty: number) => {
    setItems((prev) =>
      prev
        .map((i) => (i.productId === productId ? { ...i, quantity: Math.max(1, qty) } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  const createSubtotal = items.reduce((acc, it) => {
    const p = products.find((x) => x.id === it.productId);
    return acc + (p?.price ?? 0) * it.quantity;
  }, 0);

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(productQuery.toLowerCase()) ||
    p.brand.toLowerCase().includes(productQuery.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copiado`, "success");
    } catch {
      showToast("No se pudo copiar", "error");
    }
  };

  return (
    <div>
      {/* Indicadores */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-500">Total pedidos</p>
            <p className="text-2xl font-bold text-gray-900">{summary.totalOrders}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-500">Pendientes de pago</p>
            <p className="text-2xl font-bold text-amber-600">{summary.pendingPayment}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-500">Pagados</p>
            <p className="text-2xl font-bold text-green-600">{summary.paid}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-500">Pend. despacho</p>
            <p className="text-2xl font-bold text-indigo-600">{summary.pendingDispatch}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-500">Ventas (pagadas)</p>
            <p className="text-2xl font-bold text-gray-900">{formatPrice(summary.totalSales)}</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de pedidos</h1>
          <p className="text-sm text-gray-500 mt-1">Registrá ventas manualmente y administrá pagos y envíos</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>Nuevo pedido</Button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <Input
            placeholder="Buscar código, nombre o teléfono"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <select
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            value={paymentFilter}
            onChange={(e) => { setPaymentFilter(e.target.value); setPage(1); }}
          >
            <option value="">Todos los pagos</option>
            {Object.entries(PAYMENT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            value={shippingFilter}
            onChange={(e) => { setShippingFilter(e.target.value); setPage(1); }}
          >
            <option value="">Todos los envíos</option>
            {Object.entries(SHIPPING_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <input
            type="date"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          />
          <input
            type="date"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pedido</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pago</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Envío</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">Cargando...</td></tr>
            )}
            {!loading && orders.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">No hay pedidos.</td></tr>
            )}
            {!loading && orders.map((o) => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{o.id}</td>
                <td className="px-4 py-3">
                  <p className="text-sm text-gray-900">{o.customer.name} {o.customer.lastName}</p>
                  <p className="text-xs text-gray-500">{o.customer.phone}</p>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {new Date(o.date).toLocaleDateString("es-AR")}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatPrice(o.total)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${PAYMENT_COLORS[o.paymentStatus || "pending"]}`}>
                    {PAYMENT_LABELS[o.paymentStatus || "pending"]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${SHIPPING_COLORS[o.shippingStatus || "sin_preparar"]}`}>
                    {SHIPPING_LABELS[o.shippingStatus || "sin_preparar"]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => openDetail(o)}
                    className="text-sm text-gold-600 hover:text-gold-700"
                  >
                    Ver
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="flex items-center justify-between mt-4">
        <p className="text-sm text-gray-500">
          {total} pedidos · página {page} de {Math.max(1, Math.ceil(total / pageSize))}
        </p>
        <div className="flex gap-2">
          <button
            className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Anterior
          </button>
          <button
            className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50"
            disabled={page >= Math.ceil(total / pageSize)}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </button>
        </div>
      </div>

      {/* Modal detalle */}
      <Modal isOpen={detailOpen} onClose={() => setDetailOpen(false)} title={selected ? `Pedido ${selected.id}` : "Pedido"}>
        {selected && (
          <div className="space-y-6 max-h-[80vh] overflow-y-auto">
            {/* Identificación */}
            <section>
              <h3 className="font-semibold text-gray-900 mb-2">Identificación</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">Código:</span> {selected.id}</div>
                <div><span className="text-gray-500">Fecha:</span> {new Date(selected.date).toLocaleString("es-AR")}</div>
                <div><span className="text-gray-500">Actualizado:</span> {selected.updatedAt ? new Date(selected.updatedAt).toLocaleString("es-AR") : "-"}</div>
              </div>
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="secondary" onClick={() => copy(selected.id, "Código")}>Copiar código</Button>
                <Button size="sm" variant="secondary" onClick={() => copy(selected.customer.phone, "Teléfono")}>Copiar teléfono</Button>
              </div>
            </section>

            {/* Cliente */}
            <section>
              <h3 className="font-semibold text-gray-900 mb-2">Cliente</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">Nombre:</span> {selected.customer.name} {selected.customer.lastName}</div>
                <div><span className="text-gray-500">Teléfono:</span> {selected.customer.phone}</div>
                <div><span className="text-gray-500">Email:</span> {selected.customer.email || "-"}</div>
                <div><span className="text-gray-500">Dirección:</span> {selected.customer.address || "-"}</div>
                <div><span className="text-gray-500">Ciudad:</span> {selected.customer.city || "-"}</div>
                <div><span className="text-gray-500">Provincia:</span> {selected.customer.province || "-"}</div>
                <div><span className="text-gray-500">CP:</span> {selected.customer.postalCode || "-"}</div>
              </div>
            </section>

            {/* Productos */}
            <section>
              <h3 className="font-semibold text-gray-900 mb-2">Productos</h3>
              <div className="space-y-2">
                {selected.items.map((it, i) => (
                  <div key={i} className="flex justify-between text-sm border-b border-gray-100 pb-2">
                    <div>
                      <p className="font-medium">{it.name}</p>
                      <p className="text-xs text-gray-500">{it.size} · Cant: {it.quantity} · {formatPrice(it.unitPrice)} c/u</p>
                    </div>
                    <p className="font-medium">{formatPrice(it.subtotal)}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span>{formatPrice(selected.subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Descuento</span><span>-{formatPrice(selected.discount ?? 0)}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Envío</span><span>{selected.shippingCost === 0 ? "Gratis" : formatPrice(selected.shippingCost)}</span></div>
                <div className="flex justify-between font-bold border-t border-gray-200 pt-2"><span>Total</span><span>{formatPrice(selected.total)}</span></div>
              </div>
            </section>

            {/* Pago */}
            <section>
              <h3 className="font-semibold text-gray-900 mb-2">Pago</h3>
              <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                <div><span className="text-gray-500">Estado:</span> {PAYMENT_LABELS[selected.paymentStatus || "pending"]}</div>
                <div><span className="text-gray-500">Método:</span> {selected.paymentMethod}</div>
                <div><span className="text-gray-500">Abonado:</span> {formatPrice(selected.paymentAmountPaid ?? 0)}</div>
                <div><span className="text-gray-500">Transacción:</span> {selected.paymentTransactionRef || "-"}</div>
                <div><span className="text-gray-500">Pagado el:</span> {selected.paymentPaidAt ? new Date(selected.paymentPaidAt).toLocaleString("es-AR") : "-"}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => patchOrder(selected.id, { payment: { status: "paid", amountPaid: selected.total } }, "Pago confirmado")}>
                  Confirmar pago
                </Button>
                {selected.paymentTransactionRef && selected.paymentStatus === "paid" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      if (!confirm("¿Reembolsar el pago en Mercado Pago? Se cancelará el pedido y se liberará el stock.")) return;
                      try {
                        const res = await fetch(`/api/admin/orders/${encodeURIComponent(selected.id)}/refund`, { method: "POST" });
                        const data = await res.json();
                        if (!res.ok || !data.ok) {
                          showToast(data?.message || "No se pudo reembolsar", "error");
                          return;
                        }
                        showToast(data.message || "Reembolso procesado", "success");
                        await load();
                        const r = await fetch(`/api/admin/orders/${encodeURIComponent(selected.id)}`);
                        const d = await r.json();
                        if (d.ok) setSelected(d.order);
                      } catch {
                        showToast("Error de red", "error");
                      }
                    }}
                  >
                    Reembolsar MP
                  </Button>
                )}
                <Button size="sm" variant="secondary" onClick={() => {
                  const ref = prompt("Número de transacción/operación:");
                  if (ref !== null) patchOrder(selected.id, { payment: { transactionRef: ref } }, "Transacción guardada");
                }}>
                  Agregar transacción
                </Button>
                <select
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                  value={selected.paymentStatus || "pending"}
                  onChange={(e) => patchOrder(selected.id, { payment: { status: e.target.value } }, "Estado de pago actualizado")}
                >
                  {Object.entries(PAYMENT_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <textarea
                className="w-full mt-3 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Observaciones de pago"
                defaultValue={selected.paymentNotes || ""}
                onBlur={(e) => patchOrder(selected.id, { payment: { notes: e.target.value } })}
                rows={2}
              />
            </section>

            {/* Envío */}
            <section>
              <h3 className="font-semibold text-gray-900 mb-2">Envío</h3>
              <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                <div><span className="text-gray-500">Estado:</span> {SHIPPING_LABELS[selected.shippingStatus || "sin_preparar"]}</div>
                <div><span className="text-gray-500">Transporte:</span> {selected.shippingCarrier || "-"}</div>
                <div><span className="text-gray-500">Tracking:</span> {selected.shippingTrackingCode || "-"}</div>
                <div><span className="text-gray-500">Despachado:</span> {selected.shippingDispatchedAt ? new Date(selected.shippingDispatchedAt).toLocaleString("es-AR") : "-"}</div>
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                <Button size="sm" variant="secondary" onClick={() => {
                  const carrier = prompt("Empresa de transporte (OCA, Andreani, Correo Argentino...):", selected.shippingCarrier || "");
                  if (carrier !== null) patchOrder(selected.id, { shipping: { carrier } }, "Transporte guardado");
                }}>
                  Transporte
                </Button>
                <Button size="sm" variant="secondary" onClick={() => {
                  const code = prompt("Código de seguimiento:");
                  if (code !== null) patchOrder(selected.id, { shipping: { trackingCode: code } }, "Tracking guardado");
                }}>
                  Tracking
                </Button>
                {selected.shippingTrackingCode && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      const carrier = (selected.shippingCarrier || "").toLowerCase();
                      const endpoint =
                        carrier.includes("correo") || carrier.includes("argentino")
                          ? "/api/shipping/correo-argentino/label"
                          : "/api/shipping/andreani/label";
                      try {
                        const res = await fetch(endpoint, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ trackingNumber: selected.shippingTrackingCode }),
                        });
                        const data = await res.json();
                        if (!res.ok || !data.ok) {
                          showToast(data?.message || "No se pudo generar el rótulo", "error");
                          return;
                        }
                        // Descargar PDF
                        const byteChars = atob(data.fileBase64);
                        const byteNumbers = new Array(byteChars.length);
                        for (let i = 0; i < byteChars.length; i++) {
                          byteNumbers[i] = byteChars.charCodeAt(i);
                        }
                        const byteArray = new Uint8Array(byteNumbers);
                        const blob = new Blob([byteArray], { type: "application/pdf" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = data.fileName || "rotulo.pdf";
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        showToast("Rótulo descargado", "success");
                      } catch {
                        showToast("Error de red", "error");
                      }
                    }}
                  >
                    Descargar rótulo
                  </Button>
                )}
                {!selected.shippingTrackingCode && (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        try {
                          const res = await fetch("/api/shipping/correo-argentino/create", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ orderNumber: selected.id }),
                          });
                          const data = await res.json();
                          if (!res.ok || !data.ok) {
                            showToast(data?.message || "No se pudo generar el envío", "error");
                            return;
                          }
                          showToast(`Envío creado. Tracking: ${data.trackingCode}`, "success");
                          await load();
                          const r = await fetch(`/api/admin/orders/${encodeURIComponent(selected.id)}`);
                          const d = await r.json();
                          if (d.ok) setSelected(d.order);
                        } catch {
                          showToast("Error de red", "error");
                        }
                      }}
                    >
                      Generar envío CA
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        try {
                          const res = await fetch("/api/shipping/andreani/create", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ orderNumber: selected.id }),
                          });
                          const data = await res.json();
                          if (!res.ok || !data.ok) {
                            showToast(data?.message || "No se pudo generar el envío", "error");
                            return;
                          }
                          showToast(`Envío creado. Tracking: ${data.trackingCode}`, "success");
                          await load();
                          const r = await fetch(`/api/admin/orders/${encodeURIComponent(selected.id)}`);
                          const d = await r.json();
                          if (d.ok) setSelected(d.order);
                        } catch {
                          showToast("Error de red", "error");
                        }
                      }}
                    >
                      Generar envío Andreani
                    </Button>
                  </>
                )}
                <select
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                  value={selected.shippingStatus || "sin_preparar"}
                  onChange={(e) => patchOrder(selected.id, { shipping: { status: e.target.value } }, "Estado de envío actualizado")}
                >
                  {Object.entries(SHIPPING_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <Button size="sm" variant="secondary" onClick={() => patchOrder(selected.id, { shipping: { status: "despachado" } }, "Marcado como despachado")}>
                  Marcar despachado
                </Button>
              </div>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Observaciones de envío"
                defaultValue={selected.shippingNotes || ""}
                onBlur={(e) => patchOrder(selected.id, { shipping: { notes: e.target.value } })}
                rows={2}
              />
            </section>

            {/* Notas */}
            <section>
              <h3 className="font-semibold text-gray-900 mb-2">Observaciones</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Internas (solo admin)</label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="Notas internas..."
                    defaultValue={selected.internalNotes || ""}
                    onBlur={(e) => patchOrder(selected.id, { internalNotes: e.target.value }, "Notas internas guardadas")}
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Para el cliente</label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="Observaciones para el cliente..."
                    defaultValue={selected.customerNotes || ""}
                    onBlur={(e) => patchOrder(selected.id, { customerNotes: e.target.value }, "Notas para cliente guardadas")}
                    rows={2}
                  />
                </div>
              </div>
            </section>

            {/* Estado de negocio */}
            <section>
              <h3 className="font-semibold text-gray-900 mb-2">Estado del pedido</h3>
              <div className="flex flex-wrap gap-2">
                {["no-concretado", "confirmado", "enviado", "entregado", "cancelado"].map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      if (s === "cancelado" && !confirm("¿Cancelar el pedido? Se liberará el stock.")) return;
                      patchOrder(selected.id, { status: s }, `Estado: ${s}`);
                    }}
                    className={`px-3 py-1 text-xs rounded-full border ${selected.status === s ? "bg-gold-600 text-white border-gold-600" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </section>

            <div className="flex justify-end pt-4 border-t border-gray-200">
              <Button variant="secondary" onClick={() => setDetailOpen(false)}>Cerrar</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal crear pedido */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Nuevo pedido manual">
        <div className="space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nombre" value={custName} onChange={(e) => setCustName(e.target.value)} />
            <Input label="Apellido" value={custLast} onChange={(e) => setCustLast(e.target.value)} />
            <Input label="Teléfono" value={custPhone} onChange={(e) => setCustPhone(e.target.value)} />
            <Input label="Email (opcional)" value={custEmail} onChange={(e) => setCustEmail(e.target.value)} />
            <Input label="Dirección" value={custAddress} onChange={(e) => setCustAddress(e.target.value)} />
            <Input label="Ciudad" value={custCity} onChange={(e) => setCustCity(e.target.value)} />
            <Input label="Provincia" value={custProvince} onChange={(e) => setCustProvince(e.target.value)} />
            <Input label="Código postal" value={custPostal} onChange={(e) => setCustPostal(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Entrega</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={deliveryMethod} onChange={(e) => setDeliveryMethod(e.target.value as any)}>
                <option value="retiro">Retiro en local</option>
                <option value="envio">Envío</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Método de pago</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="mercado_pago">Mercado Pago</option>
              </select>
            </div>
            {deliveryMethod === "envio" && (
              <Input label="Costo de envío" type="number" value={shippingCost} onChange={(e) => setShippingCost(Number(e.target.value))} />
            )}
            <Input label="Descuento" type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
          </div>

          {/* Productos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Productos</label>
            <Input
              placeholder="Buscar producto..."
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
            />
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg mt-2 divide-y divide-gray-100">
              {filteredProducts.slice(0, 15).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addItem(p.id)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 flex justify-between text-sm"
                >
                  <span>{p.name} <span className="text-gray-400">({p.brand})</span></span>
                  <span className="text-gold-600">{formatPrice(p.price)}</span>
                </button>
              ))}
            </div>
            {items.length > 0 && (
              <div className="mt-3 space-y-2">
                {items.map((it) => {
                  const p = products.find((x) => x.id === it.productId);
                  if (!p) return null;
                  return (
                    <div key={it.productId} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 truncate">{p.name}</span>
                      <input
                        type="number"
                        min={1}
                        value={it.quantity}
                        onChange={(e) => updateItemQty(it.productId, Number(e.target.value))}
                        className="w-16 px-2 py-1 border border-gray-300 rounded"
                      />
                      <span className="w-24 text-right">{formatPrice(p.price * it.quantity)}</span>
                      <button onClick={() => removeItem(it.productId)} className="text-red-500 px-2">×</button>
                    </div>
                  );
                })}
                <div className="flex justify-between font-bold pt-2 border-t border-gray-200">
                  <span>Subtotal</span>
                  <span>{formatPrice(createSubtotal)}</span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones internas</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Creando..." : "Crear pedido"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
