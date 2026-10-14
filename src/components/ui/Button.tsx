"use client";

import { forwardRef, type ButtonHTMLAttributes, type AnchorHTMLAttributes, type ReactNode } from "react";
import Link from "next/link";

type Variant = "primary" | "secondary" | "gold";
type Size = "sm" | "md" | "lg";

interface BaseProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}

type ButtonAsButton = BaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof BaseProps> & {
    href?: never;
    as?: "button";
  };

type ButtonAsLink = BaseProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof BaseProps> & {
    href: string;
    as: "link";
  };

type ButtonProps = ButtonAsButton | ButtonAsLink;

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-charcoal-900 text-cream-50 hover:bg-charcoal-800 active:bg-charcoal-700 shadow-sm",
  secondary:
    "border border-charcoal-900 text-charcoal-900 hover:bg-charcoal-900 hover:text-cream-50 active:bg-charcoal-800 bg-transparent",
  gold: "bg-gold-600 text-white hover:bg-gold-700 active:bg-gold-800 shadow-sm",
};

const sizeStyles: Record<Size, string> = {
  sm: "px-4 py-2 text-xs tracking-widest uppercase",
  md: "px-8 py-3.5 text-sm tracking-widest uppercase",
  lg: "px-10 py-4 text-sm tracking-widest uppercase",
};

const baseStyles =
  "inline-flex items-center justify-center gap-2 font-medium transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none select-none";

/**
 * Botón reutilizable premium.
 * - `variant`: primary (negro), secondary (borde), gold (dorado)
 * - `size`: sm, md, lg
 * - `loading`: muestra spinner y deshabilita
 * - `as="link"`: renderiza como Next Link (requiere `href`)
 */
const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      loading = false,
      disabled = false,
      children,
      className = "",
      as = "button",
      ...rest
    },
    ref
  ) {
    const classes = [
      baseStyles,
      variantStyles[variant],
      sizeStyles[size],
      className,
    ].join(" ");

    if (as === "link") {
      const { href, ...linkRest } = rest as ButtonAsLink;
      return (
        <Link
          href={href}
          className={classes}
          ref={ref as React.Ref<HTMLAnchorElement>}
          {...(linkRest as Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof BaseProps>)}
        >
          {loading && <LoadingSpinner />}
          {children}
        </Link>
      );
    }

    const { ...buttonRest } = rest as ButtonAsButton;
    return (
      <button
        className={classes}
        disabled={disabled || loading}
        ref={ref as React.Ref<HTMLButtonElement>}
        {...(buttonRest as Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof BaseProps>)}
      >
        {loading && <LoadingSpinner />}
        {children}
      </button>
    );
  }
);

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
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
  );
}

export default Button;
