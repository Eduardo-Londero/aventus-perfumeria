import type { Metadata } from "next";

// ISR 30 s: los cambios de marca/producto del panel se reflejan en ≤ 30 s.
export const revalidate = 30;
import { notFound } from "next/navigation";
import Image from "next/image";
import { getStorefront } from "@/lib/server/storefront";
import ProductGrid from "@/components/products/ProductGrid";

interface BrandPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Slugs a prerenderizar: sin esto Next ignora `revalidate` en el segmento y
 * cada visita a una marca consulta la base sin cache (ver comentario equivalente
 * en src/app/perfumes/[slug]/page.tsx).
 */
export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  try {
    const { brands } = await getStorefront();
    return brands
      .filter((brand) => brand.isActive)
      .map((brand) => ({ slug: brand.slug }));
  } catch (error) {
    console.error(
      "[marcas/[slug]] generateStaticParams sin catálogo:",
      error instanceof Error ? error.message : String(error)
    );
    return [];
  }
}

export async function generateMetadata({
  params,
}: BrandPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { brands } = await getStorefront();
  const brand = brands.find((b) => b.slug === slug);

  if (!brand) {
    // Mismo motivo que en perfumes/[slug]: el 404 tiene que salir de
    // `generateMetadata` para que el status sea 404 y no 200 (soft-404).
    notFound();
  }

  return {
    title: `${brand.name} | Aventus Perfumería`,
    description: brand.description,
    openGraph: {
      title: `${brand.name} | Aventus Perfumería`,
      description: brand.description,
      images: brand.image ? [brand.image] : [],
    },
  };
}

export default async function BrandPage({ params }: BrandPageProps) {
  const { slug } = await params;
  const { products, brands } = await getStorefront();
  const brand = brands.find((b) => b.slug === slug);

  if (!brand) {
    notFound();
  }

  // Productos ACTIVOS de la marca, desde la misma fuente que el resto de la tienda
  const brandProducts = products.filter(
    (p) => p.isActive && p.brand === brand.id
  );
  const otherBrands = brands
    .filter((b) => b.isActive && b.slug !== slug)
    .slice(0, 8);

  return (
    <div className="bg-cream-50 min-h-screen">
      {/* Hero */}
      <div className="relative h-[40vh] min-h-[300px] flex items-end overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src={brand.image || brand.logo || ""}
            alt={brand.name}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950/80 via-charcoal-950/40 to-charcoal-950/20" />
        </div>

        <div className="relative z-10 container-aventus pb-12">
          <p className="text-xs tracking-widest2 uppercase text-gold-400 mb-3">
            Marca
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-white mb-4">
            {brand.name}
          </h1>
          <p className="text-white/80 max-w-2xl text-lg">{brand.description}</p>
        </div>
      </div>

      {/* Products */}
      <div className="container-aventus py-16">
        <div className="flex items-center justify-between mb-10">
          <div>
            <p className="section-subtitle mb-2">Catálogo</p>
            <h2 className="font-serif text-2xl text-charcoal-900">
              {brandProducts.length}{" "}
              {brandProducts.length === 1 ? "producto" : "productos"}
            </h2>
          </div>
        </div>

        {brandProducts.length > 0 ? (
          <ProductGrid products={brandProducts} columns={4} />
        ) : (
          <div className="text-center py-20">
            <p className="text-charcoal-500">
              No hay productos disponibles de esta marca por el momento.
            </p>
          </div>
        )}
      </div>

      {/* Other Brands */}
      <div className="bg-white py-16">
        <div className="container-aventus">
          <p className="section-subtitle mb-3">Seguir explorando</p>
          <h2 className="section-title mb-10">Otras marcas</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {otherBrands
              .map((b) => (
                <a
                  key={b.id}
                  href={`/marcas/${b.slug}`}
                  className="group flex items-center gap-4 p-4 border border-charcoal-100 hover:border-gold-500 transition-colors"
                >
                  <div className="relative w-12 h-12 bg-cream-100 overflow-hidden flex-shrink-0">
                    <Image
                      src={b.logo || b.image || ""}
                      alt={b.name}
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  </div>
                  <span className="font-serif text-sm text-charcoal-900 group-hover:text-gold-700 transition-colors">
                    {b.name}
                  </span>
                </a>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
