"use client";

import {
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type Size = "sm" | "md" | "lg";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: Size;
  showCloseButton?: boolean;
}

const sizeStyles: Record<Size, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

/**
 * Modal accesible con animación suave.
 * - Cierra con Escape, click en overlay o botón X
 * - Bloquea scroll del body mientras está abierto
 * - Foco inicial en el modal y restauración al cerrar
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  showCloseButton = true,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;

    // Guardar elemento activo para restaurar el foco al cerrar
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Bloquear scroll del body
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Listener para Escape
    document.addEventListener("keydown", handleKeyDown);

    // Foco inicial en el modal
    const focusTimer = setTimeout(() => {
      modalRef.current?.focus();
    }, 50);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      clearTimeout(focusTimer);
      // Restaurar foco
      previousActiveElement.current?.focus();
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
      onClick={handleOverlayClick}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-charcoal-950/60 backdrop-blur-sm" />

      {/* Contenido del modal */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className={`relative w-full ${sizeStyles[size]} bg-cream-50 shadow-2xl animate-slide-up outline-none max-h-[90vh] overflow-y-auto`}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-cream-200 sticky top-0 bg-cream-50 z-10">
            {title && (
              <h2
                id="modal-title"
                className="font-serif text-2xl text-charcoal-900 tracking-tight"
              >
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                aria-label="Cerrar modal"
                className="ml-auto p-2 text-charcoal-500 hover:text-charcoal-900 hover:bg-cream-100 rounded-full transition-colors duration-200"
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
            )}
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-6">{children}</div>
      </div>
    </div>,
    document.body
  );
}
