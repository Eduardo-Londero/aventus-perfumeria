/**
 * Entidades de catálogo soportadas por la escritura remota (Fase C-2)
 * ====================================================================
 * Lista blanca ÚNICA compartida por el cliente (src/lib/dataSync.ts) y por el
 * servidor (src/lib/server/catalogWriteService.ts + rutas /api/data/*), para
 * que no pueda existir una entidad que un lado acepte y el otro rechace.
 *
 * Son exactamente las 4 colecciones que el driver de Fase C-1 hidrata desde
 * Supabase. Pedidos y secciones del home NO están acá: sus escrituras llegan
 * en F3 y Fase D respectivamente.
 */

export const CATALOG_ENTITIES = [
  "products",
  "categories",
  "brands",
  "genders",
] as const;

export type CatalogEntity = (typeof CATALOG_ENTITIES)[number];

export function isCatalogEntity(value: unknown): value is CatalogEntity {
  return (
    typeof value === "string" &&
    (CATALOG_ENTITIES as readonly string[]).includes(value)
  );
}

/** Nombre singular, para mensajes de error en español. */
export const CATALOG_ENTITY_NOUN: Record<CatalogEntity, string> = {
  products: "producto",
  categories: "categoría",
  brands: "marca",
  genders: "género",
};
