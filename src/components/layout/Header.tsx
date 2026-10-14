"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useAuth } from "@/context/AuthContext";
import { siteConfig, generateWhatsAppUrl } from "@/config/site";

const navLinks = [
  { href: "/", label: "Inicio" },
  { href: "/perfumes", label: "Perfumes" },
  { href: "/marcas", label: "Marcas" },
  { href: "/ofertas", label: "Ofertas" },
  { href: "/nosotros", label: "Nosotros" },
  { href: "/contacto", label: "Contacto" },
];

/**
 * Header premium responsive.
 * - Desktop: logo + menú completo + íconos búsqueda/favoritos/carrito
 * - Mobile: logo + búsqueda + carrito + hamburguesa
 * - Transparente sobre hero, sólido con backdrop blur al hacer scroll
 */
export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { totalItems, toggleCart } = useCart();
  const { favorites } = useFavorites();
  const { isAuthenticated, isAdmin, user } = useAuth();
  const pathname = usePathname();

  // Detectar scroll para cambiar estilo del header
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Cerrar menú mobile al cambiar de ruta
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsSearchOpen(false);
  }, [pathname]);

  // Bloquear scroll cuando el menú mobile está abierto
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  const handleSearchSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (searchQuery.trim()) {
        window.location.href = `/perfumes?q=${encodeURIComponent(searchQuery.trim())}`;
        setIsSearchOpen(false);
      }
    },
    [searchQuery]
  );

  // El panel de administración renderiza su propio header y sidebar.
  // El header público es `fixed ... z-40` y, al renderizarse también en /admin,
  // se superponía sobre los controles del panel (p. ej. "+ Agregar producto").
  // Se omite únicamente en rutas de administración; el header público no cambia
  // en ninguna otra ruta.
  if (pathname?.startsWith("/admin")) {
    return null;
  }

  const headerClasses = [
    "fixed top-0 left-0 right-0 z-40 transition-all duration-500",
    isScrolled || isMobileMenuOpen
      ? "bg-cream-50/95 backdrop-blur-md shadow-sm border-b border-cream-200"
      : "bg-transparent",
  ].join(" ");

  const textColorClass = isScrolled || isMobileMenuOpen
    ? "text-charcoal-900"
    : "text-cream-50";

  return (
    <>
      <header className={headerClasses}>
        <div className="container-aventus">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <Link
              href="/"
              className={`font-serif text-2xl sm:text-3xl tracking-tight transition-colors duration-300 ${textColorClass}`}
            >
              <span className="font-semibold">AVENTUS</span>
              <span className="font-light ml-1 hidden sm:inline">Perfumería</span>
            </Link>

            {/* Navegación Desktop */}
            <nav className="hidden lg:flex items-center gap-8" aria-label="Navegación principal">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={[
                    "text-xs font-medium tracking-widest uppercase transition-colors duration-200 relative group",
                    pathname === link.href
                      ? "text-gold-600"
                      : `${textColorClass} hover:text-gold-600`,
                  ].join(" ")}
                >
                  {link.label}
                  <span
                    className={[
                      "absolute -bottom-1 left-0 h-px bg-gold-600 transition-all duration-300",
                      pathname === link.href ? "w-full" : "w-0 group-hover:w-full",
                    ].join(" ")}
                  />
                </Link>
              ))}
            </nav>

            {/* Íconos Desktop */}
            <div className="hidden lg:flex items-center gap-5">
              {/* Búsqueda */}
              <button
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                aria-label="Buscar"
                className={`${textColorClass} hover:text-gold-600 transition-colors duration-200`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </button>

              {/* Favoritos - solo para clientes */}
              {!isAdmin && (
                <Link
                  href="/favoritos"
                  aria-label={`Favoritos (${favorites.length})`}
                  className={`${textColorClass} hover:text-gold-600 transition-colors duration-200 relative`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    />
                  </svg>
                  {favorites.length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gold-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {favorites.length}
                    </span>
                  )}
                </Link>
              )}

              {/* Cuenta - diferente para admin y cliente */}
              {isAdmin ? (
                <Link
                  href="/admin"
                  className={`${textColorClass} hover:text-gold-600 transition-colors duration-200 flex items-center gap-2`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                    />
                  </svg>
                  <span className="text-xs font-medium tracking-widest uppercase">
                    Dashboard
                  </span>
                </Link>
              ) : (
                <Link
                  href={isAuthenticated ? "/mi-cuenta" : "/login"}
                  className={`${textColorClass} hover:text-gold-600 transition-colors duration-200 flex items-center gap-2`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  <span className="text-xs font-medium tracking-widest uppercase">
                    {isAuthenticated ? "Mi cuenta" : "Ingresar"}
                  </span>
                </Link>
              )}

              {/* Carrito - solo para clientes */}
              {!isAdmin && (
                <button
                  onClick={toggleCart}
                  aria-label={`Carrito (${totalItems} productos)`}
                  className={`${textColorClass} hover:text-gold-600 transition-colors duration-200 relative`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
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
                  {totalItems > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gold-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {totalItems}
                    </span>
                  )}
                </button>
              )}
            </div>

            {/* Íconos Mobile */}
            <div className="flex lg:hidden items-center gap-4">
              {/* Búsqueda Mobile */}
              <button
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                aria-label="Buscar"
                className={`${textColorClass} hover:text-gold-600 transition-colors duration-200`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </button>

              {/* Carrito Mobile - solo para clientes */}
              {!isAdmin && (
                <button
                  onClick={toggleCart}
                  aria-label={`Carrito (${totalItems} productos)`}
                  className={`${textColorClass} hover:text-gold-600 transition-colors duration-200 relative`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
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
                  {totalItems > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gold-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {totalItems}
                    </span>
                  )}
                </button>
              )}

              {/* Hamburguesa */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label={isMobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
                aria-expanded={isMobileMenuOpen}
                className={`${textColorClass} hover:text-gold-600 transition-colors duration-200`}
              >
                {isMobileMenuOpen ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Barra de búsqueda expandible */}
        {isSearchOpen && (
          <div className="border-t border-cream-200 bg-cream-50/95 backdrop-blur-md animate-fade-in">
            <div className="container-aventus py-4">
              <form onSubmit={handleSearchSubmit} className="relative">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar perfumes, marcas..."
                  autoFocus
                  className="w-full px-4 py-3 pr-12 bg-white border border-charcoal-200 text-charcoal-900 placeholder-charcoal-400 focus:outline-none focus:border-gold-500 focus:ring-1 focus:ring-gold-500 transition-all duration-200 text-sm"
                />
                <button
                  type="submit"
                  aria-label="Buscar"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-400 hover:text-gold-600 transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </button>
              </form>
            </div>
          </div>
        )}
      </header>

      {/* Menú Mobile Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          {/* Overlay oscuro */}
          <div
            className="absolute inset-0 bg-charcoal-950/50 backdrop-blur-sm animate-fade-in"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Panel del menú */}
          <div className="absolute top-20 left-0 right-0 bg-cream-50 border-b border-cream-200 shadow-xl animate-slide-up">
            <nav className="container-aventus py-6" aria-label="Navegación móvil">
              <ul className="space-y-1">
                {navLinks.map((link, index) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={[
                        "block px-4 py-3 text-sm font-medium tracking-widest uppercase transition-colors duration-200 border-l-2",
                        pathname === link.href
                          ? "text-gold-600 border-gold-600 bg-gold-50"
                          : "text-charcoal-700 border-transparent hover:text-gold-600 hover:border-gold-300 hover:bg-cream-100",
                      ].join(" ")}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>

              {/* Enlace Cuenta en menú mobile - según rol */}
              <div className="mt-6 pt-6 border-t border-cream-200 px-4">
                {isAdmin ? (
                  <Link
                    href="/admin"
                    className="flex items-center gap-3 text-sm text-charcoal-600 hover:text-gold-600 transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                      />
                    </svg>
                    Dashboard Admin
                  </Link>
                ) : (
                  <Link
                    href={isAuthenticated ? "/mi-cuenta" : "/login"}
                    className="flex items-center gap-3 text-sm text-charcoal-600 hover:text-gold-600 transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    {isAuthenticated ? `Hola, ${user?.name}` : "Ingresar"}
                  </Link>
                )}
              </div>

              {/* Enlace WhatsApp en menú mobile */}
              <div className="mt-4 px-4">
                <a
                  href={generateWhatsAppUrl(siteConfig.whatsapp.message)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-sm text-charcoal-600 hover:text-gold-600 transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-emerald-600"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Consultar por WhatsApp
                </a>
              </div>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
