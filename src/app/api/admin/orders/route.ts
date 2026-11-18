/**
 * GET /api/admin/orders — listado completo de pedidos (panel)
 * ============================================================
 * Única vía de lectura de TODOS los pedidos para el administrador:
 *
 *  - Guardas, en orden: backend activo (supabase) → cookie de sesión del
 *    panel. El administrador NO tiene sesión de Supabase Auth, por lo que
 *    las políticas RLS (`orders_owner_read`) no le servirían: esta ruta usa
 *    la `service_role` (BYPASSRLS) y por eso MISMO la cookie es la
 *    autorización.
 *  - El email del cliente no está en `orders` (vive en auth.users): se
 *    resuelve con la API admin de GoTrue y se adjunta al resultado. Si no
 *    se puede resolver, el pedido igual se devuelve (email vacío).
 *
 * Respuesta: `{ ok: true, orders: Order[] }` (dominio, importes en pesos).
 */

import { NextRequest, NextResponse } from "next/server";
import {
  errorResponse,
  requireAdmin,
  requireSupabaseBackend,
} from "@/lib/server/adminGuard";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import {
  mapOrderRow,
  type OrderHistoryRow,
  type OrderItemRow,
  type OrderRow,
} from "@/lib/orderMapping";
import type { Order } from "@/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type OrderWithRelations = OrderRow & {
  order_items?: OrderItemRow[];
  order_status_history?: OrderHistoryRow[];
  user_id: string;
};

/**
 * Mapa user_id → email usando la API admin de GoTrue (pagina de a 100 y
 * corta en cuanto todos los pedidos tienen email o se acaban los usuarios).
 * Nunca tira: sin email la lista sigue siendo útil.
 */
async function fetchUserEmails(
  admin: SupabaseClient,
  rows: OrderWithRelations[]
): Promise<Map<string, string>> {
  const emails = new Map<string, string>();
  const needed = new Set(rows.map((row) => row.user_id));
  if (needed.size === 0) return emails;

  try {
    const perPage = 100;
    let page = 1;
    while (emails.size < needed.size && page <= 100) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) break;
      const users = data?.users ?? [];
      for (const user of users) {
        if (user.email && needed.has(user.id)) {
          emails.set(user.id, user.email);
        }
      }
      if (users.length < perPage) break; // última página
      page += 1;
    }
  } catch {
    // Sin emails: se devuelve la lista igual (el panel muestra vacío).
  }

  return emails;
}

export async function GET(req: NextRequest) {
  const backend = requireSupabaseBackend();
  if (backend) return backend;

  const guard = await requireAdmin(req);
  if (guard instanceof NextResponse) return guard;

  try {
    const admin = getSupabaseAdmin();

    const { data, error } = await admin
      .from("orders")
      .select("*, order_items(*), order_status_history(*)")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          code: "INTERNAL",
          message: `No se pudieron cargar los pedidos: ${error.message}`,
        },
        { status: 500 }
      );
    }

    const rows = (data ?? []) as unknown as OrderWithRelations[];
    const emails = await fetchUserEmails(admin, rows);

    const orders: Order[] = rows.map((row) =>
      mapOrderRow(row, emails.get(row.user_id) ?? "")
    );

    return NextResponse.json({ ok: true, orders });
  } catch (error) {
    return errorResponse(error);
  }
}
