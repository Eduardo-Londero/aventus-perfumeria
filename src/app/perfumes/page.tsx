import type { Metadata } from "next";
import { Suspense } from "react";
import PerfumesClient from "./PerfumesClient";
import { getStorefront, selectActive } from "@/lib/server/storefront";

// ISR 30 s: el catálogo del panel (precios, stock, altas, bajas) se refleja
// en ≤ 30 s sin redeploy. Fuente: src/lib/server/storefront.ts.
export const revalidate = 30;

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

export default async function PerfumesPage() {
  const { products, genders } = await getStorefront();

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-pulse text-charcoal-400">Cargando...</div>
        </div>
      }
    >
      <PerfumesClient products={selectActive(products)} genders={genders} />
    </Suspense>
  );
}
