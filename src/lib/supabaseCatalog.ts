/**
 * Cargador del catálogo desde Supabase (Fase C-1)
 * ===============================================
 * Una sola carga por hidratación, sin N+1: cinco consultas en paralelo
 * (genders, categories, brands, products, product_categories) resueltas y
 * mapeadas a los tipos de la app en src/lib/catalogMapper.
 *
 * SOLO LECTURA vía cliente `anon` (RLS: catálogo activo). Si una consulta
 * falla se lanza con el detalle: el driver decide cómo degradar (en Fase C-1
 * la tienda conserva la semilla local y el error queda registrado).
 *
 * Pedidos y secciones del home NO se hidratan aquí: el esquema 0001 modela
 * pedidos con eje de pago/logística + profiles (F3) y no tiene tabla para
 * HomepageSection (ver informe P1.3.42).
 */

import type { Brand, Category, Gender, Product } from "@/types";
import {
  brandRowToBrand,
  categoryRowToCategory,
  genderRowToGender,
  rowsToProducts,
  type BrandRow,
  type CategoryRow,
  type GenderRow,
  type ProductCategoryRow,
  type ProductRow,
} from "@/lib/catalogMapper";
import { getSupabase } from "@/lib/supabaseClient";

export interface CatalogPayload {
  genders: Gender[];
  categories: Category[];
  brands: Brand[];
  products: Product[];
}

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

/** Falla con contexto si la consulta devolvió error (o datos nulos raros). */
function unwrap<T>(result: QueryResult<T>, table: string): T[] {
  if (result.error) {
    throw new Error(
      `Consulta fallida en "${table}": ${result.error.message}`
    );
  }
  return result.data ?? [];
}

/**
 * Lee el catálogo completo. Lanza si faltan claves o si alguna consulta
 * devuelve error. Nunca escribe.
 */
export async function fetchCatalog(): Promise<CatalogPayload> {
  const supabase = getSupabase();

  const [genders, categories, brands, products, links] = await Promise.all([
    supabase.from("genders").select("id, name, is_active"),
    supabase
      .from("categories")
      .select("id, slug, name, description, image_url, order, is_active"),
    supabase
      .from("brands")
      .select("id, slug, name, description, image_url, order, is_active"),
    supabase.from("products").select(
      `id, slug, name, brand_id, gender_id, description, long_description,
       price_cents, previous_price_cents, discount, images, size, concentration,
       olfactory_family, notes_top, notes_heart, notes_base, stock, featured,
       is_active, is_on_sale, is_new, sold_count, created_at`
    ),
    supabase.from("product_categories").select("product_id, category_id"),
  ]);

  const genderRows = unwrap<GenderRow>(
    genders as QueryResult<GenderRow>,
    "genders"
  );
  const categoryRows = unwrap<CategoryRow>(
    categories as QueryResult<CategoryRow>,
    "categories"
  );
  const brandRows = unwrap<BrandRow>(brands as QueryResult<BrandRow>, "brands");
  const productRows = unwrap<ProductRow>(
    products as QueryResult<ProductRow>,
    "products"
  );
  const linkRows = unwrap<ProductCategoryRow>(
    links as QueryResult<ProductCategoryRow>,
    "product_categories"
  );

  return {
    genders: genderRows.map(genderRowToGender),
    categories: categoryRows.map(categoryRowToCategory),
    brands: brandRows.map(brandRowToBrand),
    products: rowsToProducts(productRows, linkRows),
  };
}
