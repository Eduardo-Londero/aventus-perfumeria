"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/types";
import { formatPrice } from "@/config/site";
import { useCart } from "@/context/CartContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useAuth } from "@/context/AuthContext";
import Badge from "@/components/ui/Badge";
import FavoriteModal from "@/components/ui/FavoriteModal";

interface ProductCardProps {
  product: Product;
  className?: string;
}

/**
 * Tarjeta de producto premium con hover zoom, overlay "Ver detalle",
 * badge de descuento, botón agregar al carrito y botón de favoritos.
 */
export default function ProductCard({ product, className = "" }: ProductCardProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [showFavoriteModal, setShowFavoriteModal] = useState(false);
  const { addToCart, toggleCart } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { isAuthenticated, isAdmin } = useAuth();

  const favorite = isFavorite(product.id);

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsAdding(true);
    addToCart(product, 1);

    // Feedback visual breve
    await new Promise((resolve) => setTimeout(resolve, 600));
    setIsAdding(false);
    toggleCart();
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      setShowFavoriteModal(true);
      return;
    }
    toggleFavorite(product.id);
  };

  return (
    <Link
      href={`/perfumes/${product.slug}`}
      className={`group block bg-white border border-cream-200 overflow-hidden transition-all duration-500 hover:shadow-xl hover:shadow-charcoal-900/10 hover:-translate-y-1 ${className}`}
    >
      {/* Imagen con hover zoom */}
      <div className="relative aspect-[3/4] overflow-hidden bg-cream-100">
        <Image
          src={product.images[0]}
          alt={`${product.brand} ${product.name}`}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
          priority={product.featured}
        />

        {/* Overlay con "Ver detalle" al hover */}
        <div className="absolute inset-0 bg-charcoal-950/0 group-hover:bg-charcoal-950/30 transition-all duration-500 flex items-center justify-center">
          <span className="text-cream-50 text-xs font-medium tracking-widest uppercase opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-500 border border-cream-50/50 px-4 py-2">
            Ver detalle
          </span>
        </div>

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {product.discount && product.discount > 0 && (
            <Badge variant="red" pulse>
              -{product.discount}%
            </Badge>
          )}
          {product.isNew && (
            <Badge variant="gold">Nuevo</Badge>
          )}
          {product.isOnSale && !product.discount && (
            <Badge variant="black">Oferta</Badge>
          )}
        </div>

        {/* Botón favoritos */}
        <button
          onClick={handleToggleFavorite}
          aria-label={favorite ? "Quitar de favoritos" : "Agregar a favoritos"}
          aria-pressed={favorite}
          className={[
            "absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300",
            favorite
              ? "bg-red-50 text-red-500"
              : "bg-white/90 text-charcoal-400 hover:text-red-500 hover:bg-white",
          ].join(" ")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4.5 w-4.5"
            viewBox="0 0 24 24"
            fill={favorite ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
        </button>
      </div>

      {/* Información del producto */}
      <div className="p-4 sm:p-5">
        {/* Marca */}
        <p className="text-[10px] font-semibold tracking-widest2 uppercase text-gold-600 mb-1">
          {product.brand}
        </p>

        {/* Nombre */}
        <h3 className="font-serif text-lg text-charcoal-900 tracking-tight leading-snug mb-1 group-hover:text-gold-700 transition-colors duration-300 line-clamp-2">
          {product.name}
        </h3>

        {/* Concentración y tamaño */}
        <p className="text-xs text-charcoal-500 mb-3">
          {product.concentration} · {product.size}
        </p>

        {/* Precio */}
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-lg font-semibold text-charcoal-900">
            {formatPrice(product.price)}
          </span>
          {product.previousPrice && product.previousPrice > product.price && (
            <span className="text-sm text-charcoal-400 line-through">
              {formatPrice(product.previousPrice)}
            </span>
          )}
        </div>

        {/* Botón agregar al carrito - solo para clientes */}
        {!isAdmin && (
          <button
            onClick={handleAddToCart}
            disabled={isAdding || !product.stock || product.stock <= 0}
            className={[
              "w-full flex items-center justify-center gap-2 px-4 py-3 text-xs font-medium tracking-widest uppercase transition-all duration-300",
              isAdding
                ? "bg-emerald-600 text-white"
                : !product.stock || product.stock <= 0
                ? "bg-charcoal-200 text-charcoal-400 cursor-not-allowed"
                : "bg-charcoal-900 text-cream-50 hover:bg-gold-600",
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
            ) : !product.stock || product.stock <= 0 ? (
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
        )}
      </div>
      <FavoriteModal
        isOpen={showFavoriteModal}
        onClose={() => setShowFavoriteModal(false)}
      />
    </Link>
  );
}
