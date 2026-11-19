import Link from "next/link";
import Image from "next/image";
import {
  countProductsByCategory,
  getStorefront,
  selectFeatured,
  selectNew,
  selectOnSale,
} from "@/lib/server/storefront";
import { selectVisibleBanners } from "@/lib/banners";
import { faqs } from "@/data/faqs";
import { siteConfig, generateWhatsAppUrl } from "@/config/site";
import CategoryCard from "@/components/products/CategoryCard";
import ProductGrid from "@/components/products/ProductGrid";
import Accordion from "@/components/ui/Accordion";

// ISR: el home se re-renderiza contra Supabase cada 30 segundos, así que lo
// que se ordene/desactive/edite en el panel se ve sin redeploy.
// Fuente única: src/lib/server/storefront.ts (con degradación a semilla).
export const revalidate = 30;

export default async function HomePage() {
  // Datos públicos: catálogo + secciones ACTIVAS tal como están en la base.
  // El orden y la activación los administra el panel en Inicio (home_sections);
  // los banners, en Banners (banners).
  const { products, categories, brands, sections, banners } =
    await getStorefront();
  const activeSections = sections;
  const featuredProducts = selectFeatured(products).slice(0, 8);
  const newProducts = selectNew(products).slice(0, 8);
  const saleProducts = selectOnSale(products).slice(0, 8);
  const faqItems = faqs.slice(0, 5).map((f) => ({
    question: f.question,
    answer: f.answer,
  }));

  // Helper para verificar si una sección está activa
  const isSectionActive = (type: string) => activeSections.some((s) => s.type === type);

  // Renderizar sección según tipo
  const renderSection = (type: string) => {
    switch (type) {
      case "hero":
        return (
          <section key="hero" className="relative h-[85vh] min-h-[600px] flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0">
              <Image
                src="https://images.unsplash.com/photo-1541643600914-78b084683601?w=1920&q=80"
                alt="Perfume de lujo"
                fill
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-b from-charcoal-950/60 via-charcoal-950/40 to-charcoal-950/70" />
            </div>

            <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
              <p className="text-xs tracking-widest2 uppercase text-gold-400 mb-6 animate-fade-in">
                Perfumería de autor
              </p>
              <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl text-white leading-tight mb-6 animate-slide-up">
                Descubrí tu próxima{" "}
                <span className="italic text-gold-300">fragancia</span>
              </h1>
              <p className="text-lg text-white/80 max-w-2xl mx-auto mb-10 animate-slide-up">
                Una selección exclusiva de perfumes originales para quienes buscan
                un aroma que los represente.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up">
                <Link href="/perfumes" className="btn-gold">
                  Ver perfumes
                </Link>
                <a
                  href={generateWhatsAppUrl(siteConfig.whatsapp.message)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-8 py-3.5 border border-white/30 text-white text-sm font-medium tracking-widest uppercase hover:bg-white hover:text-charcoal-900 transition-all duration-300"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Hablar por WhatsApp
                </a>
              </div>
            </div>

            {/* Scroll indicator */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
              <svg
                className="w-6 h-6 text-white/60"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 14l-7 7m0 0l-7-7m7 7V3"
                />
              </svg>
            </div>
          </section>
        );

      case "categories":
        return (
          <section key="categories" className="py-20 bg-cream-50">
            <div className="container-aventus">
              <div className="text-center mb-12">
                <p className="section-subtitle mb-3">Explorá</p>
                <h2 className="section-title">Categorías</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {categories.map((category) => (
                  <CategoryCard
                    key={category.id}
                    category={category}
                    count={countProductsByCategory(products, category.id)}
                  />
                ))}
              </div>
            </div>
          </section>
        );

      case "featured":
        return (
          <section key="featured" className="py-20 bg-white">
            <div className="container-aventus">
              <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-12 gap-4">
                <div>
                  <p className="section-subtitle mb-3">Selección especial</p>
                  <h2 className="section-title">Productos destacados</h2>
                </div>
                <Link
                  href="/perfumes"
                  className="text-sm font-medium tracking-wide text-gold-600 hover:text-gold-700 transition-colors flex items-center gap-2"
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
              <ProductGrid products={featuredProducts} columns={4} />
            </div>
          </section>
        );

      case "offers":
        return (
          <section key="offers" className="py-20 bg-cream-50">
            <div className="container-aventus">
              <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-12 gap-4">
                <div>
                  <p className="section-subtitle mb-3">Precios especiales</p>
                  <h2 className="section-title">Ofertas</h2>
                </div>
                <Link
                  href="/ofertas"
                  className="text-sm font-medium tracking-wide text-gold-600 hover:text-gold-700 transition-colors flex items-center gap-2"
                >
                  Ver todas
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
              <ProductGrid products={saleProducts} columns={4} />
            </div>
          </section>
        );

      case "newArrivals":
        return (
          <section key="newArrivals" className="py-20 bg-white">
            <div className="container-aventus">
              <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-12 gap-4">
                <div>
                  <p className="section-subtitle mb-3">Recién llegados</p>
                  <h2 className="section-title">Nuevos ingresos</h2>
                </div>
                <Link
                  href="/perfumes"
                  className="text-sm font-medium tracking-wide text-gold-600 hover:text-gold-700 transition-colors flex items-center gap-2"
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
              <ProductGrid products={newProducts} columns={4} />
            </div>
          </section>
        );

      case "brands":
        return (
          <section key="brands" className="py-20 bg-cream-50">
            <div className="container-aventus">
              <div className="text-center mb-12">
                <p className="section-subtitle mb-3">Marcas exclusivas</p>
                <h2 className="section-title">Nuestras marcas</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {brands
                  .filter((brand) => brand.isActive)
                  .sort((a, b) => a.order - b.order)
                  .map((brand) => (
                    <Link
                      key={brand.id}
                      href={`/marcas/${brand.slug}`}
                      className="group flex items-center justify-center gap-3 p-4 bg-white border border-charcoal-100 hover:border-gold-500 transition-colors"
                    >
                      <span className="font-serif text-lg text-charcoal-900 group-hover:text-gold-700 transition-colors">
                        {brand.name}
                      </span>
                    </Link>
                  ))}
              </div>
            </div>
          </section>
        );

      case "about":
        return (
          <section key="about" className="py-20 bg-cream-50">
            <div className="container-aventus">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                <div>
                  <p className="section-subtitle mb-3">Nuestra historia</p>
                  <h2 className="section-title mb-6">Sobre Aventus</h2>
                  <div className="space-y-4 text-charcoal-600 leading-relaxed">
                    <p>
                      Aventus Perfumería nació de la pasión por las fragancias y el
                      deseo de acercar a cada persona el perfume perfecto. Creemos
                      que un aroma es más que un accesorio: es una declaración de
                      identidad, un recuerdo, una firma personal.
                    </p>
                    <p>
                      Trabajamos con las marcas más exclusivas del mundo y
                      seleccionamos cada fragancia con cuidado para ofrecerte una
                      colección curada, original y de la más alta calidad.
                    </p>
                    <p>
                      Nuestro equipo de asesores está disponible para ayudarte a
                      encontrar tu fragancia ideal, ya sea en nuestro local o a
                      través de WhatsApp.
                    </p>
                  </div>
                </div>
                <div className="relative aspect-[4/5] overflow-hidden">
                  <Image
                    src="https://images.unsplash.com/photo-1594035910387-fea47794261f?w=800&q=80"
                    alt="Aventus Perfumería"
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
            </div>
          </section>
        );

      case "instagram":
        return (
          <section key="instagram" className="relative py-24 overflow-hidden">
            <div className="absolute inset-0">
              <Image
                src="https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=1920&q=80"
                alt="Instagram"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-charcoal-950/70" />
            </div>
            <div className="relative z-10 text-center px-4">
              <svg
                className="w-12 h-12 text-gold-400 mx-auto mb-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-4 0v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"
                />
                <circle cx="4" cy="4" r="2" />
              </svg>
              <h2 className="font-serif text-4xl sm:text-5xl text-white mb-4">
                Seguinos en Instagram
              </h2>
              <p className="text-white/80 max-w-xl mx-auto mb-8">
                {siteConfig.instagram.username} — Novedades, ofertas exclusivas y
                contenido de perfumería.
              </p>
              <a
                href={siteConfig.instagram.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-gold"
              >
                Seguir en Instagram
              </a>
            </div>
          </section>
        );

      case "contact":
        return (
          <section key="contact" className="py-20 bg-charcoal-950 text-cream-50">
            <div className="container-aventus">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                <div>
                  <p className="text-xs tracking-widest2 uppercase text-gold-400 mb-3">
                    Visitanos
                  </p>
                  <h2 className="font-serif text-4xl sm:text-5xl mb-6">
                    Visitá nuestro local
                  </h2>
                  <p className="text-cream-50/70 leading-relaxed mb-8">
                    Te invitamos a conocer nuestro espacio, donde podrás probar
                    nuestras fragancias y recibir asesoramiento personalizado.
                  </p>

                  <div className="space-y-4 mb-8">
                    <div className="flex items-start gap-4">
                      <svg
                        className="w-5 h-5 text-gold-400 mt-0.5 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      <div>
                        <p className="font-medium">Dirección</p>
                        <p className="text-sm text-cream-50/60">
                          {siteConfig.store.address}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <svg
                        className="w-5 h-5 text-gold-400 mt-0.5 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <div>
                        <p className="font-medium">Horarios</p>
                        <div className="text-sm text-cream-50/60 space-y-1">
                          {siteConfig.store.hours.map((h, i) => (
                            <p key={i}>
                              {h.days}: {h.hours}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <a
                    href={siteConfig.store.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-gold"
                  >
                    Cómo llegar
                  </a>
                </div>

                <div className="relative aspect-square overflow-hidden">
                  <Image
                    src="https://images.unsplash.com/photo-1587017539504-67cfbddac569?w=800&q=80"
                    alt="Nuestro local"
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
            </div>
          </section>
        );

      case "banner": {
        // Banners del CMS: solo los ACTIVOS y VIGENTES hoy (el panel puede
        // programar fechas). Sin ninguno, la sección no deja hueco.
        const visibleBanners = selectVisibleBanners(banners);
        if (visibleBanners.length === 0) return null;

        return (
          <section key="banner" className="py-20 bg-charcoal-950">
            <div className="container-aventus">
              <div className="text-center mb-12">
                <p className="text-xs tracking-widest2 uppercase text-gold-400 mb-3">
                  Promociones
                </p>
                <h2 className="font-serif text-3xl sm:text-4xl text-white tracking-tight">
                  Lo nuevo de Aventus
                </h2>
              </div>

              {/* Carrusel con scroll-snap (sin JS): una fila que se desliza en
                  horizontal y se adapta a una, dos o tres tarjetas por pantalla. */}
              <div className="flex gap-6 overflow-x-auto snap-x snap-mandatory pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {visibleBanners.map((banner) => (
                  <article
                    key={banner.id}
                    className="group relative shrink-0 snap-start w-[85%] sm:w-[48%] lg:w-[32%] aspect-[4/3] overflow-hidden bg-charcoal-900"
                  >
                    {banner.image ? (
                      <Image
                        src={banner.image}
                        alt={banner.title}
                        fill
                        sizes="(max-width: 640px) 85vw, (max-width: 1024px) 48vw, 32vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950/90 via-charcoal-950/40 to-transparent" />

                    <div className="absolute inset-x-0 bottom-0 p-6">
                      <h3 className="font-serif text-2xl text-white leading-snug">
                        {banner.title}
                      </h3>
                      {banner.subtitle ? (
                        <p className="mt-1 text-sm text-white/80">
                          {banner.subtitle}
                        </p>
                      ) : null}
                      {banner.buttonText && banner.buttonLink ? (
                        <Link
                          href={banner.buttonLink}
                          className="mt-4 inline-block text-xs tracking-widest uppercase text-gold-400 border-b border-gold-400/60 pb-1 hover:text-gold-300 hover:border-gold-300 transition-colors"
                        >
                          {banner.buttonText}
                        </Link>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div>
      {/* Renderizar secciones según configuración del admin */}
      {activeSections.map((section) => renderSection(section.type))}

      {/* FAQ - siempre visible */}
      <section className="py-20 bg-cream-50">
        <div className="container-aventus max-w-3xl">
          <div className="text-center mb-12">
            <p className="section-subtitle mb-3">¿Tenés dudas?</p>
            <h2 className="section-title">Preguntas frecuentes</h2>
          </div>
          <Accordion items={faqItems} />
          <div className="text-center mt-8">
            <Link
              href="/faq"
              className="text-sm font-medium tracking-wide text-gold-600 hover:text-gold-700 transition-colors"
            >
              Ver todas las preguntas frecuentes →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
