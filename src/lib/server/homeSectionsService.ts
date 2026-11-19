/**
 * Reemplazo del CMS del home (Fase D)
 * ===================================
 * `PUT /api/data/home_sections` recibe la lista COMPLETA de secciones que el
 * panel acaba de guardar y la deja exactamente así en la base (validar todo →
 * upsert → borrar lo que sobra). Esa mecánica vive en
 * `collectionReplaceService.ts`, compartida con el CMS de banners; acá sólo
 * se declaran los parámetros propios de este CMS (tabla, tope y mensajes).
 *
 * ¿Por qué un reemplazo de colección y no POST/PATCH/DELETE por fila (como el
 * catálogo)? Porque la sección NO es una fila independiente: su valor es el
 * conjunto (orden + activación). Reemplazar de a una produce estados
 * intermedios visibles y, en la primera guarda, PATCH sobre filas que todavía
 * no existen en la base (404). Acá la operación es una sola ida y vuelta.
 */

import { homeSectionToRow } from "@/lib/server/catalogWriteService";
import { replaceCollectionRows } from "@/lib/server/collectionReplaceService";
import type { HomeSectionRow } from "@/lib/homeSectionsMigration";

/** Tope generoso: el home tiene 10 secciones conocidas. */
const MAX_SECTIONS = 50;

/** `PUT /api/data/home_sections` — deja la colección exactamente como viene. */
export async function replaceHomeSections(
  body: unknown
): Promise<{ count: number }> {
  return replaceCollectionRows<HomeSectionRow>(body, {
    table: "home_sections",
    noun: "secciones del home",
    listField: "sections",
    maxItems: MAX_SECTIONS,
    mapRow: homeSectionToRow,
    describeDuplicate: (id) =>
      `La sección "${id}" aparece más de una vez en la lista.`,
  });
}
