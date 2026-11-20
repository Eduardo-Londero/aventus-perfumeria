/**
 * GET/PATCH /api/admin/orders/[id] — detalle y actualización de un pedido
 */

import { NextRequest, NextResponse } from "next/server";
import {
  errorResponse,
  requireAdmin,
  requireSupabaseBackend,
} from "@/lib/server/adminGuard";
import { fetchOrder, updateOrder } from "@/lib/server/ordersService";
import type { OrderUpdateInput } from "@/lib/server/ordersService";

export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const backend = requireSupabaseBackend();
  if (backend) return backend;

  const guard = await requireAdmin(req);
  if (guard instanceof NextResponse) return guard;

  const { id } = await ctx.params;
  try {
    const order = await fetchOrder(id);
    if (!order) {
      return NextResponse.json({ ok: false, code: "NOT_FOUND", message: "Pedido no encontrado." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, order });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const backend = requireSupabaseBackend();
  if (backend) return backend;

  const guard = await requireAdmin(req);
  if (guard instanceof NextResponse) return guard;

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_BODY", message: "Cuerpo inválido." }, { status: 400 });
  }

  const adminId = (guard as any)?.sub ? `admin:${(guard as any).sub}` : "admin:panel";

  try {
    const order = await updateOrder(id, body as OrderUpdateInput, adminId);
    return NextResponse.json({ ok: true, order });
  } catch (error) {
    return errorResponse(error);
  }
}
