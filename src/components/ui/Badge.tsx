import type { ReactNode } from "react";

type Variant = "gold" | "red" | "green" | "black";

interface BadgeProps {
  variant?: Variant;
  children: ReactNode;
  className?: string;
  pulse?: boolean;
}

const variantStyles: Record<Variant, string> = {
  gold: "bg-gold-600 text-white",
  red: "bg-red-600 text-white",
  green: "bg-emerald-600 text-white",
  black: "bg-charcoal-900 text-cream-50",
};

/**
 * Badge compacto para etiquetas como "Nuevo", "Oferta", "-20%", etc.
 */
export default function Badge({
  variant = "gold",
  children,
  className = "",
  pulse = false,
}: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center justify-center px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider",
        variantStyles[variant],
        pulse ? "animate-pulse" : "",
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}
