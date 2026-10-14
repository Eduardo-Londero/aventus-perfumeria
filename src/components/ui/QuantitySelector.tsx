"use client";

import { useCallback } from "react";

type Size = "sm" | "md" | "lg";

interface QuantitySelectorProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  size?: Size;
  disabled?: boolean;
  className?: string;
}

const sizeStyles: Record<Size, { button: string; display: string }> = {
  sm: {
    button: "w-8 h-8 text-lg",
    display: "w-10 text-sm",
  },
  md: {
    button: "w-10 h-10 text-xl",
    display: "w-12 text-base",
  },
  lg: {
    button: "w-12 h-12 text-2xl",
    display: "w-14 text-lg",
  },
};

/**
 * Selector de cantidad con botones -, + y display central.
 * Respeta los límites min/max y deshabilita botones en extremos.
 */
export default function QuantitySelector({
  value,
  onChange,
  min = 1,
  max = 99,
  size = "md",
  disabled = false,
  className = "",
}: QuantitySelectorProps) {
  const styles = sizeStyles[size];

  const handleDecrement = useCallback(() => {
    if (value > min) {
      onChange(value - 1);
    }
  }, [value, min, onChange]);

  const handleIncrement = useCallback(() => {
    if (value < max) {
      onChange(value + 1);
    }
  }, [value, max, onChange]);

  const decrementDisabled = disabled || value <= min;
  const incrementDisabled = disabled || value >= max;

  return (
    <div
      className={`inline-flex items-center border border-charcoal-200 bg-white ${className}`}
      role="group"
      aria-label="Selector de cantidad"
    >
      {/* Botón decrementar */}
      <button
        type="button"
        onClick={handleDecrement}
        disabled={decrementDisabled}
        aria-label="Disminuir cantidad"
        className={[
          styles.button,
          "flex items-center justify-center text-charcoal-600 hover:text-charcoal-900 hover:bg-cream-100 transition-colors duration-200",
          decrementDisabled
            ? "opacity-30 cursor-not-allowed hover:bg-transparent hover:text-charcoal-600"
            : "",
        ].join(" ")}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
        </svg>
      </button>

      {/* Display central */}
      <div
        className={[
          styles.display,
          "flex items-center justify-center text-charcoal-900 font-medium border-x border-charcoal-200 h-full",
        ].join(" ")}
        aria-live="polite"
        aria-atomic="true"
      >
        {value}
      </div>

      {/* Botón incrementar */}
      <button
        type="button"
        onClick={handleIncrement}
        disabled={incrementDisabled}
        aria-label="Aumentar cantidad"
        className={[
          styles.button,
          "flex items-center justify-center text-charcoal-600 hover:text-charcoal-900 hover:bg-cream-100 transition-colors duration-200",
          incrementDisabled
            ? "opacity-30 cursor-not-allowed hover:bg-transparent hover:text-charcoal-600"
            : "",
        ].join(" ")}
      >
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
            d="M12 4v16m8-8H4"
          />
        </svg>
      </button>
    </div>
  );
}
