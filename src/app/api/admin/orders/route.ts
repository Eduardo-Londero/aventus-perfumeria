/**
 * GET/POST /api/admin/orders — listado (paginado/filtrado) y creación manual
 * ===========================================================================
 * Única vía de lectura/escritura de TODOS los pedidos para el administrador.
 * Usa service_role (BYPASSRLS); la cookie del panel es la autorización.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  errorResponse,
  requireAdmin,
  requireSupabaseBackend,
} from "@/lib/server/adminGuard";
import {
  fetchOrders,
  fetchOrderSummary,
  createManualOrder,
  type OrderFilters,
  type ManualOrderInput,
} from "@/lib/server/ordersService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const backend = requireSupabaseBackend();
  if (backend) return backend;

  const guard = await requireAdmin(req);
  if (guard instanceof NextResponse) return guard;

  const url = new URL(req.url);
  const summary = url.searchParams.get("summary") === "1";

  try {
    if (summary) {
      const dateFrom = url.searchParams.get("dateFrom") || undefined;
      const dateTo = url.searchParams.get("dateTo") || undefined;
      const data = await fetchOrderSummary(dateFrom, dateTo);
      return NextResponse.json({ ok: true, ...data });
    }

    const filters: OrderFilters = {
      search: url.searchParams.get("search") || undefined,
      paymentStatus: url.searchParams.get("paymentStatus") || undefined,
      shippingStatus: url.searchParams.get("shippingStatus") || undefined,
      fulfillmentStatus: url.searchParams.get("fulfillmentStatus") || undefined,
      noTracking: url.searchParams.get("noTracking") === "1",
      dateFrom: url.searchParams.get("dateFrom") || undefined,
      dateTo: url.searchParams.get("dateTo") || undefined,
      sort: (url.searchParams.get("sort") as any) || "created_at",
      order: (url.searchParams.get("order") as any) || "desc",
      page: Number(url.searchParams.get("page") || "1"),
      pageSize: Number(url.searchParams.get("pageSize") || "20"),
    };

    const result = await fetchOrders(filters);
    return NextResponse.json({ ok: true, orders: result.orders, total: result.total });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  const backend = requireSupabaseBackend();
  if (backend) return backend;

  const guard = await requireAdmin(req);
  if (guard instanceof NextResponse) return guard;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: "INVALID_BODY", message: "Cuerpo inválido." },
      { status: 400 }
    );
  }

  // El guard devuelve el payload del admin (sub = id del admin de panel).
  const adminId = (guard as any)?.sub ? `admin:${(guard as any).sub}` : "admin:panel";

  try {
    const order = await createManualOrder(body as ManualOrderInput, adminId);
    return NextResponse.json({ ok: true, order }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
