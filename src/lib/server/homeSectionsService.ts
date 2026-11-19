/**
 * Reemplazo del CMS del home (Fase D)
 * ===================================
 * `PUT /api/data/home_sections` recibe la lista COMPLETA de secciones que el
 * panel acaba de guardar y la deja exactamente así en la base:
 *
 *   1. valida TODO primero (fila por fila, con los mismos mappers que usa el
 *      resto del catálogo) → un payload inválido es 400 y no toca la tabla;
 *   2. hace `upsert` de las filas enviadas (alta o modificación, sin
 *      duplicados);
 *   3. borra las que ya no vienen en la lista.
 *
 * ¿Por qué un reemplazo de colección y no POST/PATCH/DELETE por fila (como el
 * catálogo)? Porque la sección NO es una fila independiente: su valor es el
 * conjunto (orden + activación). Reemplazar de a una produce estados
 * intermedios visibles y, en la primera guarda, PATCH sobre filas que todavía
 * no existen en la base (404). Acá la operación es una sola ida y vuelta.
 *
 * Se sube primero y se borra después: si algo falla a mitad de camino el home
 * nunca queda sin secciones.
 */

import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { homeSectionToRow } from "@/lib/server/catalogWriteService";
import type { HomeSectionRow } from "@/lib/homeSectionsMigration";
import {
  InvalidBodyError,
  ValidationError,
  mapPostgrestError,
} from "@/lib/server/apiError";

/** Tope generoso: el home tiene 10 secciones conocidas. */
const MAX_SECTIONS = 50;

/** Extrae la lista de secciones del cuerpo (array o `{ sections: [...] }`). */
function extractSections(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  if (
    body !== null &&
    typeof body === "object" &&
    Array.isArray((body as { sections?: unknown }).sections)
  ) {
    return (body as { sections: unknown[] }).sections;
  }
  throw new InvalidBodyError(
    'Se esperaba un arreglo de secciones (o un objeto con el campo "sections").'
  );
}

/** Valida TODAS las filas antes de escribir ninguna. */
function validateAll(values: unknown[]): HomeSectionRow[] {
  if (values.length > MAX_SECTIONS) {
    throw new ValidationError(
      `El home admite como máximo ${MAX_SECTIONS} secciones (vinieron ${values.length}).`
    );
  }
  const rows = values.map((value) => homeSectionToRow(value));
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.id)) {
      throw new ValidationError(
        `La sección "${row.id}" aparece más de una vez en la lista.`
      );
    }
    seen.add(row.id);
  }
  return rows;
}

/** `PUT /api/data/home_sections` — deja la colección exactamente como viene. */
export async function replaceHomeSections(
  body: unknown
): Promise<{ count: number }> {
  const rows = validateAll(extractSections(body));
  const admin = getSupabaseAdmin();

  if (rows.length > 0) {
    const upserted = await admin
      .from("home_sections")
      .upsert(rows, { onConflict: "id" });
    if (upserted.error) {
      throw mapPostgrestError(upserted.error, {
        entity: "home_sections",
        action: "update",
      });
    }
  }

  const keepIds = rows.map((row) => row.id);
  const existing = await admin.from("home_sections").select("id");
  if (existing.error) {
    throw mapPostgrestError(existing.error, {
      entity: "home_sections",
      action: "update",
    });
  }

  const stale = ((existing.data ?? []) as Array<{ id: string }>)
    .map((row) => row.id)
    .filter((id) => !keepIds.includes(id));

  if (stale.length > 0) {
    const removed = await admin
      .from("home_sections")
      .delete()
      .in("id", stale);
    if (removed.error) {
      throw mapPostgrestError(removed.error, {
        entity: "home_sections",
        action: "delete",
      });
    }
  }

  return { count: rows.length };
}
