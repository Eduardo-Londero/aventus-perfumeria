"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function ResultadoInner() {
  const params = useSearchParams();
  const status = params.get("status");
  const order = params.get("order");

  const title =
    status === "success"
      ? "Pago aprobado"
      : status === "pending"
      ? "Pago pendiente"
      : "Pago no completado";

  const message =
    status === "success"
      ? "Tu pago fue aprobado. Te notificaremos cuando el pedido se confirme."
      : status === "pending"
      ? "Tu pago está pendiente de acreditación. Podés consultar el estado en Mis pedidos."
      : "El pago no se completó. Podés intentar nuevamente desde el checkout.";

  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white border border-charcoal-100 p-8 text-center">
        <h1 className="font-serif text-2xl text-charcoal-900 mb-3">{title}</h1>
        <p className="text-charcoal-600 mb-6">{message}</p>
        {order && (
          <p className="text-sm text-charcoal-500 mb-6">
            Pedido: <span className="font-medium">{order}</span>
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/mi-pedidos" className="btn-primary">
            Ver mis pedidos
          </Link>
          <Link href="/perfumes" className="btn-secondary">
            Seguir explorando
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutResultadoPage() {
  return (
    <Suspense fallback={null}>
      <ResultadoInner />
    </Suspense>
  );
}