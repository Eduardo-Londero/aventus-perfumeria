/**
 * PATCH / DELETE /api/data/[entity]/[id]  (Fase C-2)
 * ===================================================
 * Modificación y baja de catálogo. PATCH recibe el objeto COMPLETO de la app
 * (el cliente ya lo fusionó en memoria) y lo persiste completo: así la
 * validación siempre se hace sobre el estado final, nunca sobre un parche
 * parcial.
 *
 * DELETE no lleva cuerpo. Para productos exige además que no haya
 * `order_items` referenciando el id (el esquema no tiene FK ahí por diseño:
 * `order_items` es un snapshot histórico).
 */

import { NextRequest, NextResponse } from "next/server";
import {
  errorResponse,
  requireAdmin,
  requireSupabaseBackend,
} from "@/lib/server/adminGuard";
import { deleteEntity, updateEntity } from "@/lib/server/catalogWriteService";
import { isCatalogEntity, type CatalogEntity } from "@/lib/catalogEntities";
import {
  InvalidBodyError,
  InvalidEntityError,
  ValidationError,
} from "@/lib/server/apiError";

export const dynamic = "force-dynamic";

interface EntityContext {
  params: Promise<{ entity: string; id: string }>;
}

async function resolveTarget(
  req: NextRequest,
  ctx: EntityContext
): Promise<{ entity: CatalogEntity; id: string } | NextResponse> {
  const backend = requireSupabaseBackend();
  if (backend) return backend;

  const guard = await requireAdmin(req);
  if (guard instanceof NextResponse) return guard;

  const { entity, id } = await ctx.params;
  if (!isCatalogEntity(entity)) {
    return errorResponse(
      new InvalidEntityError(
        `Entidad desconocida "${entity}". Las válidas son: products, categories, brands, genders.`
      )
    );
  }
  if (typeof id !== "string" || id.trim() === "") {
    return errorResponse(new ValidationError("El ID del registro es obligatorio."));
  }
  if (id.length > 64) {
    return errorResponse(new ValidationError("El ID del registro es demasiado largo."));
  }
  return { entity, id };
}

export async function PATCH(req: NextRequest, ctx: EntityContext) {
  const target = await resolveTarget(req, ctx);
  if (target instanceof NextResponse) return target;
  const { entity, id } = target;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(new InvalidBodyError());
  }

  try {
    const updated = await updateEntity(entity, id, body);
    return NextResponse.json({
      ok: true,
      action: "update",
      entity,
      id: updated.id,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(req: NextRequest, ctx: EntityContext) {
  const target = await resolveTarget(req, ctx);
  if (target instanceof NextResponse) return target;
  const { entity, id } = target;

  try {
    const removed = await deleteEntity(entity, id);
    return NextResponse.json({
      ok: true,
      action: "delete",
      entity,
      id: removed.id,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
