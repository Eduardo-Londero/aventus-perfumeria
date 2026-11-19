import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  countProductsByBrand,
  getStorefront,
} from "@/lib/server/storefront";

// ISR 30 s: altas/bajas de marcas hechas en el panel se reflejan solas.
export const revalidate = 30;

export const metadata: Metadata = {
  title: "Marcas | Aventus Perfumería",
  description:
    "Conocé las marcas de perfumería más exclusivas: Dior, Chanel, Creed, Hermès, Versace y más.",
  openGraph: {
    title: "Marcas | Aventus Perfumería",
    description:
      "Conocé las marcas de perfumería más exclusivas: Dior, Chanel, Creed, Hermès, Versace y más.",
  },
};

export default async function MarcasPage() {
  const { products, brands } = await getStorefront();
  const activeBrands = brands
    .filter((brand) => brand.isActive)
    .sort((a, b) => a.order - b.order);

  return (
    <div className="bg-cream-50 min-h-screen">
      {/* Header */}
      <div className="bg-charcoal-950 text-cream-50 py-16">
        <div className="container-aventus">
          <p className="text-xs tracking-widest2 uppercase text-gold-400 mb-3">
            Nuestras marcas
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl mb-4">Marcas</h1>
          <p className="text-cream-50/70 max-w-2xl">
            Trabajamos con las casas de perfumería más prestigiosas del mundo
            para ofrecerte una selección exclusiva y original.
          </p>
        </div>
      </div>

      {/* Brands Grid */}
      <div className="container-aventus py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {activeBrands.map((brand) => (
            <Link
              key={brand.id}
              href={`/marcas/${brand.slug}`}
              className="group bg-white border border-charcoal-100 overflow-hidden hover:shadow-lg transition-all duration-300"
            >
              {/* Image */}
              <div className="relative aspect-[16/10] overflow-hidden bg-cream-100">
                <Image
                  src={brand.image || brand.logo || ""}
                  alt={brand.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                  sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-charcoal-900/60 to-transparent" />
                <div className="absolute bottom-4 left-4">
                  <p className="text-xs tracking-widest2 uppercase text-gold-300">
                    {countProductsByBrand(products, brand.id)} productos
                  </p>
                </div>
              </div>

              {/* Info */}
              <div className="p-6">
                <h2 className="font-serif text-2xl text-charcoal-900 mb-2 group-hover:text-gold-700 transition-colors">
                  {brand.name}
                </h2>
                <p className="text-sm text-charcoal-600 line-clamp-2 mb-4">
                  {brand.description}
                </p>
                <span className="inline-flex items-center gap-2 text-xs font-medium tracking-widest uppercase text-gold-600 group-hover:text-gold-700 transition-colors">
                  Ver productos
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M17 8l4 4m0 0l-4 4m4-4H3"
                    />
                  </svg>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
