"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/context/ToastContext";
import { dbProducts, onBackendReady } from "@/lib/db";
import { formatPrice } from "@/config/site";
import type { Product } from "@/types";

export default function FavoritosPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { favorites, toggleFavorite } = useFavorites();
  const { addToCart } = useCart();
  const { showToast } = useToast();
  const [isClient, setIsClient] = useState(false);

  /**
   * Con el backend `supabase` el catálogo llega por hidratación async. Este
   * tick fuerza un re-render cuando los datos ya están disponibles (con el
   * backend por defecto no hace nada).
   */
  const [catalogVersion, setCatalogVersion] = useState(0);

  useEffect(() => {
    setIsClient(true);
    return onBackendReady(() => setCatalogVersion((v) => v + 1));
  }, []);

  // Obtener productos favoritos desde la base de datos. Con el backend
  // `supabase` el catálogo se hidrata de forma asíncrona: `catalogVersion`
  // dispara la relección cuando los datos llegan (con el backend por defecto
  // el valor nunca cambia y el efecto es equivalente al anterior).
  const allProducts = useMemo(() => {
    // `catalogVersion` dispara la relección cuando llega el catálogo remoto
    // (con el backend por defecto nunca cambia: se lee en cada render).
    void catalogVersion;
    return dbProducts.getAll();
  }, [catalogVersion]);
  const favoriteProducts = allProducts.filter((p) => favorites.includes(p.id));

  const handleAddToCart = (product: Product) => {
    addToCart(product, 1);
    showToast(`${product.name} agregado al carrito`, "success");
  };

  // Loading state
  if (!isClient || authLoading) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gold-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-charcoal-600">Cargando...</p>
        </div>
      </div>
    );
  }

  // No autenticado - Ya no se redirige, se muestra un mensaje elegante
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-gold-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-10 h-10 text-gold-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </div>
          <h1 className="font-serif text-3xl text-charcoal-900 mb-3">
            Iniciá sesión para guardar tus favoritos
          </h1>
          <p className="text-charcoal-600 mb-8">
            Creá una cuenta o ingresá para guardar tus fragancias favoritas y encontrarlas fácilmente cuando vuelvas.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/login" className="btn-primary">
              INGRESAR
            </Link>
            <Link href="/registro" className="btn-secondary">
              CREAR CUENTA
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Autenticado - mostrar favoritos
  return (
    <div className="min-h-screen bg-cream-50">
      {/* Header */}
      <div className="bg-charcoal-950 text-cream-50 py-16">
        <div className="container-aventus">
          <p className="text-xs tracking-widest2 uppercase text-gold-400 mb-3">
            Mi cuenta
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl mb-4">Mis Favoritos</h1>
          <p className="text-cream-50/70 max-w-2xl">
            {favoriteProducts.length > 0
              ? `Tenés ${favoriteProducts.length} ${favoriteProducts.length === 1 ? "perfume guardado" : "perfumes guardados"} en tu lista.`
              : "Todavía no guardaste ningún perfume."}
          </p>
        </div>
      </div>

      <div className="container-aventus py-12">
        {favoriteProducts.length === 0 ? (
          <div className="text-center py-20">
            <svg
              className="w-16 h-16 text-charcoal-200 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
            <h3 className="font-serif text-2xl text-charcoal-900 mb-2">
              Todavía no guardaste ningún perfume
            </h3>
            <p className="text-charcoal-500 mb-6 max-w-md mx-auto">
              Explorá nuestra colección y guardá tus favoritos para encontrarlos fácilmente después.
            </p>
            <Link href="/perfumes" className="btn-primary">
              VER PERFUMES
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {favoriteProducts.map((product) => (
              <div
                key={product.id}
                className="bg-white border border-charcoal-100 rounded-lg overflow-hidden group hover:shadow-lg transition-shadow duration-300"
              >
                {/* Image */}
                <div className="relative aspect-square overflow-hidden">
                  <Image
                    src={product.images[0]}
                    alt={product.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  />
                  {/* Favorite button */}
                  <button
                    onClick={() => toggleFavorite(product.id)}
                    className="absolute top-3 right-3 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors"
                    aria-label="Quitar de favoritos"
                  >
                    <svg
                      className="w-5 h-5 text-red-500"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </button>
                  {/* Badges */}
                  <div className="absolute top-3 left-3 flex flex-col gap-2">
                    {product.isNew && (
                      <span className="px-2 py-1 text-[10px] font-medium bg-blue-600 text-white rounded">
                        NUEVO
                      </span>
                    )}
                    {product.isOnSale && (
                      <span className="px-2 py-1 text-[10px] font-medium bg-red-600 text-white rounded">
                        OFERTA
                      </span>
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="p-4">
                  <p className="text-xs text-gold-600 tracking-wider uppercase mb-1">
                    {product.brand}
                  </p>
                  <Link href={`/perfumes/${product.slug}`}>
                    <h3 className="font-serif text-lg text-charcoal-900 mb-2 hover:text-gold-600 transition-colors line-clamp-1">
                      {product.name}
                    </h3>
                  </Link>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-lg font-semibold text-charcoal-900">
                        {formatPrice(product.price)}
                      </span>
                      {product.previousPrice && (
                        <span className="text-sm text-charcoal-400 line-through ml-2">
                          {formatPrice(product.previousPrice)}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleAddToCart(product)}
                    disabled={product.stock === 0}
                    className="w-full mt-4 py-2.5 bg-charcoal-900 text-cream-50 text-sm font-medium tracking-wide hover:bg-charcoal-800 transition-colors disabled:bg-charcoal-200 disabled:text-charcoal-400 disabled:cursor-not-allowed"
                  >
                    {product.stock === 0 ? "Sin stock" : "Agregar al carrito"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
