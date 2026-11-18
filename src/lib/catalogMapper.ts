/**
 * Mapeo de catálogo: filas Supabase → tipos de la aplicación
 * ===========================================================
 * Fase C-1. Puro y sin I/O: traduce el esquema de 0001 (snake_case, importes
 * en CENTAVOS, relaciones por tabla `product_categories`) al modelo que ya
 * usan los componentes (`src/types`: precios en pesos enteros, `categories`
 * como arreglo de ids, `notes` anidado).
 *
 * Regla de conversión de importes: pesos = centavos / 100 (exacto: los precios
 * de la app siempre son enteros de pesos → centavos = pesos * 100).
 *
 * Campos del modelo de la app SIN columna en el esquema actual (se descartan
 * al leer y NO se persisten; ver informe P1.3.42 §brecha de esquema):
 *   - Category.parentId
 *   - Brand.logo / Brand.website (solo existe image_url)
 *   - HomepageSection (sin tabla: sigue en el backend local hasta Fase D)
 */

import type { Brand, Category, Gender, Product } from "@/types";

// ---------------------------------------------------------------------------
// Tipos de fila (alineados con supabase/migrations/20261016_0001_schema_core.sql)
// ---------------------------------------------------------------------------

export interface GenderRow {
  id: string;
  name: string;
  is_active: boolean;
}

export interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  order: number;
  is_active: boolean;
}

export interface BrandRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  order: number;
  is_active: boolean;
}

export interface ProductRow {
  id: string;
  slug: string;
  name: string;
  brand_id: string;
  gender_id: string;
  description: string | null;
  long_description: string | null;
  price_cents: number;
  previous_price_cents: number | null;
  discount: number | null;
  images: string[];
  size: string | null;
  concentration: string | null;
  olfactory_family: string | null;
  notes_top: string[];
  notes_heart: string[];
  notes_base: string[];
  stock: number;
  featured: boolean;
  is_active: boolean;
  is_on_sale: boolean;
  is_new: boolean;
  sold_count: number;
  created_at: string;
}

export interface ProductCategoryRow {
  product_id: string;
  category_id: string;
}

// ---------------------------------------------------------------------------
// Conversión de importes (centavos <-> pesos)
// ---------------------------------------------------------------------------

/** Centavos enteros → pesos argentinos enteros (1450000 ¢ → $145000). */
export function centsToArs(cents: number | null | undefined): number | undefined {
  if (cents === null || cents === undefined) return undefined;
  return Math.round(Number(cents) / 100);
}

/** Pesos enteros → centavos enteros ($145000 → 1450000 ¢). */
export function arsToCents(ars: number | null | undefined): number | null {
  if (ars === null || ars === undefined) return null;
  return Math.round(Number(ars) * 100);
}

// ---------------------------------------------------------------------------
// Fila → modelo de la app
// ---------------------------------------------------------------------------

export function genderRowToGender(row: GenderRow): Gender {
  return { id: row.id, name: row.name, isActive: row.is_active };
}

export function categoryRowToCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? "",
    image: row.image_url ?? "",
    isActive: row.is_active,
    order: row.order,
    // Sin columna en 0001: la app hoy tampoco usa parentId en la semilla.
  };
}

export function brandRowToBrand(row: BrandRow): Brand {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? undefined,
    image: row.image_url ?? undefined,
    isActive: row.is_active,
    order: row.order,
    // logo/website: sin columna en 0001 (brecha documentada en P1.3.42).
  };
}

/**
 * Convierte una fila de producto. `categoryIds` son los ids de categorías de
 * ESA fila (ya filtrados desde `product_categories`), en el mismo orden en que
 * devolverá `getByCategory`/`includes`.
 */
export function productRowToProduct(
  row: ProductRow,
  categoryIds: readonly string[]
): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    brand: row.brand_id,
    description: row.description ?? "",
    longDescription: row.long_description ?? undefined,
    price: centsToArs(row.price_cents) ?? 0,
    previousPrice: centsToArs(row.previous_price_cents),
    discount: row.discount ?? undefined,
    images: row.images ?? [],
    categories: [...categoryIds],
    gender: row.gender_id,
    size: row.size ?? "",
    concentration: row.concentration ?? "",
    olfactoryFamily: row.olfactory_family ?? "",
    notes: {
      top: row.notes_top ?? [],
      heart: row.notes_heart ?? [],
      base: row.notes_base ?? [],
    },
    stock: row.stock,
    featured: row.featured,
    isActive: row.is_active,
    isOnSale: row.is_on_sale,
    isNew: row.is_new,
    createdAt: row.created_at,
    soldCount: row.sold_count,
  };
}

/**
 * Reconstruye los productos con su arreglo de categorías agrupando la tabla
 * intermedia `product_categories` (una consulta, sin N+1).
 */
export function rowsToProducts(
  productRows: readonly ProductRow[],
  categoryRows: readonly ProductCategoryRow[]
): Product[] {
  const byProduct = new Map<string, string[]>();
  for (const link of categoryRows) {
    const list = byProduct.get(link.product_id);
    if (list) list.push(link.category_id);
    else byProduct.set(link.product_id, [link.category_id]);
  }
  return productRows.map((row) =>
    productRowToProduct(row, byProduct.get(row.id) ?? [])
  );
}
