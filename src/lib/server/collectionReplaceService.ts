/**
 * Reemplazo atómico de una colección del CMS
 * ===========================================
 * Motor compartido de las escrituras tipo `PUT /api/data/{entity}` (Fase D):
 * recibe la lista COMPLETA que el panel acaba de guardar y deja la tabla
 * exactamente así:
 *
 *   1. valida TODO primero (fila por fila) → un payload inválido es 400 y no
 *      toca la base;
 *   2. hace `upsert` de las filas enviadas (alta o modificación, sin
 *      duplicados);
 *   3. borra las que ya no vienen en la lista.
 *
 * ¿Por qué un reemplazo de colección y no POST/PATCH/DELETE por fila (como el
 * catálogo)? Porque el valor de estas entidades es el CONJUNTO (orden +
 * activación + vigencia), no filas independientes: reemplazar de a una deja
 * estados intermedios visibles y, en la primera guarda, PATCH sobre filas que
 * todavía no existen en la base (404).
 *
 * Se sube primero y se borra después: si algo falla a mitad de camino la tabla
 * nunca queda vacía a medias.
 *
 * Consumido por `homeSectionsService.ts` (home_sections) y
 * `bannersService.ts` (banners).
 */

import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import {
  InvalidBodyError,
  ValidationError,
  mapPostgrestError,
} from "@/lib/server/apiError";

/** Describe la colección que un servicio concreto reemplaza. */
export interface CollectionSpec<T> {
  /** Tabla de destino (coincide con el nombre de la entidad en la URL). */
  table: string;
  /** Sustantivo plural para los mensajes, p. ej. `"secciones del home"`. */
  noun: string;
  /** Campo que envuelve la lista cuando el cuerpo no es un array. */
  listField: string;
  /** Tope de elementos (defensa contra payloads absurdos). */
  maxItems: number;
  /** Payload → fila válida. Debe lanzar `ValidationError` si no corresponde. */
  mapRow: (value: unknown) => T;
  /** Frase de la repetición, p. ej. `La sección "${id}" aparece...`. */
  describeDuplicate: (id: string) => string;
}

/** Extrae la lista del cuerpo (array o `{ [listField]: [...] }`). */
function extractList(
  body: unknown,
  listField: string,
  noun: string
): unknown[] {
  if (Array.isArray(body)) return body;
  if (
    body !== null &&
    typeof body === "object" &&
    Array.isArray((body as Record<string, unknown>)[listField])
  ) {
    return (body as Record<string, unknown>)[listField] as unknown[];
  }
  throw new InvalidBodyError(
    `Se esperaba un arreglo de ${noun} (o un objeto con el campo "${listField}").`
  );
}

/** `PUT /api/data/{table}` — deja la colección exactamente como viene. */
export async function replaceCollectionRows<T extends { id: string }>(
  body: unknown,
  spec: CollectionSpec<T>
): Promise<{ count: number }> {
  const values = extractList(body, spec.listField, spec.noun);

  if (values.length > spec.maxItems) {
    throw new ValidationError(
      `Se admiten como máximo ${spec.maxItems} ${spec.noun} (vinieron ${values.length}).`
    );
  }

  // Validar TODAS las filas antes de escribir ninguna.
  const rows = values.map(spec.mapRow);
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.id)) {
      throw new ValidationError(spec.describeDuplicate(row.id));
    }
    seen.add(row.id);
  }

  const admin = getSupabaseAdmin();

  if (rows.length > 0) {
    const upserted = await admin
      .from(spec.table)
      .upsert(rows, { onConflict: "id" });
    if (upserted.error) {
      throw mapPostgrestError(upserted.error, {
        entity: spec.table,
        action: "update",
      });
    }
  }

  const keepIds = rows.map((row) => row.id);
  const existing = await admin.from(spec.table).select("id");
  if (existing.error) {
    throw mapPostgrestError(existing.error, {
      entity: spec.table,
      action: "update",
    });
  }

  const stale = ((existing.data ?? []) as Array<{ id: string }>)
    .map((row) => row.id)
    .filter((id) => !keepIds.includes(id));

  if (stale.length > 0) {
    const removed = await admin.from(spec.table).delete().in("id", stale);
    if (removed.error) {
      throw mapPostgrestError(removed.error, {
        entity: spec.table,
        action: "delete",
      });
    }
  }

  return { count: rows.length };
}
