"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { IS_SUPABASE_BACKEND } from "@/lib/dataBackend";
import { siteConfig, generateWhatsAppUrl, formatPrice } from "@/config/site";
import CartItem from "./CartItem";
import CartSummary from "./CartSummary";
import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";

/**
 * Drawer lateral derecho con lista de items del carrito,
 * resumen y botones de acción. Animación slide-in.
 * Estado vacío con mensaje elegante.
 */
export default function CartDrawer() {
  const { items, isOpen, closeCart, totalItems, subtotal, clearCart } = useCart();
  const { isAdmin, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const hideCart = ["/login", "/registro", "/recuperar-password", "/checkout"].some(
    (p) => pathname === p || pathname?.startsWith(p + "/")
  );
  const router = useRouter();

  // Cerrar con Escape
  // NOTA: los hooks deben declararse SIEMPRE antes de cualquier return
  // condicional (regla de React). Antes había un `if (isAdmin) return null`
  // acá arriba, lo que quebraba el orden de hooks al cambiar de sesión.
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeCart();
      }
    },
    [closeCart]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  const handleCheckout = () => {
    closeCart();
    router.push("/checkout");
  };

  const handleContinueShopping = () => {
    closeCart();
  };

  const handleFinalizeWhatsApp = () => {
    const itemsList = items
      .map(
        (item) =>
          `* ${item.product.brand} ${item.product.name} x${item.quantity} = ${formatPrice(item.product.price * item.quantity)}`
      )
      .join("\n");

    const message = `Hola ${siteConfig.name}, quiero hacer un pedido:\n\n${itemsList}\n\nTotal: ${formatPrice(subtotal)}`;

    window.open(generateWhatsAppUrl(message), "_blank");
    clearCart();
    closeCart();
  };

  // No mostrar carrito para administradores, invitados o en rutas de auth/checkout
  if (isAdmin || hideCart) return null;
  if (IS_SUPABASE_BACKEND && !isAuthenticated) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className={[
          "fixed inset-0 z-50 bg-charcoal-950/50 backdrop-blur-sm transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        ].join(" ")}
        onClick={closeCart}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={[
          "fixed top-0 right-0 z-50 h-full w-full max-w-md bg-cream-50 shadow-2xl flex flex-col transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
        role="dialog"
        aria-modal="true"
        aria-label="Carrito de compras"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cream-200">
          <h2 className="font-serif text-xl text-charcoal-900 tracking-tight">
            Tu carrito
            {totalItems > 0 && (
              <span className="text-sm font-sans font-normal text-charcoal-500 ml-2">
                ({totalItems} {totalItems === 1 ? "producto" : "productos"})
              </span>
            )}
          </h2>
          <button
            onClick={closeCart}
            aria-label="Cerrar carrito"
            className="p-2 text-charcoal-500 hover:text-charcoal-900 hover:bg-cream-100 rounded-full transition-colors duration-200"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Contenido */}
        {items.length === 0 ? (
          /* Estado vacío */
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon={
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-10 w-10"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                  />
                </svg>
              }
              title="Tu carrito está vacío"
              description="Explorá nuestra colección y encontrá la fragancia perfecta para vos."
              action={{
                label: "Explorar perfumes",
                onClick: handleContinueShopping,
              }}
            />
          </div>
        ) : (
          <>
            {/* Lista de items */}
            <div className="flex-1 overflow-y-auto px-6">
              {items.map((item) => (
                <CartItem key={item.product.id} item={item} />
              ))}
            </div>

            {/* Footer con resumen y acciones */}
            <div className="border-t border-cream-200 p-6 space-y-4 bg-cream-50">
              <CartSummary subtotal={subtotal} itemCount={totalItems} />

              {/* Botón Finalizar compra (checkout) */}
              <Button
                variant="primary"
                size="md"
                className="w-full"
                onClick={handleCheckout}
              >
                Finalizar compra
              </Button>

              {/* Botón WhatsApp (alternativa) */}
              <Button
                variant="secondary"
                size="md"
                className="w-full"
                onClick={handleFinalizeWhatsApp}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Consultar por WhatsApp
              </Button>

              {/* Botón seguir comprando */}
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={handleContinueShopping}
                as="link"
                href="/perfumes"
              >
                Seguir comprando
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
