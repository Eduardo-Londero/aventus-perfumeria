/**
 * Datos iniciales (semilla) — SEGURO PARA SERVIDOR Y NAVEGADOR
 * ==============================================================
 * Módulo de SOLO LECTURA, puro, sin dependencias de `window` ni `localStorage`.
 * Su propósito es que las páginas renderizadas en el servidor (Server
 * Components) puedan mostrar productos, marcas, categorías y secciones del
 * home con datos reales del proyecto.
 *
 * IMPORTANTE:
 * - Este módulo NO lee ni escribe datos personalizados del usuario.
 * - ES LA SEMILLA: datos iniciales y fuente de RESPALDO. Las páginas
 *   públicas ya NO leen de acá directamente: usan
 *   src/lib/server/storefront.ts, que consulta Supabase (o degrada a esta
 *   semilla si el backend es `localStorage` o si la consulta falla).
 * - Las pantallas que siguen atadas a la semilla son las que aún no tienen
 *   tabla remota (p. ej. contadores aislados); cualquier pantalla nueva debe
 *   pasar por storefront.ts o por src/lib/db.ts.
 * - No importar nada que use `localStorage` en el grafo de este módulo:
 *   storefront.ts lo importa en el servidor.
 */

import { products } from "@/data/products";
import { brands } from "@/data/brands";
import type { Product, Brand, Category, Gender } from "@/types";
import type { Banner, HomepageSection } from "@/types/cms";

// Reutilizamos los datos reales que ya existen en el proyecto.
export const seedProducts: Product[] = products;
export const seedBrands: Brand[] = brands;

/**
 * Categorías iniciales.
 * Se replican aquí los mismos IDs que se persisten en `localStorage` por
 * `initializeDatabase()` (db.ts): los productos referencian "hombre",
 * "mujer", "unisex", "nuevos-ingresos" y "ofertas".
 * NOTA: `src/data/categories.ts` usa IDs distintos ("1", "2", ...) y por eso
 * no se utiliza como fuente.
 */
export const seedCategories: Category[] = [
  {
    id: "hombre",
    slug: "hombre",
    name: "Hombre",
    description: "Fragancias masculinas",
    image: "https://images.unsplash.com/photo-1594035910387-fea47794261f?w=800&q=80",
    isActive: true,
    order: 1,
  },
  {
    id: "mujer",
    slug: "mujer",
    name: "Mujer",
    description: "Fragancias femeninas",
    image: "https://images.unsplash.com/photo-1587017539504-67cfbddac569?w=800&q=80",
    isActive: true,
    order: 2,
  },
  {
    id: "unisex",
    slug: "unisex",
    name: "Unisex",
    description: "Fragancias para todos",
    image: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=800&q=80",
    isActive: true,
    order: 3,
  },
  {
    id: "nuevos-ingresos",
    slug: "nuevos-ingresos",
    name: "Nuevos ingresos",
    description: "Las últimas novedades en perfumería",
    image: "https://images.unsplash.com/photo-1541643600914-78b084683601?w=800&q=80",
    isActive: true,
    order: 4,
  },
  {
    id: "ofertas",
    slug: "ofertas",
    name: "Ofertas",
    description: "Aprovechá descuentos exclusivos",
    image: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=800&q=80",
    isActive: true,
    order: 5,
  },
];

/** Géneros iniciales (mismos IDs que persiste `initializeDatabase()`). */
export const seedGenders: Gender[] = [
  { id: "hombre", name: "Hombre", isActive: true },
  { id: "mujer", name: "Mujer", isActive: true },
  { id: "unisex", name: "Unisex", isActive: true },
];

/**
 * Secciones iniciales del home.
 * Mismas secciones y orden que `dbHomeSections.getDefaultSections()` (db.ts).
 */
export const seedHomeSections: HomepageSection[] = [
  { id: "1", type: "hero", title: "Hero principal", isActive: true, order: 1 },
  { id: "2", type: "categories", title: "Categorías", isActive: true, order: 2 },
  { id: "3", type: "featured", title: "Productos destacados", isActive: true, order: 3 },
  { id: "4", type: "offers", title: "Ofertas", isActive: true, order: 4 },
  { id: "5", type: "newArrivals", title: "Nuevos ingresos", isActive: true, order: 5 },
  { id: "6", type: "banner", title: "Banner promocional", isActive: true, order: 6 },
  { id: "7", type: "brands", title: "Marcas", isActive: false, order: 7 },
  { id: "8", type: "about", title: "Sobre Aventus", isActive: true, order: 8 },
  { id: "9", type: "instagram", title: "Instagram", isActive: true, order: 9 },
  { id: "10", type: "contact", title: "Contacto", isActive: true, order: 10 },
];

/**
 * Banners iniciales (semilla del CMS de banners).
 * Mismos banners y orden que `dbBanners.getDefaultBanners()` (db.ts).
 *
 * Se dejan INACTIVOS y sin fechas a propósito: son material de ejemplo, y
 * activarlos no debe cambiar la portada de quien acaba de desplegar. Desde
 * /admin/banners se encienden (y ahí sí aparecen en el home en ≤ 30 s).
 */
export const seedBanners: Banner[] = [
  {
    id: "1",
    title: "Nueva colección",
    subtitle: "Descubrí las últimas fragancias",
    image:
      "https://images.unsplash.com/photo-1541643600914-78b084683601?w=1920&q=80",
    buttonText: "Ver más",
    buttonLink: "/perfumes",
    startDate: "",
    endDate: "",
    isActive: false,
    order: 1,
    type: "collection",
  },
  {
    id: "2",
    title: "Envío gratis",
    subtitle: "En pedidos superiores a $50.000",
    image:
      "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=1920&q=80",
    buttonText: "Comprar ahora",
    buttonLink: "/perfumes",
    startDate: "",
    endDate: "",
    isActive: false,
    order: 2,
    type: "promotion",
  },
];

// ============================================================
// Productos
// ============================================================

export function getAllProducts(): Product[] {
  return seedProducts;
}

export function getActiveProducts(): Product[] {
  return seedProducts.filter((p) => p.isActive);
}

export function getProductBySlug(slug: string): Product | undefined {
  return seedProducts.find((p) => p.slug === slug);
}

export function getFeaturedProducts(): Product[] {
  return getActiveProducts().filter((p) => p.featured);
}

export function getNewProducts(): Product[] {
  return getActiveProducts().filter((p) => p.isNew);
}

export function getOnSaleProducts(): Product[] {
  return getActiveProducts().filter((p) => p.isOnSale);
}

export function getProductsByBrand(brandId: string): Product[] {
  return getActiveProducts().filter((p) => p.brand === brandId);
}

// ============================================================
// Marcas
// ============================================================

export function getAllBrands(): Brand[] {
  return seedBrands;
}

export function getActiveBrands(): Brand[] {
  return seedBrands.filter((b) => b.isActive);
}

export function getBrandById(id: string): Brand | undefined {
  return seedBrands.find((b) => b.id === id);
}

export function getBrandBySlug(slug: string): Brand | undefined {
  return seedBrands.find((b) => b.slug === slug);
}

export function getBrandProductCount(brandId: string): number {
  return getProductsByBrand(brandId).length;
}

// ============================================================
// Categorías
// ============================================================

export function getActiveCategories(): Category[] {
  return seedCategories
    .filter((c) => c.isActive)
    .sort((a, b) => a.order - b.order);
}

export function getCategoryProductCount(categoryId: string): number {
  return getActiveProducts().filter((p) =>
    p.categories.includes(categoryId)
  ).length;
}

// ============================================================
// Secciones del home
// ============================================================

export function getActiveHomeSections(): HomepageSection[] {
  return seedHomeSections
    .filter((s) => s.isActive)
    .sort((a, b) => a.order - b.order);
}
