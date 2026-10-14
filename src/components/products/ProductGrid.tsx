import type { Product } from "@/types";
import ProductCard from "./ProductCard";
import Skeleton from "@/components/ui/Skeleton";

interface ProductGridProps {
  products: Product[];
  loading?: boolean;
  columns?: 2 | 3 | 4;
  className?: string;
}

/**
 * Grid responsive de ProductCards.
 * - 2 cols mobile, 3 cols tablet, 4 cols desktop (por defecto)
 * - Muestra skeletons cuando loading=true
 */
export default function ProductGrid({
  products,
  loading = false,
  columns = 4,
  className = "",
}: ProductGridProps) {
  const gridColsClass = {
    2: "grid-cols-2",
    3: "grid-cols-2 md:grid-cols-3",
    4: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
  }[columns];

  if (loading) {
    return (
      <div className={`grid ${gridColsClass} gap-4 sm:gap-6 ${className}`}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white border border-cream-200 overflow-hidden">
            <Skeleton variant="rectangular" height={280} className="rounded-none" />
            <div className="p-4 space-y-3">
              <Skeleton variant="text" width="40%" height={12} />
              <Skeleton variant="text" width="80%" height={18} />
              <Skeleton variant="text" width="60%" height={14} />
              <Skeleton variant="rectangular" height={40} className="rounded-none" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-charcoal-500">No se encontraron productos.</p>
      </div>
    );
  }

  return (
    <div className={`grid ${gridColsClass} gap-4 sm:gap-6 ${className}`}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
