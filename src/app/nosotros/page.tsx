import type { Metadata } from "next";
import Image from "next/image";
import { siteConfig } from "@/config/site";
import WhatsAppButton from "@/components/layout/WhatsAppButton";

export const metadata: Metadata = {
  title: "Nosotros | Aventus Perfumería",
  description:
    "Conocé nuestra historia y propuesta. Perfumes originales con atención personalizada.",
};

const values = [
  {
    title: "Selección de fragancias",
    description:
      "Curaduría cuidada de las mejores marcas del mundo para ofrecerte una colección única.",
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    title: "Atención personalizada",
    description:
      "Te asesoramos para encontrar el perfume perfecto para cada ocasión y personalidad.",
    icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  },
  {
    title: "Compra online",
    description:
      "Pedí tus favoritos desde donde estés y recibilos en tu domicilio o retirá en nuestro local.",
    icon: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z",
  },
  {
    title: "Atención presencial",
    description:
      "Visitá nuestro local y probá las fragancias con la guía de nuestros expertos.",
    icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  },
  {
    title: "Asesoramiento",
    description:
      "Te ayudamos a descubrir notas, familias olfativas y el aroma ideal para vos.",
    icon: "M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
];

export default function NosotrosPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative h-[60vh] min-h-[400px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1541643600914-78b084683601?w=1920&q=80"
            alt="Sobre Aventus Perfumería"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-charcoal-950/60 via-charcoal-950/40 to-charcoal-950/70" />
        </div>
        <div className="relative z-10 text-center px-4 max-w-3xl mx-auto">
          <p className="text-xs tracking-widest2 uppercase text-gold-400 mb-4">
            Sobre nosotros
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-white leading-tight mb-4">
            Sobre Aventus
          </h1>
          <p className="text-lg text-white/80 max-w-2xl mx-auto">
            {siteConfig.tagline}
          </p>
        </div>
      </section>

      {/* Historia */}
      <section className="py-20 bg-cream-50">
        <div className="container-aventus">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="section-subtitle mb-3">Nuestra historia</p>
              <h2 className="section-title mb-6">
                Una pasión por las fragancias
              </h2>
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
            <div className="relative aspect-[4/5] overflow-hidden rounded-lg">
              <Image
                src="https://images.unsplash.com/photo-1594035910387-fea47794261f?w=800&q=80"
                alt="Nuestra historia"
                fill
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Nuestra propuesta */}
      <section className="py-20 bg-white">
        <div className="container-aventus">
          <div className="text-center mb-16">
            <p className="section-subtitle mb-3">Qué nos hace únicos</p>
            <h2 className="section-title">Nuestra propuesta</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {values.map((value) => (
              <div
                key={value.title}
                className="text-center p-8 border border-charcoal-100 rounded-lg hover:shadow-lg transition-shadow duration-300"
              >
                <div className="w-16 h-16 bg-gold-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg
                    className="w-8 h-8 text-gold-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d={value.icon}
                    />
                  </svg>
                </div>
                <h3 className="font-serif text-xl text-charcoal-900 mb-3">
                  {value.title}
                </h3>
                <p className="text-sm text-charcoal-600 leading-relaxed">
                  {value.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Local físico */}
      <section className="py-20 bg-charcoal-950 text-cream-50">
        <div className="container-aventus">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="relative aspect-square overflow-hidden rounded-lg">
              <Image
                src="https://images.unsplash.com/photo-1587017539504-67cfbddac569?w=800&q=80"
                alt="Nuestro local"
                fill
                className="object-cover"
              />
            </div>
            <div>
              <p className="text-xs tracking-widest2 uppercase text-gold-400 mb-3">
                Visitanos
              </p>
              <h2 className="font-serif text-4xl sm:text-5xl mb-6">
                Nuestro local
              </h2>
              <p className="text-cream-50/70 leading-relaxed mb-8">
                Te invitamos a conocer nuestro espacio, donde podrás probar
                nuestras fragancias y recibir asesoramiento personalizado.
              </p>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <svg
                    className="w-6 h-6 text-gold-400 mt-0.5 flex-shrink-0"
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
                    className="w-6 h-6 text-gold-400 mt-0.5 flex-shrink-0"
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
                      {siteConfig.store.hours.map((h) => (
                        <p key={h.days}>
                          {h.days}: {h.hours}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <svg
                    className="w-6 h-6 text-emerald-400 mt-0.5 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  <div>
                    <p className="font-medium">WhatsApp</p>
                    <p className="text-sm text-cream-50/60">
                      {siteConfig.whatsapp.number}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <svg
                    className="w-6 h-6 text-gold-400 mt-0.5 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                  <div>
                    <p className="font-medium">Instagram</p>
                    <p className="text-sm text-cream-50/60">
                      {siteConfig.instagram.username}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 mt-8">
                <a
                  href={siteConfig.store.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-gold"
                >
                  Cómo llegar
                </a>
                <a
                  href={`https://wa.me/${siteConfig.whatsapp.number}?text=${encodeURIComponent(siteConfig.whatsapp.message)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-outline"
                >
                  Contactar
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
