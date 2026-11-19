/**
 * Escritura del catálogo sobre Supabase (Fase C-2)
 * ================================================
 * Único punto que traduce un payload de la app (src/types) a filas del esquema
 * 0001, valida y persiste con `service_role`. Lo consumen los Route Handlers
 * de /api/data/*.
 *
 * Reglas:
 *  - Validación ESTRICTA y en español: cualquier payload inválido produce
 *    `ValidationError` → 400, nunca llega a la base.
 *  - Las referencias (marca, género, categorías) se verifican ANTES de
 *    escribir: así los errores son 400/409 accionables y no violaciones de FK
 *    crudas.
 *  - La tabla intermedia `product_categories` se sincroniza por diferencia
 *    (inserta faltantes / borra sobrantes) en UPDATE: no hay ventana en la que
 *    un producto quede sin categorías si algo falla.
 *  - En CREATE de producto, si falla el alta de `product_categories` se
 *    compensa borrando la fila recién creada (no hay transacción disponible
 *    sin una RPC propia; documentado en el informe P1.3.43).
 *  - Campos del modelo SIN columna (Brand.logo/website, Category.parentId) se
 *    descartan de forma explícita, igual que al leer (ver catalogMapper.ts).
 *
 * Módulo puro salvo por el cliente supabase: los mappers y la validación se
 * testean sin red.
 */

import { arsToCents } from "@/lib/catalogMapper";
import type {
  BannerRow,
  BrandRow,
  CategoryRow,
  GenderRow,
  ProductRow,
} from "@/lib/catalogMapper";
import {
  CATALOG_ENTITY_NOUN,
  type CatalogEntity,
} from "@/lib/catalogEntities";
import { isBannerType } from "@/lib/banners";
import { isHomeSectionType, type HomeSectionRow } from "@/lib/homeSectionsMigration";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import {
  ConflictError,
  InvalidBodyError,
  NotFoundError,
  ValidationError,
  mapPostgrestError,
} from "@/lib/server/apiError";

// La lista blanca de entidades vive en src/lib/catalogEntities.ts (compartida
// con el cliente) para que ambos lados validen lo mismo.
export {
  CATALOG_ENTITIES,
  isCatalogEntity,
  type CatalogEntity,
} from "@/lib/catalogEntities";

// ---------------------------------------------------------------------------
// Validadores (todos lanzan ValidationError → 400)
// ---------------------------------------------------------------------------

const MAX_TEXT = 5_000;
const MAX_SHORT = 200;
const MAX_ID = 64;

function asRecord(body: unknown): Record<string, unknown> {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new InvalidBodyError("Se esperaba un objeto JSON como cuerpo.");
  }
  return body as Record<string, unknown>;
}

/** Texto obligatorio: no vacío tras trim, con tope de longitud. Se conserva tal cual. */
function reqText(
  value: unknown,
  field: string,
  max: number = MAX_SHORT
): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError(`El campo "${field}" es obligatorio y debe ser texto.`);
  }
  if (value.length > max) {
    throw new ValidationError(
      `El campo "${field}" supera el máximo de ${max} caracteres.`
    );
  }
  return value;
}

/** Texto opcional: `undefined`/`null`/vacío → `fallback` ("" o null). */
function optText(
  value: unknown,
  field: string,
  opts: { max?: number; nullAs?: "" | null } = {}
): string | null {
  const nullAs = opts.nullAs ?? null;
  if (value === undefined || value === null || value === "") return nullAs;
  if (typeof value !== "string") {
    throw new ValidationError(`El campo "${field}" debe ser texto.`);
  }
  if (value.length > (opts.max ?? MAX_TEXT)) {
    throw new ValidationError(
      `El campo "${field}" supera el máximo de ${opts.max ?? MAX_TEXT} caracteres.`
    );
  }
  return value;
}

function reqPrice(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new ValidationError(
      `El campo "${field}" debe ser un importe numérico mayor o igual a 0.`
    );
  }
  return Math.round(value);
}

function optInt(
  value: unknown,
  field: string,
  opts: { min?: number; max?: number; fallback: number }
): number {
  if (value === undefined || value === null) return opts.fallback;
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < (opts.min ?? 0) ||
    value > (opts.max ?? Number.MAX_SAFE_INTEGER)
  ) {
    const min = opts.min ?? 0;
    const max =
      opts.max === undefined ? "sin tope superior" : `hasta ${opts.max}`;
    throw new ValidationError(
      `El campo "${field}" debe ser un número entero (${min} ${max}).`
    );
  }
  return value;
}

function optDiscount(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  return optInt(value, "discount", { min: 0, max: 100, fallback: 0 });
}

function optBool(value: unknown, field: string, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "boolean") {
    throw new ValidationError(`El campo "${field}" debe ser verdadero o falso.`);
  }
  return value;
}

function optStrArray(
  value: unknown,
  field: string,
  opts: { maxItems?: number; required?: boolean } = {}
): string[] {
  if (value === undefined || value === null) {
    if (opts.required) {
      throw new ValidationError(`El campo "${field}" es obligatorio.`);
    }
    return [];
  }
  if (!Array.isArray(value)) {
    throw new ValidationError(`El campo "${field}" debe ser una lista de textos.`);
  }
  const max = opts.maxItems ?? 50;
  if (value.length > max) {
    throw new ValidationError(`El campo "${field}" admite como máximo ${max} ítems.`);
  }
  return value.map((item, index) =>
    reqText(item, `${field}[${index}]`, MAX_TEXT)
  );
}

/** Fecha ISO utilizable para `timestamptz`. */
function reqDate(value: unknown, field: string): string {
  const text = reqText(value, field, 40);
  if (Number.isNaN(Date.parse(text))) {
    throw new ValidationError(`El campo "${field}" debe ser una fecha válida.`);
  }
  return text;
}

/** ID de la URL: obligatorio y con tope (misma regla que la ruta). */
function reqId(id: string): string {
  if (typeof id !== "string" || id.trim() === "") {
    throw new ValidationError("El ID del registro es obligatorio.");
  }
  if (id.length > 64) {
    throw new ValidationError("El ID del registro es demasiado largo.");
  }
  return id;
}

// ---------------------------------------------------------------------------
// Mapeo app → fila (con validación incorporada)
// ---------------------------------------------------------------------------

export function genderToRow(value: unknown): GenderRow {
  const body = asRecord(value);
  return {
    id: reqText(body.id, "id", MAX_ID),
    name: reqText(body.name, "name"),
    is_active: optBool(body.isActive, "isActive", true),
  };
}

export function categoryToRow(value: unknown): CategoryRow {
  const body = asRecord(value);
  return {
    id: reqText(body.id, "id", MAX_ID),
    slug: reqText(body.slug, "slug", MAX_SHORT),
    name: reqText(body.name, "name"),
    // "" → null (al volver a la app es "" otra vez: ida y vuelta exacto).
    description: optText(body.description, "description", { nullAs: null }),
    image_url: optText(body.image, "image", { max: 1000, nullAs: null }),
    order: optInt(body.order, "order", { fallback: 0 }),
    is_active: optBool(body.isActive, "isActive", true),
  };
}

export function brandToRow(value: unknown): BrandRow {
  const body = asRecord(value);
  return {
    id: reqText(body.id, "id", MAX_ID),
    slug: reqText(body.slug, "slug", MAX_SHORT),
    name: reqText(body.name, "name"),
    description: optText(body.description, "description", { nullAs: null }),
    image_url: optText(body.image, "image", { max: 1000, nullAs: null }),
    order: optInt(body.order, "order", { fallback: 0 }),
    is_active: optBool(body.isActive, "isActive", true),
    // Brand.logo / Brand.website: sin columna en 0001 (brecha documentada
    // en P1.3.42) — se descartan igual que al leer.
  };
}

/**
 * Sección del home app → fila (`home_sections`, Fase D).
 * `content` es jsonb: objeto o null. Cualquier otra cosa es 400, nunca llega
 * a la base.
 */
export function homeSectionToRow(value: unknown): HomeSectionRow {
  const body = asRecord(value);
  const type = reqText(body.type, "type", MAX_SHORT);
  if (!isHomeSectionType(type)) {
    throw new ValidationError(
      `El campo "type" no corresponde a una sección del home: "${type}".`
    );
  }
  const content = body.content;
  if (
    content !== undefined &&
    content !== null &&
    (typeof content !== "object" || Array.isArray(content))
  ) {
    throw new ValidationError(
      'El campo "content" debe ser un objeto JSON o null.'
    );
  }

  return {
    id: reqText(body.id, "id", MAX_ID),
    type,
    title: reqText(body.title, "title"),
    is_active: optBool(body.isActive, "isActive", true),
    order: optInt(body.order, "order", { min: 0, fallback: 0 }),
    content: (content as Record<string, unknown> | null) ?? null,
  };
}

/** Fecha opcional `AAAA-MM-DD` → `YYYY-MM-DD` o null (vacío = sin límite). */
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function optDate(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !DATE_KEY_RE.test(value)) {
    throw new ValidationError(
      `El campo "${field}" debe ser una fecha en formato "AAAA-MM-DD" (o vacío para no limitar).`
    );
  }
  return value;
}

/**
 * Banner app → fila de `banners`. `startDate`/`endDate` son opcionales: sin
 * fechas el banner siempre está vigente mientras esté activo.
 */
export function bannerToRow(value: unknown): BannerRow {
  const body = asRecord(value);
  const type = reqText(body.type, "type", MAX_SHORT);
  if (!isBannerType(type)) {
    throw new ValidationError(
      `El campo "type" no corresponde a un tipo de banner: "${type}".`
    );
  }
  const start_date = optDate(body.startDate, "startDate");
  const end_date = optDate(body.endDate, "endDate");
  if (start_date && end_date && end_date < start_date) {
    throw new ValidationError(
      'La fecha final ("endDate") no puede ser anterior a la inicial ("startDate").'
    );
  }

  return {
    id: reqText(body.id, "id", MAX_ID),
    title: reqText(body.title, "title"),
    subtitle: optText(body.subtitle, "subtitle", { nullAs: "" }) ?? "",
    image: optText(body.image, "image", { max: 2_048, nullAs: "" }) ?? "",
    button_text:
      optText(body.buttonText, "buttonText", { max: 80, nullAs: "" }) ?? "",
    button_link:
      optText(body.buttonLink, "buttonLink", { max: 2_048, nullAs: "" }) ?? "",
    start_date,
    end_date,
    is_active: optBool(body.isActive, "isActive", true),
    order: optInt(body.order, "order", { min: 0, fallback: 0 }),
    type,
  };
}

/**
 * Producto app → fila. `created_at` solo se usa en INSERT: en UPDATE se
 * elimina (ver `productUpdateRow`) para conservar la fecha de alta original.
 */
export function productToRow(value: unknown): ProductRow {
  const body = asRecord(value);
  const notes = asRecord(body.notes ?? {});

  return {
    id: reqText(body.id, "id", MAX_ID),
    slug: reqText(body.slug, "slug", MAX_SHORT),
    name: reqText(body.name, "name"),
    brand_id: reqText(body.brand, "brand", MAX_ID),
    gender_id: reqText(body.gender, "gender", MAX_ID),
    description: optText(body.description, "description", { nullAs: null }),
    long_description: optText(body.longDescription, "longDescription", {
      nullAs: null,
    }),
    price_cents: arsToCents(reqPrice(body.price, "price")) ?? 0,
    previous_price_cents:
      body.previousPrice === undefined || body.previousPrice === null
        ? null
        : arsToCents(reqPrice(body.previousPrice, "previousPrice")),
    discount: optDiscount(body.discount),
    images: optStrArray(body.images, "images", { required: true, maxItems: 20 }),
    size: optText(body.size, "size", { nullAs: null }),
    concentration: optText(body.concentration, "concentration", { nullAs: null }),
    olfactory_family: optText(body.olfactoryFamily, "olfactoryFamily", {
      nullAs: null,
    }),
    notes_top: optStrArray(notes.top, "notes.top", { maxItems: 30 }),
    notes_heart: optStrArray(notes.heart, "notes.heart", { maxItems: 30 }),
    notes_base: optStrArray(notes.base, "notes.base", { maxItems: 30 }),
    stock: optInt(body.stock, "stock", { fallback: 0 }),
    featured: optBool(body.featured, "featured", false),
    is_active: optBool(body.isActive, "isActive", true),
    is_on_sale: optBool(body.isOnSale, "isOnSale", false),
    is_new: optBool(body.isNew, "isNew", false),
    sold_count: optInt(body.soldCount, "soldCount", { fallback: 0 }),
    created_at: reqDate(body.createdAt, "createdAt"),
  };
}

/** Fila de UPDATE: sin `created_at` (la alta no se reescribe) ni `updated_at` (trigger). */
export function productUpdateRow(
  row: ProductRow
): Omit<ProductRow, "created_at"> {
  const { created_at: _created, ...rest } = row;
  return rest;
}

/** Categorías pedidas en el payload de un producto (validadas). */
export function productCategoryIds(value: unknown): string[] {
  const body = asRecord(value);
  return optStrArray(body.categories, "categories", {
    required: true,
    maxItems: 20,
  });
}

// ---------------------------------------------------------------------------
// Operaciones
// ---------------------------------------------------------------------------

type Admin = ReturnType<typeof getSupabaseAdmin>;

function entityLabel(entity: CatalogEntity): string {
  return CATALOG_ENTITY_NOUN[entity];
}

/**
 * Verifica que marca, género y categorías existan. Produce un 400 accionable
 * en lugar de una violación de FK (23503) una vez escrita la fila.
 */
async function assertProductReferences(
  admin: Admin,
  refs: { brandId: string; genderId: string; categoryIds: string[] }
): Promise<void> {
  const brand = await admin
    .from("brands")
    .select("id")
    .eq("id", refs.brandId)
    .maybeSingle();
  if (brand.error) {
    throw mapPostgrestError(brand.error, { entity: "brands", action: "create" });
  }
  if (!brand.data) {
    throw new ValidationError(
      `La marca "${refs.brandId}" no existe. Creala en Marcas antes de guardar el producto.`
    );
  }

  const gender = await admin
    .from("genders")
    .select("id")
    .eq("id", refs.genderId)
    .maybeSingle();
  if (gender.error) {
    throw mapPostgrestError(gender.error, { entity: "genders", action: "create" });
  }
  if (!gender.data) {
    throw new ValidationError(
      `El género "${refs.genderId}" no existe. Crealo en Géneros antes de guardar el producto.`
    );
  }

  if (refs.categoryIds.length === 0) return;

  const cats = await admin.from("categories").select("id").in("id", refs.categoryIds);
  if (cats.error) {
    throw mapPostgrestError(cats.error, { entity: "categories", action: "create" });
  }

  const found = new Set<string>(
    ((cats.data ?? []) as Array<{ id: string }>).map((row) => row.id)
  );
  const missing = refs.categoryIds.filter((id) => !found.has(id));
  if (missing.length > 0) {
    throw new ValidationError(
      `Categorías inexistentes: ${missing.join(", ")}. ` +
        `Crealas en Categorías antes de guardar el producto.`
    );
  }
}

/** POST /api/data/{entity} */
export async function createEntity(
  entity: CatalogEntity,
  body: unknown
): Promise<{ id: string }> {
  // Validar ANTES de tocar la configuración/la base: un payload inválido es
  // un 400, no un 503 ni una consulta fallida.
  if (entity === "products") {
    const row = productToRow(body);
    const categoryIds = productCategoryIds(body);
    const admin = getSupabaseAdmin();
    await assertProductReferences(admin, {
      brandId: row.brand_id,
      genderId: row.gender_id,
      categoryIds,
    });

    const inserted = await admin.from("products").insert(row).select("id");
    if (inserted.error) {
      throw mapPostgrestError(inserted.error, { entity, action: "create" });
    }

    if (categoryIds.length > 0) {
      const links = await admin
        .from("product_categories")
        .insert(
          categoryIds.map((category_id) => ({
            product_id: row.id,
            category_id,
          }))
        );
      if (links.error) {
        // Compensación: no dejar un producto huérfano sin sus categorías.
        await admin.from("products").delete().eq("id", row.id);
        throw mapPostgrestError(links.error, {
          entity: "categories",
          action: "create",
        });
      }
    }

    return { id: row.id };
  }

  if (entity === "categories") {
    const row = categoryToRow(body);
    const { error } = await getSupabaseAdmin().from("categories").insert(row);
    if (error) throw mapPostgrestError(error, { entity, action: "create" });
    return { id: row.id };
  }

  if (entity === "brands") {
    const row = brandToRow(body);
    const { error } = await getSupabaseAdmin().from("brands").insert(row);
    if (error) throw mapPostgrestError(error, { entity, action: "create" });
    return { id: row.id };
  }

  if (entity === "home_sections") {
    const row = homeSectionToRow(body);
    const { error } = await getSupabaseAdmin()
      .from("home_sections")
      .insert(row);
    if (error) throw mapPostgrestError(error, { entity, action: "create" });
    return { id: row.id };
  }

  if (entity === "banners") {
    const row = bannerToRow(body);
    const { error } = await getSupabaseAdmin().from("banners").insert(row);
    if (error) throw mapPostgrestError(error, { entity, action: "create" });
    return { id: row.id };
  }

  const row = genderToRow(body);
  const { error } = await getSupabaseAdmin().from("genders").insert(row);
  if (error) throw mapPostgrestError(error, { entity, action: "create" });
  return { id: row.id };
}

/** PATCH /api/data/{entity}/{id} */
export async function updateEntity(
  entity: CatalogEntity,
  id: string,
  body: unknown
): Promise<{ id: string }> {
  // id y payload se validan ANTES de abrir el cliente (400, no 503/500).
  reqId(id);

  if (entity === "products") {
    const row = productToRow(body);
    if (row.id !== id) {
      throw new ValidationError(
        `El ID del cuerpo ("${row.id}") no coincide con el de la URL ("${id}").`
      );
    }
    const categoryIds = productCategoryIds(body);
    const admin = getSupabaseAdmin();
    await assertProductReferences(admin, {
      brandId: row.brand_id,
      genderId: row.gender_id,
      categoryIds,
    });

    const updated = await admin
      .from("products")
      .update(productUpdateRow(row))
      .eq("id", id)
      .select("id");
    if (updated.error) {
      throw mapPostgrestError(updated.error, { entity, action: "update" });
    }
    if (!updated.data || updated.data.length === 0) {
      throw new NotFoundError(`No existe un producto con ID "${id}".`);
    }

    // Sincronización por diferencia: solo se tocan las categorías que
    // cambiaron (sin ventana sin categorías ni conflictos de PK).
    const current = await admin
      .from("product_categories")
      .select("category_id")
      .eq("product_id", id);
    if (current.error) {
      throw mapPostgrestError(current.error, {
        entity: "categories",
        action: "update",
      });
    }

    const existing = ((current.data ?? []) as Array<{ category_id: string }>).map(
      (link) => link.category_id
    );
    const existingSet = new Set(existing);
    const nextSet = new Set(categoryIds);
    const toInsert = categoryIds.filter((c) => !existingSet.has(c));
    const toRemove = existing.filter((c) => !nextSet.has(c));

    if (toRemove.length > 0) {
      const removed = await admin
        .from("product_categories")
        .delete()
        .eq("product_id", id)
        .in("category_id", toRemove);
      if (removed.error) {
        throw mapPostgrestError(removed.error, {
          entity: "categories",
          action: "update",
        });
      }
    }

    if (toInsert.length > 0) {
      const added = await admin
        .from("product_categories")
        .insert(
          toInsert.map((category_id) => ({
            product_id: id,
            category_id,
          }))
        );
      if (added.error) {
        throw mapPostgrestError(added.error, {
          entity: "categories",
          action: "update",
        });
      }
    }

    return { id };
  }

  if (entity === "categories") {
    const row = categoryToRow(body);
    if (row.id !== id) {
      throw new ValidationError(
        `El ID del cuerpo ("${row.id}") no coincide con el de la URL ("${id}").`
      );
    }
    const { data, error } = await getSupabaseAdmin()
      .from("categories")
      .update(row)
      .eq("id", id)
      .select("id");
    if (error) throw mapPostgrestError(error, { entity, action: "update" });
    if (!data || data.length === 0) {
      throw new NotFoundError(`No existe una categoría con ID "${id}".`);
    }
    return { id };
  }

  if (entity === "brands") {
    const row = brandToRow(body);
    if (row.id !== id) {
      throw new ValidationError(
        `El ID del cuerpo ("${row.id}") no coincide con el de la URL ("${id}").`
      );
    }
    const { data, error } = await getSupabaseAdmin()
      .from("brands")
      .update(row)
      .eq("id", id)
      .select("id");
    if (error) throw mapPostgrestError(error, { entity, action: "update" });
    if (!data || data.length === 0) {
      throw new NotFoundError(`No existe una marca con ID "${id}".`);
    }
    return { id };
  }

  if (entity === "home_sections") {
    const row = homeSectionToRow(body);
    if (row.id !== id) {
      throw new ValidationError(
        `El ID del cuerpo ("${row.id}") no coincide con el de la URL ("${id}").`
      );
    }
    const { data, error } = await getSupabaseAdmin()
      .from("home_sections")
      .update(row)
      .eq("id", id)
      .select("id");
    if (error) throw mapPostgrestError(error, { entity, action: "update" });
    if (!data || data.length === 0) {
      throw new NotFoundError(`No existe una sección del home con ID "${id}".`);
    }
    return { id };
  }

  if (entity === "banners") {
    const row = bannerToRow(body);
    if (row.id !== id) {
      throw new ValidationError(
        `El ID del cuerpo ("${row.id}") no coincide con el de la URL ("${id}").`
      );
    }
    const { data, error } = await getSupabaseAdmin()
      .from("banners")
      .update(row)
      .eq("id", id)
      .select("id");
    if (error) throw mapPostgrestError(error, { entity, action: "update" });
    if (!data || data.length === 0) {
      throw new NotFoundError(`No existe un banner con ID "${id}".`);
    }
    return { id };
  }

  const row = genderToRow(body);
  if (row.id !== id) {
    throw new ValidationError(
      `El ID del cuerpo ("${row.id}") no coincide con el de la URL ("${id}").`
    );
  }
  const { data, error } = await getSupabaseAdmin()
    .from("genders")
    .update(row)
    .eq("id", id)
    .select("id");
  if (error) throw mapPostgrestError(error, { entity, action: "update" });
  if (!data || data.length === 0) {
    throw new NotFoundError(`No existe un género con ID "${id}".`);
  }
  return { id };
}

/** DELETE /api/data/{entity}/{id} */
export async function deleteEntity(
  entity: CatalogEntity,
  id: string
): Promise<{ id: string }> {
  // id validado ANTES de abrir el cliente: un id inválido es un 400.
  reqId(id);

  if (entity === "products") {
    const admin = getSupabaseAdmin();
    // `order_items.product_id` NO tiene FK (snapshot histórico por diseño),
    // así que la única red de seguridad contra borrar un producto vendido es
    // esta consulta: el cliente además desactiva en lugar de eliminar.
    const referenced = await admin
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("product_id", id);
    if (referenced.error) {
      throw mapPostgrestError(referenced.error, { entity, action: "delete" });
    }
    if ((referenced.count ?? 0) > 0) {
      throw new ConflictError(
        "El producto tiene pedidos asociados: no se puede eliminar. " +
          "Desactivalo en su lugar para conservar el historial."
      );
    }

    const { data, error } = await admin
      .from("products")
      .delete()
      .eq("id", id)
      .select("id");
    if (error) throw mapPostgrestError(error, { entity, action: "delete" });
    if (!data || data.length === 0) {
      throw new NotFoundError(`No existe un producto con ID "${id}".`);
    }
    return { id };
  }

  const table = entity;
  const { data, error } = await getSupabaseAdmin()
    .from(table)
    .delete()
    .eq("id", id)
    .select("id");
  if (error) {
    // 23503 = todavía hay productos usándola (brands/genders).
    throw mapPostgrestError(error, { entity, action: "delete" });
  }
  if (!data || data.length === 0) {
    throw new NotFoundError(
      `No existe ${
        entity === "brands"
          ? "una marca"
          : entity === "categories"
            ? "una categoría"
            : entity === "home_sections"
              ? "una sección del home"
              : entity === "banners"
                ? "un banner"
                : "un género"
      } con ID "${id}".`
    );
  }
  return { id };
}

/** Mensaje de error listo para mostrar (usado por dataSync en el cliente). */
export function describeEntity(entity: CatalogEntity): string {
  return entityLabel(entity);
}
