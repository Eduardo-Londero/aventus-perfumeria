import type { MetadataRoute } from "next";
import { products } from "@/data/products";
import { brands } from "@/data/brands";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://aventusperfumeria.com.ar";

  const productUrls = products.map((product) => ({
    url: `${baseUrl}/perfumes/${product.slug}`,
    lastModified: new Date(product.createdAt),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const brandUrls = brands.map((brand) => ({
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
    "/checkout",
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: route === "" ? 1 : 0.7,
  }));

  return [...staticUrls, ...productUrls, ...brandUrls];
}
