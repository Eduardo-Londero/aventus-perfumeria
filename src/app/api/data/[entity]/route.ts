/**
 * POST /api/data/[entity]  (Fase C-2 / Fase D)
 * ====================================
 * Alta de catálogo (products | categories | brands | genders | home_sections
 * | banners).
 *
 * Orden de las guardas: backend activo → sesión de administrador → entidad →
 * cuerpo → validación/dominio en catalogWriteService. Responde 201 con
 * `{ ok:true, action:"create", entity, id }` o `{ ok:false, code, message }`.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  errorResponse,
  requireAdmin,
  requireSupabaseBackend,
} from "@/lib/server/adminGuard";
import { createEntity } from "@/lib/server/catalogWriteService";
import { replaceHomeSections } from "@/lib/server/homeSectionsService";
import { replaceBanners } from "@/lib/server/bannersService";
import {
  CATALOG_ENTITIES,
  COLLECTION_ENTITIES,
  isCatalogEntity,
  isCollectionEntity,
} from "@/lib/catalogEntities";
import { InvalidBodyError, InvalidEntityError } from "@/lib/server/apiError";

export const dynamic = "force-dynamic";

interface EntityContext {
  params: Promise<{ entity: string }>;
}

export async function POST(req: NextRequest, ctx: EntityContext) {
  const backend = requireSupabaseBackend();
  if (backend) return backend;

  const guard = await requireAdmin(req);
  if (guard instanceof NextResponse) return guard;

  const { entity } = await ctx.params;
  if (!isCatalogEntity(entity)) {
    return errorResponse(
      new InvalidEntityError(
        `Entidad desconocida "${entity}". Las válidas son: ${CATALOG_ENTITIES.join(", ")}.`
      )
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(new InvalidBodyError());
  }

  try {
    const created = await createEntity(entity, body);
    return NextResponse.json(
      { ok: true, action: "create", entity, id: created.id },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * PUT /api/data/[entity] — reemplazo ATÓMICO de una colección.
 *
 * Lo usan las colecciones del CMS (`home_sections`, `banners`): el panel
 * guarda el orden, la activación y la vigencia del conjunto, no filas
 * sueltas. El catálogo sigue con POST/PATCH/DELETE por fila.
 */
export async function PUT(req: NextRequest, ctx: EntityContext) {
  const backend = requireSupabaseBackend();
  if (backend) return backend;

  const guard = await requireAdmin(req);
  if (guard instanceof NextResponse) return guard;

  const { entity } = await ctx.params;
  if (!isCollectionEntity(entity) || !isCatalogEntity(entity)) {
    return errorResponse(
      new InvalidEntityError(
        `La escritura por colección solo está soportada en: ${COLLECTION_ENTITIES.join(", ")}. ` +
          `Para "${entity || ""}" usá POST/PATCH/DELETE sobre /api/data/${entity}/[id].`
      )
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(new InvalidBodyError());
  }

  try {
    const replaced =
      entity === "home_sections"
        ? await replaceHomeSections(body)
        : await replaceBanners(body);
    return NextResponse.json({
      ok: true,
      action: "replace",
      entity,
      count: replaced.count,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
