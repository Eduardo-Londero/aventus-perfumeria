"use client";

import Image from "next/image";
import type { CartItem as CartItemType } from "@/types";
import { formatPrice } from "@/config/site";
import { useCart } from "@/context/CartContext";
import QuantitySelector from "@/components/ui/QuantitySelector";

interface CartItemProps {
  item: CartItemType;
  className?: string;
}

/**
 * Item individual del carrito con imagen, nombre, marca, precio,
 * selector de cantidad y botón eliminar.
 */
export default function CartItem({ item, className = "" }: CartItemProps) {
  const { updateQuantity, removeFromCart } = useCart();

  const handleRemove = () => {
    removeFromCart(item.product.id);
  };

  return (
    <div className={`flex gap-4 py-4 border-b border-cream-200 last:border-b-0 ${className}`}>
      {/* Imagen */}
      <div className="relative w-20 h-24 flex-shrink-0 bg-cream-100 overflow-hidden">
        <Image
          src={item.product.images[0]}
          alt={`${item.product.brand} ${item.product.name}`}
          fill
          sizes="80px"
          className="object-cover"
        />
      </div>

      {/* Información */}
      <div className="flex-1 min-w-0">
        {/* Marca */}
        <p className="text-[10px] font-semibold tracking-widest2 uppercase text-gold-600">
          {item.product.brand}
        </p>

        {/* Nombre */}
        <h4 className="font-serif text-sm text-charcoal-900 tracking-tight truncate mt-0.5">
          {item.product.name}
        </h4>

        {/* Tamaño */}
        <p className="text-xs text-charcoal-500 mt-0.5">{item.product.size}</p>

        {/* Precio unitario */}
        <p className="text-sm font-medium text-charcoal-900 mt-2">
          {formatPrice(item.product.price)}
        </p>

        {/* Cantidad y eliminar */}
        <div className="flex items-center justify-between mt-3">
          <QuantitySelector
            value={item.quantity}
            onChange={(qty) => updateQuantity(item.product.id, qty)}
            min={1}
            max={99}
            size="sm"
          />

          <button
            onClick={handleRemove}
            aria-label={`Eliminar ${item.product.name} del carrito`}
            className="text-charcoal-400 hover:text-red-500 transition-colors duration-200 p-1"
          >
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
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Precio total del item */}
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-semibold text-charcoal-900">
          {formatPrice(item.product.price * item.quantity)}
        </p>
        {item.quantity > 1 && (
          <p className="text-xs text-charcoal-400 mt-0.5">
            {formatPrice(item.product.price)} c/u
          </p>
        )}
      </div>
    </div>
  );
}
