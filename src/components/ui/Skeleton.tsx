type Variant = "rectangular" | "circular" | "text";

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  variant?: Variant;
  className?: string;
  count?: number;
}

function formatSize(size: string | number | undefined, defaultVal: string): string {
  if (size === undefined) return defaultVal;
  return typeof size === "number" ? `${size}px` : size;
}

/**
 * Placeholder de carga con animación pulse.
 * - variant: rectangular | circular | text
 * - count: cantidad de líneas de texto (solo para variant="text")
 */
export default function Skeleton({
  width,
  height,
  variant = "rectangular",
  className = "",
  count = 1,
}: SkeletonProps) {
  if (variant === "text") {
    return (
      <div className={`space-y-2 ${className}`} aria-busy="true" aria-live="polite">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="h-3 bg-charcoal-200/60 rounded animate-pulse"
            style={{
              width: formatSize(width, "100%"),
              opacity: 1 - i * 0.2,
            }}
          />
        ))}
      </div>
    );
  }

  if (variant === "circular") {
    const size = formatSize(width || height, "48px");
    return (
      <div
        className={`rounded-full bg-charcoal-200/60 animate-pulse ${className}`}
        style={{ width: size, height: size }}
        aria-busy="true"
        aria-live="polite"
      />
    );
  }

  return (
    <div
      className={`bg-charcoal-200/60 rounded animate-pulse ${className}`}
      style={{
        width: formatSize(width, "100%"),
        height: formatSize(height, "16px"),
      }}
      aria-busy="true"
      aria-live="polite"
    />
  );
}
