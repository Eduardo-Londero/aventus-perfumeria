/**
 * Reemplazo del CMS de banners
 * =============================
 * `PUT /api/data/banners` recibe la lista COMPLETA de banners que el panel
 * acaba de guardar y la deja exactamente así en la tabla `banners`
 * (migración 20261118_0008). La mecánica (validar todo → upsert → borrar lo
 * que sobra) vive en `collectionReplaceService.ts`, compartida con el CMS del
 * home.
 *
 * Nota de fechas: `startDate`/`endDate` vacíos se guardan como NULL = sin
 * límite de vigencia, y `bannerToRow` rechaza una "endDate" anterior a la
 * "startDate" (400, la tabla no se toca).
 */

import { bannerToRow } from "@/lib/server/catalogWriteService";
import { replaceCollectionRows } from "@/lib/server/collectionReplaceService";

/** Tope generoso: son banners de portada, no un catálogo. */
const MAX_BANNERS = 30;

/** `PUT /api/data/banners` — deja la colección exactamente como viene. */
export async function replaceBanners(
  body: unknown
): Promise<{ count: number }> {
  return replaceCollectionRows(body, {
    table: "banners",
    noun: "banners",
    listField: "banners",
    maxItems: MAX_BANNERS,
    mapRow: bannerToRow,
    describeDuplicate: (id) => `El banner "${id}" aparece más de una vez en la lista.`,
  });
}
