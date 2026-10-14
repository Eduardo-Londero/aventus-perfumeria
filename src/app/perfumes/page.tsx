import type { Metadata } from "next";
import { Suspense } from "react";
import PerfumesClient from "./PerfumesClient";

export const metadata: Metadata = {
  title: "Perfumes | Aventus Perfumería",
  description:
    "Explorá nuestra colección completa de perfumes originales. Fragancias de las mejores marcas: Dior, Chanel, Creed, Hermès y más.",
  openGraph: {
    title: "Perfumes | Aventus Perfumería",
    description:
      "Explorá nuestra colección completa de perfumes originales.",
  },
};

export default function PerfumesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-pulse text-charcoal-400">Cargando...</div>
        </div>
      }
    >
      <PerfumesClient />
    </Suspense>
  );
}
