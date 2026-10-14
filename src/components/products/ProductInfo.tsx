"use client";

import { useState } from "react";
import Link from "next/link";
import type { Product } from "@/types";
import { formatPrice, generateWhatsAppUrl, siteConfig } from "@/config/site";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import QuantitySelector from "@/components/ui/QuantitySelector";
import Badge from "@/components/ui/Badge";

interface ProductInfoProps {
  product: Product;
  className?: string;
}

/**
 * Información completa de producto: marca, nombre, tipo, tamaño,
 * precio, descuento, disponibilidad, selector de cantidad y
 * botones de acción (Agregar al carrito / Comprar ahora / WhatsApp).
 */
export default function ProductInfo({ product, className = "" }: ProductInfoProps) {
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const { addToCart } = useCart();
  const { isAdmin } = useAuth();

  const handleAddToCart = async () => {
    setIsAdding(true);
    addToCart(product, quantity);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setIsAdding(false);
  };

  const handleBuyNow = () => {
    addToCart(product, quantity);
  };

  const whatsappMessage = `Hola ${siteConfig.name}, me interesa el perfume "${product.name}" de ${product.brand} (${formatPrice(product.price)}). ¿Está disponible?`;
  const whatsappUrl = generateWhatsAppUrl(whatsappMessage);

  const isOutOfStock = product.stock === 0;
  const isLowStock = product.stock > 0 && product.stock <= 3;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Marca */}
      <Link
        href={`/marcas/${product.brand.toLowerCase().replace(/\s+/g, "-")}`}
        className="inline-block text-xs font-semibold tracking-widest2 uppercase text-gold-600 hover:text-gold-700 transition-colors"
      >
        {product.brand}
      </Link>

      {/* Nombre */}
      <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-charcoal-900 tracking-tight leading-tight">
        {product.name}
      </h1>

      {/* Tipo y tamaño */}
      <p className="text-sm text-charcoal-500">
        {product.concentration} · {product.size}
      </p>

      {/* Precio */}
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-semibold text-charcoal-900">
          {formatPrice(product.price)}
        </span>
        {product.previousPrice && product.previousPrice > product.price && (
          <>
            <span className="text-lg text-charcoal-400 line-through">
              {formatPrice(product.previousPrice)}
            </span>
            {product.discount && product.discount > 0 && (
              <Badge variant="red">-{product.discount}%</Badge>
            )}
          </>
        )}
      </div>

      {/* Disponibilidad */}
      <div className="flex items-center gap-2">
        {isOutOfStock ? (
          <>
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-sm text-red-600 font-medium">
              Sin stock
            </span>
          </>
        ) : isLowStock ? (
          <>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-sm text-amber-600 font-medium">
              ¡Últimas {product.stock} unidades!
            </span>
          </>
        ) : (
          <>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-sm text-emerald-600 font-medium">
              En stock
            </span>
          </>
        )}
      </div>

      {/* Descripción corta */}
      {product.description && (
        <p className="text-sm text-charcoal-600 leading-relaxed">
          {product.description}
        </p>
      )}

      {/* Selector de cantidad */}
      {!isOutOfStock && (
        <div className="space-y-3">
          <label className="text-xs font-medium tracking-widest uppercase text-charcoal-600">
            Cantidad
          </label>
          <QuantitySelector
            value={quantity}
            onChange={setQuantity}
            min={1}
            max={Math.min(product.stock, 10)}
            size="md"
          />
        </div>
      )}

      {/* Botones de acción - solo para clientes */}
      {!isAdmin && (
        <div className="space-y-3 pt-2">
          {/* Agregar al carrito */}
          <button
            onClick={handleAddToCart}
            disabled={isAdding || isOutOfStock}
            className={[
              "w-full flex items-center justify-center gap-2 px-8 py-4 text-sm font-medium tracking-widest uppercase transition-all duration-300",
              isAdding
                ? "bg-emerald-600 text-white"
                : isOutOfStock
                ? "bg-charcoal-200 text-charcoal-400 cursor-not-allowed"
                : "bg-charcoal-900 text-cream-50 hover:bg-charcoal-800",
            ].join(" ")}
          >
            {isAdding ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Agregando...
              </>
            ) : isOutOfStock ? (
              "Sin stock"
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
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
                Agregar al carrito
              </>
            )}
          </button>

          {/* Comprar ahora */}
          {!isOutOfStock && (
            <button
              onClick={handleBuyNow}
              className="w-full flex items-center justify-center gap-2 px-8 py-4 text-sm font-medium tracking-widest uppercase border border-charcoal-900 text-charcoal-900 hover:bg-charcoal-900 hover:text-cream-50 transition-all duration-300"
            >
              Comprar ahora
            </button>
          )}

          {/* Consultar por WhatsApp */}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 px-8 py-4 text-sm font-medium tracking-widest uppercase bg-[#25D366] text-white hover:bg-[#1da851] transition-all duration-300"
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
          </a>
        </div>
      )}

      {/* Notas olfativas */}
      {product.notes && (
        <div className="pt-6 border-t border-cream-200 space-y-4">
          <h3 className="text-xs font-semibold tracking-widest2 uppercase text-charcoal-600">
            Pirámide olfativa
          </h3>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Salida", notes: product.notes.top },
              { label: "Corazón", notes: product.notes.heart },
              { label: "Fondo", notes: product.notes.base },
            ].map((layer) => (
              <div key={layer.label} className="text-center">
                <p className="text-[10px] font-semibold tracking-widest uppercase text-gold-600 mb-2">
                  {layer.label}
                </p>
                <p className="text-xs text-charcoal-600 leading-relaxed">
                  {layer.notes.join(", ")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
