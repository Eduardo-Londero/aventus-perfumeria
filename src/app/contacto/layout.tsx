import type { Metadata } from "next";

/** Página pública de contacto: indexable. */
export const metadata: Metadata = {
  title: "Contacto | Aventus Perfumería",
  description:
    "Contactanos por WhatsApp, teléfono o formulario. Consultas sobre perfumes, envíos y retiros en el local.",
  robots: { index: true, follow: true },
};

export default function ContactoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
