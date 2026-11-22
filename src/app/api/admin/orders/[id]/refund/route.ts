import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession, ADMIN_SESSION_COOKIE } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { refundPayment } from "@/lib/mercadopago";
import { sendEmail } from "@/lib/server/emailService";
import { orderCancelledEmail } from "@/lib/server/emailTemplates";

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const session = await verifyAdminSession(token);
  if (!session) {
    return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  }

  const params = await context.params;
  const orderNumber = params.id;
  const admin = getSupabaseAdmin();

  const { data: order, error } = await admin
    .from("orders")
    .select("id, order_number, total_cents, payment_status, payment_transaction_ref, customer_name, customer_email, stock_released")
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (error || !order) {
    return NextResponse.json({ ok: false, message: "Pedido no encontrado." }, { status: 404 });
  }

  if (order.payment_status !== "paid") {
    return NextResponse.json({ ok: false, message: "El pedido no está pagado; no se puede reembolsar." }, { status: 400 });
  }
  if (!order.payment_transaction_ref) {
    return NextResponse.json({ ok: false, message: "No hay referencia de pago de Mercado Pago." }, { status: 400 });
  }

  // Idempotencia: si ya está reembolsado, no repetir
  if (order.payment_status === "refunded") {
    return NextResponse.json({ ok: true, message: "Ya reembolsado." });
  }

  try {
    const refund = await refundPayment(order.payment_transaction_ref);
    // Verificar que MP confirmó
    const status = (refund as any)?.status;
    if (status && status !== "approved") {
      return NextResponse.json(
        { ok: false, message: `Mercado Pago no aprobó el reembolso (status: ${status}).` },
        { status: 400 }
      );
    }

    // Actualizar pedido
    const patch: any = {
      payment_status: "refunded",
      fulfillment_status: "cancelled",
      stock_released: true,
      updated_at: new Date().toISOString(),
    };
    await admin.from("orders").update(patch).eq("id", order.id);

    // Liberar stock si no se había liberado
    if (!order.stock_released) {
      const { data: items } = await admin.from("order_items").select("product_id, quantity").eq("order_id", order.id);
      for (const it of items ?? []) {
        const { data: prod } = await admin.from("products").select("stock, sold_count").eq("id", it.product_id).single();
        if (prod) {
          await admin.from("products").update({
            stock: (prod.stock ?? 0) + it.quantity,
            sold_count: Math.max(0, (prod.sold_count ?? 0) - it.quantity),
          }).eq("id", it.product_id);
        }
      }
    }

    // Historial
    await admin.from("order_status_history").insert({
      order_id: order.id,
      actor: session.sub || "admin",
      payment_status: "refunded",
      fulfillment_status: "cancelled",
      reason: "Reembolso procesado vía Mercado Pago",
    });

    // Email
    if (order.customer_email) {
      const tpl = orderCancelledEmail({
        orderNumber: order.order_number,
        customerName: order.customer_name || "Cliente",
        customerEmail: order.customer_email,
        total: `$${((order.total_cents ?? 0) / 100).toLocaleString("es-AR")}`,
        items: [],
      });
      void sendEmail({ to: order.customer_email, subject: tpl.subject, html: tpl.html }).catch(() => undefined);
    }

    return NextResponse.json({ ok: true, message: "Reembolso procesado correctamente." });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : "Error procesando reembolso." },
      { status: 500 }
    );
  }
}