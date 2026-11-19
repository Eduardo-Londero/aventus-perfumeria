import type { Metadata } from "next";
import Link from "next/link";
import { getStorefront, selectOnSale } from "@/lib/server/storefront";
import ProductGrid from "@/components/products/ProductGrid";

// ISR 30 s: las ofertas del panel se ven sin redeploy (ver storefront.ts).
export const revalidate = 30;

export const metadata: Metadata = {
  title: "Ofertas | Aventus Perfumería",
  description:
    "Aprovechá nuestras ofertas exclusivas en perfumes originales. Descuentos especiales en las mejores marcas.",
  openGraph: {
    title: "Ofertas | Aventus Perfumería",
    description:
      "Aprovechá nuestras ofertas exclusivas en perfumes originales.",
  },
};

export default async function OfertasPage() {
  const { products } = await getStorefront();
  const saleProducts = selectOnSale(products);

  return (
    <div className="bg-cream-50 min-h-screen">
      {/* Header */}
      <div className="bg-charcoal-950 text-cream-50 py-16">
        <div className="container-aventus">
          <p className="text-xs tracking-widest2 uppercase text-gold-400 mb-3">
            Precios especiales
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl mb-4">Ofertas</h1>
          <p className="text-cream-50/70 max-w-2xl">
            Aprovechá descuentos exclusivos en una selección de nuestras
            fragancias más populares. ¡Por tiempo limitado!
          </p>
        </div>
      </div>

      {/* Products */}
      <div className="container-aventus py-16">
        {saleProducts.length > 0 ? (
          <>
            <div className="flex items-center justify-between mb-10">
              <p className="text-charcoal-600">
                <span className="font-medium text-charcoal-900">
                  {saleProducts.length}
                </span>{" "}
                {saleProducts.length === 1 ? "oferta disponible" : "ofertas disponibles"}
              </p>
            </div>
            <ProductGrid products={saleProducts} columns={4} />
          </>
        ) : (
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
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
            <h2 className="font-serif text-2xl text-charcoal-900 mb-2">
              No hay ofertas activas
            </h2>
            <p className="text-charcoal-500 mb-6">
              Volvé pronto, estamos preparando nuevas promociones para vos.
            </p>
            <Link href="/perfumes" className="btn-primary">
              Ver todos los perfumes
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
