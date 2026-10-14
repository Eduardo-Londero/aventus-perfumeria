import type { Metadata } from "next";
import { faqs } from "@/data/faqs";
import Accordion from "@/components/ui/Accordion";

export const metadata: Metadata = {
  title: "Preguntas frecuentes | Aventus Perfumería",
  description:
    "Resolvé tus dudas sobre envíos, pagos, cambios, autenticidad de productos y más.",
  openGraph: {
    title: "Preguntas frecuentes | Aventus Perfumería",
    description:
      "Resolvé tus dudas sobre envíos, pagos, cambios, autenticidad de productos y más.",
  },
};

export default function FAQPage() {
  const faqItems = faqs.map((f) => ({
    question: f.question,
    answer: f.answer,
  }));

  return (
    <div className="bg-cream-50 min-h-screen">
      {/* Header */}
      <div className="bg-charcoal-950 text-cream-50 py-16">
        <div className="container-aventus">
          <p className="text-xs tracking-widest2 uppercase text-gold-400 mb-3">
            Ayuda
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl mb-4">
            Preguntas frecuentes
          </h1>
          <p className="text-cream-50/70 max-w-2xl">
            Encontrá respuestas a las dudas más comunes sobre nuestros
            productos, envíos, pagos y políticas.
          </p>
        </div>
      </div>

      {/* FAQ */}
      <div className="container-aventus py-16 max-w-3xl">
        <Accordion items={faqItems} />

        {/* Contact CTA */}
        <div className="mt-16 bg-charcoal-950 text-cream-50 p-10 text-center">
          <h2 className="font-serif text-2xl mb-3">¿No encontraste tu respuesta?</h2>
          <p className="text-cream-50/70 mb-6">
            Escribinos por WhatsApp y te ayudamos con cualquier consulta.
          </p>
          <a
            href="https://wa.me/5491123456789?text=Hola%20Aventus%20Perfumer%C3%ADa%2C%20tengo%20una%20consulta."
            target="_blank"
            rel="noopener noreferrer"
            className="btn-gold"
          >
            Contactar por WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
