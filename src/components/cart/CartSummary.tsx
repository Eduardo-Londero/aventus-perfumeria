"use client";

import { useMemo } from "react";
import { formatPrice } from "@/config/site";
import {
  computeShipping,
  freeShippingProgress,
  freeShippingRemaining,
} from "@/lib/pricing";

interface CartSummaryProps {
  subtotal: number;
  itemCount: number;
  className?: string;
}

/**
 * Resumen del carrito con subtotal, envío (gratis sobre cierto monto)
 * y total.
 */
export default function CartSummary({
  subtotal,
  itemCount,
  className = "",
}: CartSummaryProps) {
  // Mismo motor que el resto de la tienda (src/lib/pricing.ts)
  const shippingCost = useMemo(
    () => computeShipping(subtotal, "envio"),
    [subtotal]
  );

  const total = subtotal + shippingCost;

  const remaining = freeShippingRemaining(subtotal);
  const progress = freeShippingProgress(subtotal);

  return (
    <div className={`bg-cream-100 p-5 space-y-4 ${className}`}>
      <h3 className="text-xs font-semibold tracking-widest2 uppercase text-charcoal-600">
        Resumen del pedido
      </h3>

      {/* Barra de progreso envío gratis */}
      {itemCount > 0 && (
        <div className="space-y-2">
          {remaining > 0 ? (
            <p className="text-xs text-charcoal-600">
              Agregá <span className="font-semibold text-gold-600">{formatPrice(remaining)}</span> más para envío gratis
            </p>
          ) : (
            <p className="text-xs text-emerald-600 font-medium flex items-center gap-1.5">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              ¡Envío gratis desbloqueado!
            </p>
          )}
          <div className="h-1.5 bg-cream-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gold-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Líneas del resumen */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-charcoal-600">
          <span>Subtotal ({itemCount} {itemCount === 1 ? "producto" : "productos"})</span>
          <span className="font-medium text-charcoal-900">{formatPrice(subtotal)}</span>
        </div>
        <div className="flex justify-between text-charcoal-600">
          <span>Envío</span>
          {shippingCost === 0 ? (
            <span className="font-medium text-emerald-600">Gratis</span>
          ) : (
            <span className="font-medium text-charcoal-900">{formatPrice(shippingCost)}</span>
          )}
        </div>
      </div>

      {/* Divisor */}
      <div className="border-t border-cream-200 pt-3">
        <div className="flex justify-between items-baseline">
          <span className="text-sm font-semibold text-charcoal-900">Total</span>
          <span className="text-xl font-semibold text-charcoal-900">
            {formatPrice(total)}
          </span>
        </div>
        <p className="text-[10px] text-charcoal-400 text-right mt-0.5">
          Impuestos incluidos
        </p>
      </div>
    </div>
  );
}
