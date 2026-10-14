import type { Metadata } from "next";

export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getProductBySlug, getAllProducts, getBrandById } from "@/lib/seed";
import ProductGallery from "@/components/products/ProductGallery";
import ProductInfo from "@/components/products/ProductInfo";
import ProductGrid from "@/components/products/ProductGrid";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) {
    return {
      title: "Producto no encontrado | Aventus Perfumería",
    };
  }

  const brand = getBrandById(product.brand);

  return {
    title: `${product.name} ${brand?.name || product.brand} | Aventus Perfumería`,
    description: product.description,
    openGraph: {
      title: `${product.name} ${brand?.name || product.brand} | Aventus Perfumería`,
      description: product.description,
      images: product.images,
      type: "website",
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  // Obtener productos relacionados desde los datos iniciales compartidos
  const relatedProducts = getAllProducts()
    .filter((p) => p.id !== product.id && p.isActive)
    .filter((p) => 
      p.brand === product.brand ||
      p.olfactoryFamily === product.olfactoryFamily ||
      p.categories.some((c) => product.categories.includes(c))
    )
    .slice(0, 4);

  return (
    <div className="bg-cream-50 min-h-screen">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-charcoal-100">
        <div className="container-aventus py-4">
          <nav className="flex items-center gap-2 text-sm text-charcoal-500">
            <Link href="/" className="hover:text-charcoal-900 transition-colors">
              Inicio
            </Link>
            <span>/</span>
            <Link
              href="/perfumes"
              className="hover:text-charcoal-900 transition-colors"
            >
              Perfumes
            </Link>
            <span>/</span>
            <Link
              href={`/perfumes?categoria=${product.categories[0] || ""}`}
              className="hover:text-charcoal-900 transition-colors capitalize"
            >
              {product.categories[0] === "hombre" ? "Hombre" : product.categories[0] === "mujer" ? "Mujer" : product.categories[0] === "unisex" ? "Unisex" : product.categories[0]}
            </Link>
            <span>/</span>
            <span className="text-charcoal-900">{product.name}</span>
          </nav>
        </div>
      </div>

      {/* Product Detail */}
      <div className="container-aventus py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
          {/* Gallery */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <ProductGallery images={product.images} productName={product.name} />
          </div>

          {/* Info */}
          <div>
            <ProductInfo product={product} />
          </div>
        </div>
      </div>

      {/* Description & Notes */}
      <div className="bg-white py-16">
        <div className="container-aventus">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            {/* Description */}
            <div>
              <p className="section-subtitle mb-3">Descripción</p>
              <h2 className="section-title mb-6">Sobre esta fragancia</h2>
              <p className="text-charcoal-600 leading-relaxed text-lg">
                {product.longDescription || product.description}
              </p>
            </div>

            {/* Olfactory Notes */}
            <div>
              <p className="section-subtitle mb-3">Notas olfativas</p>
              <h2 className="section-title mb-6">Pirámide olfativa</h2>

              <div className="space-y-6">
                {/* Top Notes */}
                <div className="border border-charcoal-100 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="w-10 h-10 bg-gold-100 text-gold-700 flex items-center justify-center">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M5 15l7-7 7 7"
                        />
                      </svg>
                    </span>
                    <div>
                      <h3 className="font-serif text-lg text-charcoal-900">
                        Salida
                      </h3>
                      <p className="text-xs text-charcoal-500">
                        Primeras impresiones
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {product.notes.top.map((note, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 bg-cream-100 text-sm text-charcoal-700"
                      >
                        {note}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Heart Notes */}
                <div className="border border-charcoal-100 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="w-10 h-10 bg-gold-100 text-gold-700 flex items-center justify-center">
                      <svg
                        className="w-5 h-5"
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
                    </span>
                    <div>
                      <h3 className="font-serif text-lg text-charcoal-900">
                        Corazón
                      </h3>
                      <p className="text-xs text-charcoal-500">
                        El alma de la fragancia
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {product.notes.heart.map((note, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 bg-cream-100 text-sm text-charcoal-700"
                      >
                        {note}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Base Notes */}
                <div className="border border-charcoal-100 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="w-10 h-10 bg-gold-100 text-gold-700 flex items-center justify-center">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </span>
                    <div>
                      <h3 className="font-serif text-lg text-charcoal-900">
                        Fondo
                      </h3>
                      <p className="text-xs text-charcoal-500">
                        La estela que permanece
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {product.notes.base.map((note, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 bg-cream-100 text-sm text-charcoal-700"
                      >
                        {note}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Info */}
      <div className="py-16 bg-cream-50">
        <div className="container-aventus">
          <p className="section-subtitle mb-3">Detalles</p>
          <h2 className="section-title mb-8">Información adicional</h2>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {[
              { label: "Marca", value: product.brand },
              { label: "Concentración", value: product.concentration },
              { label: "Tamaño", value: product.size },
              { label: "Género", value: product.gender },
              { label: "Familia olfativa", value: product.olfactoryFamily },
              {
                label: "Disponibilidad",
                value:
                  product.stock > 0
                    ? `En stock (${product.stock})`
                    : "Sin stock",
              },
            ].map((item, i) => (
              <div key={i} className="bg-white p-4 border border-charcoal-100">
                <p className="text-xs text-charcoal-500 mb-1">{item.label}</p>
                <p className="text-sm font-medium text-charcoal-900">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <div className="py-16 bg-white">
          <div className="container-aventus">
            <div className="flex items-end justify-between mb-10">
              <div>
                <p className="section-subtitle mb-3">También te puede gustar</p>
                <h2 className="section-title">Productos relacionados</h2>
              </div>
              <Link
                href="/perfumes"
                className="hidden sm:flex items-center gap-2 text-sm font-medium text-gold-600 hover:text-gold-700 transition-colors"
              >
                Ver todos
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </Link>
            </div>
            <ProductGrid products={relatedProducts} columns={4} />
          </div>
        </div>
      )}
    </div>
  );
}
