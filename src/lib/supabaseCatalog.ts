/**
 * Cargador del catálogo desde Supabase (Fase C-1)
 * ===============================================
 * Una sola carga por hidratación, sin N+1: siete consultas en paralelo
 * (genders, categories, brands, products, product_categories, home_sections,
 * banners) resueltas y mapeadas a los tipos de la app en src/lib/catalogMapper.
 *
 * SOLO LECTURA vía cliente `anon` (RLS: catálogo activo). Si una consulta
 * falla se lanza con el detalle: el driver decide cómo degradar (en Fase C-1
 * la tienda conserva la semilla local y el error queda registrado).
 *
 * Pedidos NO se hidratan acá (el esquema 0001 modela pagos/logística +
 * profiles, F3). El CMS del home (`home_sections`) y los banners SÍ, desde la
 * Fase D: sus consultas degradan a lista vacía para que un problema del panel
 * nunca deje la tienda sin catálogo.
 */

import type { Brand, Category, Gender, Product } from "@/types";
import type { Banner, HomepageSection } from "@/types/cms";
import {
  bannerRowToBanner,
  brandRowToBrand,
  categoryRowToCategory,
  genderRowToGender,
  rowsToProducts,
  type BannerRow,
  type BrandRow,
  type CategoryRow,
  type GenderRow,
  type ProductCategoryRow,
  type ProductRow,
} from "@/lib/catalogMapper";
import {
  homeSectionRowToHomepageSection,
  type HomeSectionRow,
} from "@/lib/homeSectionsMigration";
import { getSupabase } from "@/lib/supabaseClient";

export interface CatalogPayload {
  genders: Gender[];
  categories: Category[];
  brands: Brand[];
  products: Product[];
  /**
   * Secciones del home (Fase D). Opcional en el tipo para que un remoto sin
   * la tabla (o un mock de tests) no rompa la hidratación: el driver trata
   * `undefined` como "sin secciones".
   */
  homeSections?: HomepageSection[];
  /** Banners del CMS (mismo criterio de degradación que `homeSections`). */
  banners?: Banner[];
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

  const [genders, categories, brands, products, links, sections, banners] =
    await Promise.all([
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
      // Fase D: CMS del home. Si falla (tabla ausente / permisos) NO se tumba
      // el catálogo: se registra el error y la página cae a sus secciones semilla.
      supabase
        .from("home_sections")
        .select("id, type, title, is_active, order, content")
        .order("order", { ascending: true }),
      // Fase D: banners. Mismo criterio de degradación que las secciones.
      supabase
        .from("banners")
        .select(
          "id, title, subtitle, image, button_text, button_link, start_date, end_date, is_active, order, type"
        )
        .order("order", { ascending: true }),
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

  // Secciones del home: degradan a lista vacía (el consumidor usa la semilla)
  // para que un problema del CMS nunca deje la tienda sin catálogo.
  const sectionResult = sections as QueryResult<HomeSectionRow>;
  let homeSections: HomepageSection[] = [];
  if (sectionResult.error) {
    console.error(
      "[supabaseCatalog] no se pudieron leer las secciones del home:",
      sectionResult.error.message
    );
  } else {
    homeSections = (sectionResult.data ?? []).map(
      homeSectionRowToHomepageSection
    );
  }

  // Banners: mismo criterio (error → lista vacía → la tienda usa su semilla).
  const bannerResult = banners as QueryResult<BannerRow>;
  let bannerList: Banner[] = [];
  if (bannerResult.error) {
    console.error(
      "[supabaseCatalog] no se pudieron leer los banners:",
      bannerResult.error.message
    );
  } else {
    bannerList = (bannerResult.data ?? []).map(bannerRowToBanner);
  }

  return {
    genders: genderRows.map(genderRowToGender),
    categories: categoryRows.map(categoryRowToCategory),
    brands: brandRows.map(brandRowToBrand),
    products: rowsToProducts(productRows, linkRows),
    homeSections,
    banners: bannerList,
  };
}
