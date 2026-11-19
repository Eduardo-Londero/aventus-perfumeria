/**
 * Entidades de catálogo soportadas por la escritura remota (Fase C-2)
 * ====================================================================
 * Lista blanca ÚNICA compartida por el cliente (src/lib/dataSync.ts) y por el
 * servidor (src/lib/server/catalogWriteService.ts + rutas /api/data/*), para
 * que no pueda existir una entidad que un lado acepte y el otro rechace.
 *
 * Son las colecciones que el driver de Fase C-1 hidrata desde Supabase
 * (catálogo) más el CMS: `home_sections` y `banners`. Pedidos NO están acá:
 * su escritura llega en F3 vía RPC + /api/admin/orders.
 *
 * `home_sections` y `banners` usan una escritura especial (PUT
 * /api/data/{entity}, reemplazo atómico de la colección): lo que importa es
 * el conjunto (orden + activación + vigencia), no filas sueltas, y la primera
 * guarda no tiene filas previas en la base.
 */

export const CATALOG_ENTITIES = [
  "products",
  "categories",
  "brands",
  "genders",
  "home_sections",
  "banners",
] as const;

export type CatalogEntity = (typeof CATALOG_ENTITIES)[number];

export function isCatalogEntity(value: unknown): value is CatalogEntity {
  return (
    typeof value === "string" &&
    (CATALOG_ENTITIES as readonly string[]).includes(value)
  );
}

/**
 * Entidades que se escriben como colección COMPLETA (`PUT /api/data/{entity}`)
 * en vez de POST/PATCH/DELETE por fila. Compartida por el cliente
 * (src/lib/dataSync.ts) y por la ruta /api/data/[entity].
 */
export const COLLECTION_ENTITIES = ["home_sections", "banners"] as const;

export type CollectionEntity = (typeof COLLECTION_ENTITIES)[number];

export function isCollectionEntity(value: unknown): value is CollectionEntity {
  return (
    typeof value === "string" &&
    (COLLECTION_ENTITIES as readonly string[]).includes(value)
  );
}

/** Nombre singular, para mensajes de error en español. */
export const CATALOG_ENTITY_NOUN: Record<CatalogEntity, string> = {
  products: "producto",
  categories: "categoría",
  brands: "marca",
  genders: "género",
  home_sections: "sección del home",
  banners: "banner",
};
