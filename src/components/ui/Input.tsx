"use client";

import { forwardRef, type InputHTMLAttributes } from "react";

type Variant = "default" | "search";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  error?: string;
  required?: boolean;
  variant?: Variant;
  helperText?: string;
}

/**
 * Input reutilizable con estilo premium.
 * - `variant`: default | search (con ícono de lupa integrado)
 * - Muestra label, error y texto de ayuda opcionales
 */
const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    error,
    required = false,
    variant = "default",
    helperText,
    className = "",
    id,
    ...rest
  },
  ref
) {
  const inputId = id || `input-${label?.toLowerCase().replace(/\s+/g, "-") || Math.random().toString(36).slice(2, 9)}`;

  const baseInputStyles =
    "w-full px-4 py-3 bg-white border text-charcoal-900 placeholder-charcoal-400 focus:outline-none focus:border-gold-500 focus:ring-1 focus:ring-gold-500 transition-all duration-200 text-sm";

  const borderStyles = error
    ? "border-red-500 focus:border-red-500 focus:ring-red-500"
    : "border-charcoal-200 hover:border-charcoal-300";

  const searchStyles =
    "pl-11 pr-4 py-3 bg-white border border-charcoal-200 text-charcoal-900 placeholder-charcoal-400 focus:outline-none focus:border-gold-500 focus:ring-1 focus:ring-gold-500 transition-all duration-200 text-sm rounded-full";

  const inputClasses =
    variant === "search"
      ? searchStyles
      : `${baseInputStyles} ${borderStyles}`;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-medium tracking-widest uppercase text-charcoal-600 mb-2"
        >
          {label}
          {required && (
            <span className="text-gold-600 ml-1" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      <div className="relative">
        {variant === "search" && (
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-charcoal-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          required={required}
          className={`${inputClasses} ${className} ${
            error ? "animate-pulse-once" : ""
          }`}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={
            error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
          }
          {...rest}
        />
      </div>
      {error && (
        <p
          id={`${inputId}-error`}
          className="mt-1.5 text-xs text-red-600 flex items-center gap-1"
          role="alert"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3.5 w-3.5 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {error}
        </p>
      )}
      {!error && helperText && (
        <p id={`${inputId}-helper`} className="mt-1.5 text-xs text-charcoal-500">
          {helperText}
        </p>
      )}
    </div>
  );
});

export default Input;
