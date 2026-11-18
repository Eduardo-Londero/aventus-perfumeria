/**
 * PATCH /api/admin/orders/[id] — cambio de estado de un pedido (panel)
 * =====================================================================
 * `[id]` es el NÚMERO de pedido (AV-…), que es el identificador de dominio
 * que maneja la UI (Order.id).
 *
 * La transición se valida AQUÍ con la misma máquina de estados que usa la
 * capa local (src/lib/orderStatus.ts): una transición inválida responde 409
 * y no se escribe nada. Además:
 *
 *  - Al cancelar, la RPC `release_order_stock` devuelve el stock exactamente
 *    una vez (guarda `stock_released`), espejo de la liberación local.
 *  - Se registra el evento en `order_status_history` (append-only).
 *
 * Guardas, en orden: backend activo → cookie del panel (service_role es
 * BYPASSRLS, la cookie ES la autorización).
 */

import { NextRequest, NextResponse } from "next/server";
import {
  errorResponse,
  requireAdmin,
  requireSupabaseBackend,
} from "@/lib/server/adminGuard";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import {
  InvalidBodyError,
  NotFoundError,
  ValidationError,
  ConflictError,
} from "@/lib/server/apiError";
import {
  dbToDomainStatus,
  domainToDbStatus,
  type OrderRow,
} from "@/lib/orderMapping";
import { canTransition, ORDER_STATUS_LABELS } from "@/lib/orderStatus";
import type { OrderStatus } from "@/types";

export const dynamic = "force-dynamic";

interface PatchContext {
  params: Promise<{ id: string }>;
}

const VALID_STATUSES: OrderStatus[] = [
  "no-concretado",
  "confirmado",
  "enviado",
  "entregado",
  "cancelado",
];

function isOrderStatus(value: unknown): value is OrderStatus {
  return (
    typeof value === "string" &&
    (VALID_STATUSES as string[]).includes(value)
  );
}

export async function PATCH(req: NextRequest, ctx: PatchContext) {
  const backend = requireSupabaseBackend();
  if (backend) return backend;

  const guard = await requireAdmin(req);
  if (guard instanceof NextResponse) return guard;

  const { id } = await ctx.params;
  if (!id) {
    return errorResponse(new NotFoundError("Falta el identificador del pedido."));
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(new InvalidBodyError());
  }

  const status = (body as { status?: unknown } | null)?.status;
  if (!isOrderStatus(status)) {
    return errorResponse(
      new ValidationError(
        `Estado inválido. Los válidos son: ${VALID_STATUSES.join(", ")}.`
      )
    );
  }

  try {
    const admin = getSupabaseAdmin();

    const { data: rows, error: fetchError } = await admin
      .from("orders")
      .select("*")
      .eq("order_number", id)
      .limit(1);

    const row = (rows?.[0] ?? null) as OrderRow | null;
    if (fetchError) {
      throw new Error(`No se pudo leer el pedido: ${fetchError.message}`);
    }
    if (!row) {
      return errorResponse(
        new NotFoundError(`No existe ningún pedido con número "${id}".`)
      );
    }

    const current = dbToDomainStatus(row.payment_status, row.fulfillment_status);

    // Idempotencia: pedir el estado actual no es un error.
    if (current === status) {
      return NextResponse.json({ ok: true, unchanged: true });
    }

    // Máquina de estados (fuente única de verdad, igual que en local).
    if (!canTransition(current, status)) {
      return errorResponse(
        new ConflictError(
          `Transición no permitida: ${ORDER_STATUS_LABELS[current]} → ` +
            `${ORDER_STATUS_LABELS[status]}.`
        )
      );
    }

    const dbStatus = domainToDbStatus(status, row.payment_status);

    // Cancelación: devolver el stock (exactamente una vez, lo garantiza la RPC).
    if (status === "cancelado") {
      const { error: releaseError } = await admin.rpc("release_order_stock", {
        p_order_id: row.id,
      });
      if (releaseError) {
        throw new Error(
          `No se pudo liberar el stock del pedido: ${releaseError.message}`
        );
      }
    }

    const { error: updateError } = await admin
      .from("orders")
      .update({
        payment_status: dbStatus.payment_status,
        fulfillment_status: dbStatus.fulfillment_status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (updateError) {
      throw new Error(`No se pudo actualizar el pedido: ${updateError.message}`);
    }

    // Historial (append-only). Si falla, el estado YA cambió: se registra en
    // consola y se responde ok (el historial es auditoría, no el estado).
    const { error: historyError } = await admin
      .from("order_status_history")
      .insert({
        order_id: row.id,
        actor: `admin:${guard.sub}`,
        payment_status: dbStatus.payment_status,
        fulfillment_status: dbStatus.fulfillment_status,
        reason: null,
      });
    if (historyError) {
      console.error(
        "[api/admin/orders] historial no registrado:",
        historyError.message
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
