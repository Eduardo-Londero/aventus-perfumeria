/**
 * Entidades de catálogo soportadas por la escritura remota (Fase C-2)
 * ====================================================================
 * Lista blanca ÚNICA compartida por el cliente (src/lib/dataSync.ts) y por el
 * servidor (src/lib/server/catalogWriteService.ts + rutas /api/data/*), para
 * que no pueda existir una entidad que un lado acepte y el otro rechace.
 *
 * Son las colecciones que el driver de Fase C-1 hidrata desde Supabase
 * (catálogo) más `home_sections`, el CMS del home sumado en Fase D. Pedidos NO
 * están acá: su escritura llega en F3 vía RPC + /api/admin/orders.
 *
 * `home_sections` usa una escritura especial (PUT /api/data/home_sections,
 * reemplazo atómico de la colección) porque el panel guarda el orden y la
 * activación del conjunto, no filas sueltas.
 */

export const CATALOG_ENTITIES = [
  "products",
  "categories",
  "brands",
  "genders",
  "home_sections",
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
  home_sections: "sección del home",
};
