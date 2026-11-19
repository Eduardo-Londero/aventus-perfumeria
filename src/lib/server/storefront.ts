/**
 * Contenido público de la tienda — Server Components (Fase D)
 * ===========================================================
 * UNA sola lectura por render para todas las páginas públicas: home,
 * /perfumes, /ofertas, /marcas y el detalle de producto.
 *
 * Reglas:
 *  1. Con `NEXT_PUBLIC_DATA_BACKEND=supabase` lee de Supabase (anon + RLS),
 *     así que un cambio hecho en el panel se refleja en la página sin redeploy
 *     (las páginas exportan `revalidate = 30`).
 *  2. Colección vacía → se conserva la SEMILLA (mismo criterio "si está vacío,
 *     sembrar" del driver de src/lib/dbDriver.ts): nunca se muestra una
 *     sección/catálogo en blanco por un remoto sin datos.
 *  3. Si Supabase falla (red, claves, RLS) se degrada a la semilla y se
 *     registra el error: la tienda nunca se cae por esto.
 *  4. Con el backend por defecto (`localStorage`, tests y E2E) siempre semilla.
 *
 * Este módulo es de SOLO SERVIDOR: no se importa desde componentes cliente.
 * La capa cliente (panel de administración) sigue usando src/lib/db.ts.
 */

import { IS_SUPABASE_BACKEND } from "@/lib/dataBackend";
import { fetchCatalog } from "@/lib/supabaseCatalog";
import {
  seedBrands,
  seedCategories,
  seedHomeSections,
  seedProducts,
} from "@/lib/seed";
import type { Brand, Category, Product } from "@/types";
import type { HomepageSection } from "@/types/cms";

/**
 * Segundos que cada página pública queda cacheada (ISR).
 * Es lo que define "cuánto tarda en verse un cambio del panel".
 */
export const STOREFRONT_REVALIDATE = 30;

export interface Storefront {
  /** Catálogo completo tal cual viene de la fuente (cada página filtra). */
  products: Product[];
  brands: Brand[];
  categories: Category[];
  /** Solo activas, ordenadas por `order`. */
  sections: HomepageSection[];
  /** Diagnóstico: de dónde salió todo (para tests/log, no se muestra). */
  source: "supabase" | "seed";
}

function byOrder<T extends { order: number }>(a: T, b: T): number {
  return a.order - b.order;
}

function activeSections(sections: HomepageSection[]): HomepageSection[] {
  return sections
    .filter((section) => section.isActive)
    .sort((a, b) => a.order - b.order);
}

function seedStorefront(): Storefront {
  return {
    products: seedProducts,
    brands: seedBrands,
    categories: seedCategories.filter((c) => c.isActive).sort(byOrder),
    sections: activeSections(seedHomeSections),
    source: "seed",
  };
}

/**
 * Lee todo lo que muestra la página pública. Nunca lanza: ante cualquier
 * problema devuelve la semilla local y deja el motivo en el log del servidor.
 */
export async function getStorefront(): Promise<Storefront> {
  if (!IS_SUPABASE_BACKEND) return seedStorefront();

  try {
    const catalog = await fetchCatalog();

    // Colección vacía → semilla de ESA colección (no de todas).
    const remoteSections = (catalog.homeSections ?? []).filter(
      (section) => section.isActive
    );

    return {
      products:
        catalog.products.length > 0 ? catalog.products : seedProducts,
      brands: catalog.brands.length > 0 ? catalog.brands : seedBrands,
      categories:
        catalog.categories.length > 0
          ? catalog.categories.filter((c) => c.isActive).sort(byOrder)
          : seedCategories.filter((c) => c.isActive).sort(byOrder),
      sections:
        remoteSections.length > 0
          ? remoteSections.sort((a, b) => a.order - b.order)
          : activeSections(seedHomeSections),
      source: "supabase",
    };
  } catch (error) {
    console.error(
      "[storefront] no se pudo leer Supabase; se usa la semilla local:",
      error instanceof Error ? error.message : String(error)
    );
    return seedStorefront();
  }
}

// ---------------------------------------------------------------------------
// Contadores por colección (antes vivían en src/lib/seed.ts, atados a la
// semilla): se calculan sobre la lista que la página ya cargó.
// ---------------------------------------------------------------------------

/** Productos activos de una categoría (`Product.categories` guarda los ids). */
export function countProductsByCategory(
  products: Product[],
  categoryId: string
): number {
  return products.filter(
    (p) => p.isActive && p.categories.includes(categoryId)
  ).length;
}

/** Productos activos de una marca (`Product.brand` guarda el id). */
export function countProductsByBrand(
  products: Product[],
  brandId: string
): number {
  return products.filter((p) => p.isActive && p.brand === brandId).length;
}

/** Subconjuntos que antes traían los helpers de src/lib/seed.ts. */
export const selectFeatured = (products: Product[]): Product[] =>
  products.filter((p) => p.isActive && p.featured);

export const selectNew = (products: Product[]): Product[] =>
  products.filter((p) => p.isActive && p.isNew);

export const selectOnSale = (products: Product[]): Product[] =>
  products.filter((p) => p.isActive && p.isOnSale);

export const selectActive = (products: Product[]): Product[] =>
  products.filter((p) => p.isActive);
