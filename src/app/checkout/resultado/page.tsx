"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useOrders } from "@/context/OrdersContext";
import { formatPrice } from "@/config/site";
import type { Order } from "@/types";

export const dynamic = "force-dynamic";

type ResultStatus = "success" | "pending" | "failure";

const STATUS_CONFIG: Record<ResultStatus, { title: string; message: string; color: string; icon: string }> = {
  success: {
    title: "¡Pago aprobado!",
    message: "Tu pago fue aprobado correctamente. Estamos preparando tu pedido.",
    color: "text-green-700",
    icon: "M5 13l4 4L19 7",
  },
  pending: {
    title: "Pago pendiente",
    message: "Tu pago está siendo procesado. Te notificaremos por WhatsApp cuando se confirme.",
    color: "text-yellow-700",
    icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  failure: {
    title: "Pago rechazado",
    message: "No pudimos procesar tu pago. Podés intentarlo nuevamente o elegir otro medio de pago.",
    color: "text-red-700",
    icon: "M6 18L18 6M6 6l12 12",
  },
};

function CheckoutResultadoContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { getOrderById } = useOrders();

  const urlStatus = (params.get("status") as ResultStatus) || "pending";
  const orderNumber = params.get("order") || "";
  const paymentId = params.get("payment_id") || params.get("collection_id") || "";

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderNumber) {
      setLoading(false);
      return;
    }
    // Buscar el pedido en el contexto (ya cargado por OrdersProvider).
    const found = getOrderById(orderNumber);
    if (found) {
      setOrder(found);
    }
    setLoading(false);

    // Si el pago quedó pendiente, el webhook de MP puede actualizar el estado
    // segundos después. Re-consultamos unas pocas veces para reflejarlo sin
    // que el usuario tenga que recargar.
    if (urlStatus === "pending") {
      let attempts = 0;
      const timer = setInterval(() => {
        attempts += 1;
        const refreshed = getOrderById(orderNumber);
        if (refreshed) setOrder(refreshed);
        if (attempts >= 6) clearInterval(timer);
      }, 3000);
      return () => clearInterval(timer);
    }
  }, [orderNumber, getOrderById, urlStatus]);

  const config = STATUS_CONFIG[urlStatus] || STATUS_CONFIG.pending;

  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full">
        <div className="bg-white border border-charcoal-100 rounded-lg p-8 text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${urlStatus === "success" ? "bg-green-100" : urlStatus === "failure" ? "bg-red-100" : "bg-yellow-100"}`}>
            <svg className={`w-8 h-8 ${config.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={config.icon} />
            </svg>
          </div>

          <h1 className={`font-serif text-2xl mb-3 ${config.color}`}>{config.title}</h1>
          <p className="text-charcoal-600 mb-6">{config.message}</p>

          {orderNumber && (
            <div className="bg-cream-50 border border-charcoal-100 rounded-lg p-4 mb-6 text-left">
              <p className="text-sm text-charcoal-600 mb-1">
                <span className="font-medium">Pedido:</span> #{orderNumber}
              </p>
              {order && (
                <>
                  <p className="text-sm text-charcoal-600 mb-1">
                    <span className="font-medium">Estado:</span>{" "}
                    {order.status === "confirmado" ? "Confirmado" : order.status === "no-concretado" ? "Pendiente de pago" : order.status}
                  </p>
                  <p className="text-sm text-charcoal-600 mb-1">
                    <span className="font-medium">Total:</span> {formatPrice(order.total)}
                  </p>
                  <p className="text-sm text-charcoal-600">
                    <span className="font-medium">Método de pago:</span> {order.paymentMethod}
                  </p>
                </>
              )}
              {paymentId && (
                <p className="text-xs text-charcoal-400 mt-2">
                  ID de pago: {paymentId}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {orderNumber && (
              <Link href="/mi-pedidos" className="btn-primary">
                Ver mis pedidos
              </Link>
            )}
            {urlStatus === "failure" && (
              <Link href="/checkout" className="btn-gold">
                Reintentar pago
              </Link>
            )}
            <Link href="/" className="btn-secondary">
              Volver al inicio
            </Link>
          </div>

          {urlStatus === "pending" && (
            <p className="text-xs text-charcoal-400 mt-6">
              Si el pago ya fue aprobado, el estado se actualizará automáticamente.
              Podés consultar el estado en &quot;Mis pedidos&quot;.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CheckoutResultadoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-2 border-charcoal-200 border-t-gold-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm tracking-widest2 uppercase text-charcoal-400">
              Cargando
            </p>
          </div>
        </div>
      }
    >
      <CheckoutResultadoContent />
    </Suspense>
  );
}
