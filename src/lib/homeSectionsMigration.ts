/**
 * Migración del CMS de Home — Fase D (tabla `home_sections`)
 * ===========================================================
 * La tabla `home_sections` EXISTE desde la migración
 * `supabase/migrations/20261118_0007_home_sections.sql` (aplicada al proyecto
 * `xpphnsozqnajfxjqvtci`). Este módulo concentra la parte PURA de la fase: la
 * lista blanca de tipos, la validación y el mapeo app ↔ fila, que usan
 *   - el servidor: src/lib/server/catalogWriteService.ts (alta/modificación
 *     por fila) y src/lib/server/homeSectionsService.ts (reemplazo completo);
 *   - el cargador:  src/lib/supabaseCatalog.ts (lectura del catálogo).
 *
 * Solo se usan los campos que REALMENTE existen en HomepageSection
 * (src/types/cms.ts): id, type, title, isActive, order, content?. No se
 * inventan campos (imagen, alt, href) porque no existen en el modelo actual.
 */
import type { HomepageSection } from "@/types/cms";

export const HOME_SECTION_TYPES = [
  "hero",
  "categories",
  "featured",
  "offers",
  "newArrivals",
  "banner",
  "brands",
  "about",
  "instagram",
  "contact",
] as const;

export type HomeSectionType = (typeof HOME_SECTION_TYPES)[number];

export function isHomeSectionType(value: unknown): value is HomeSectionType {
  return (
    typeof value === "string" &&
    (HOME_SECTION_TYPES as readonly string[]).includes(value)
  );
}

// Forma de la tabla `home_sections` (creada en 20261118_0007_home_sections.sql).
export interface HomeSectionRow {
  id: string;
  type: HomeSectionType;
  title: string;
  is_active: boolean;
  order: number;
  content: Record<string, unknown> | null;
}

export type HomeSectionBlockerCode =
  | "id_empty"
  | "id_duplicate"
  | "type_unknown"
  | "title_invalid"
  | "is_active_invalid"
  | "order_invalid"
  | "content_invalid";

export interface HomeSectionMigrationResult {
  sectionId: string;
  status: "valid" | "invalid";
  blockers: HomeSectionBlockerCode[];
  row: HomeSectionRow | null;
}

export interface HomeSectionsPlan {
  total: number;
  valid: number;
  invalid: number;
  results: HomeSectionMigrationResult[];
  // Siempre "missing": la tabla no existe en el esquema 0001.
  schemaStatus: "missing";
  // Mientras no exista la tabla, ninguna escritura es posible.
  writable: false;
  dependencies: string[];
}

function validateHomeSection(
  section: HomepageSection,
  seen: Set<string>
): HomeSectionBlockerCode[] {
  const blockers: HomeSectionBlockerCode[] = [];
  if (typeof section.id !== "string" || section.id.trim() === "") {
    blockers.push("id_empty");
  } else if (seen.has(section.id)) {
    blockers.push("id_duplicate");
  }
  if (!isHomeSectionType(section.type)) {
    blockers.push("type_unknown");
  }
  if (typeof section.title !== "string") {
    blockers.push("title_invalid");
  }
  if (typeof section.isActive !== "boolean") {
    blockers.push("is_active_invalid");
  }
  if (
    typeof section.order !== "number" ||
    !Number.isInteger(section.order) ||
    !Number.isFinite(section.order)
  ) {
    blockers.push("order_invalid");
  }
  if (
    section.content !== undefined &&
    section.content !== null &&
    (typeof section.content !== "object" || Array.isArray(section.content))
  ) {
    blockers.push("content_invalid");
  }
  return blockers;
}

export function toHomeSectionRow(section: HomepageSection): HomeSectionRow {
  return {
    id: section.id,
    type: section.type as HomeSectionType,
    title: section.title,
    is_active: section.isActive,
    order: section.order,
    content: section.content ?? null,
  };
}

/**
 * Fila de `home_sections` → modelo de la app (inverso de
 * `toHomeSectionRow`). Los campos desconocidos de `content` pasan tal cual.
 */
export function homeSectionRowToHomepageSection(
  row: HomeSectionRow
): HomepageSection {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    isActive: row.is_active,
    order: row.order,
    ...(row.content ? { content: row.content } : {}),
  };
}

export function migrateHomeSection(
  section: HomepageSection,
  seen: Set<string>
): HomeSectionMigrationResult {
  const blockers = validateHomeSection(section, seen);
  if (section.id?.trim()) seen.add(section.id);
  if (blockers.length > 0) {
    return { sectionId: section.id, status: "invalid", blockers, row: null };
  }
  return {
    sectionId: section.id,
    status: "valid",
    blockers: [],
    row: toHomeSectionRow(section),
  };
}

export function planHomeSectionsMigration(
  sections: HomepageSection[]
): HomeSectionsPlan {
  const seen = new Set<string>();
  const results = sections.map((s) => migrateHomeSection(s, seen));
  return {
    total: sections.length,
    valid: results.filter((r) => r.status === "valid").length,
    invalid: results.filter((r) => r.status === "invalid").length,
    results,
    schemaStatus: "missing",
    writable: false,
    dependencies: [
      "schema: crear tabla home_sections (DDL pendiente de aprobación)",
      "render: src/app/page.tsx hoy usa seed.ts, no localStorage (desacoplado)",
      "admin: editor real de contenido (hoy solo toggle isActive + reorder)",
      "images: sin subida de archivos; solo URLs Unsplash hardcodeadas",
    ],
  };
}
