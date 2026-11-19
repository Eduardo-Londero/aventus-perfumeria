import type { MetadataRoute } from "next";
import { getStorefront } from "@/lib/server/storefront";

// ISR 30 s: el sitemap sigue el catálogo real (altas/bajas de productos).
export const revalidate = 30;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://aventusperfumeria.com.ar";
  const { products, brands } = await getStorefront();

  const productUrls = products
    .filter((product) => product.isActive)
    .map((product) => ({
      url: `${baseUrl}/perfumes/${product.slug}`,
      lastModified: new Date(product.createdAt),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

  const brandUrls = brands
    .filter((brand) => brand.isActive)
    .map((brand) => ({
      url: `${baseUrl}/marcas/${brand.slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }));

  const staticUrls = [
    "",
    "/perfumes",
    "/marcas",
    "/ofertas",
    "/faq",
    "/nosotros",
    "/contacto",
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: route === "" ? 1 : 0.7,
  }));

  return [...staticUrls, ...productUrls, ...brandUrls];
}
