"use client";

import Link from "next/link";

interface FavoriteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal elegante que se muestra cuando un usuario invitado
 * intenta agregar un producto a favoritos.
 */
export default function FavoriteModal({ isOpen, onClose }: FavoriteModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-charcoal-950/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-cream-50 border border-charcoal-100 rounded-xl shadow-2xl max-w-sm w-full p-8 animate-slide-up">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-charcoal-400 hover:text-charcoal-600 transition-colors"
          aria-label="Cerrar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Icon */}
        <div className="w-16 h-16 bg-gold-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-gold-600"
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

        <h3 className="font-serif text-xl text-charcoal-900 text-center mb-2">
          Iniciá sesión para guardar tus favoritos
        </h3>
        <p className="text-sm text-charcoal-600 text-center mb-6">
          Creá una cuenta o ingresá para guardar este perfume en tu lista de favoritos.
        </p>

        <div className="space-y-3">
          <Link
            href="/login"
            onClick={onClose}
            className="btn-primary w-full text-center block"
          >
            INGRESAR
          </Link>
          <Link
            href="/registro"
            onClick={onClose}
            className="btn-secondary w-full text-center block"
          >
            CREAR CUENTA
          </Link>
          <button
            onClick={onClose}
            className="w-full py-2 text-sm text-charcoal-500 hover:text-charcoal-700 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
