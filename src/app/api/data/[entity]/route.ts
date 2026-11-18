/**
 * POST /api/data/[entity]  (Fase C-2)
 * ====================================
 * Alta de catálogo (products | categories | brands | genders).
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
import { isCatalogEntity } from "@/lib/catalogEntities";
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
        `Entidad desconocida "${entity}". Las válidas son: products, categories, brands, genders.`
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
