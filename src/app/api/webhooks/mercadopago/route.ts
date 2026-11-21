import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { validateWebhookSignature, getPayment, mapPaymentStatus } from "@/lib/mercadopago";
import { sendEmail } from "@/lib/server/emailService";
import { paymentApprovedEmail } from "@/lib/server/emailTemplates";

export async function POST(req: NextRequest) {
  let payload: any = null;
  try {
    payload = await req.json();
  } catch {
    payload = null;
  }

  const url = new URL(req.url);
  const type = String(payload?.type ?? url.searchParams.get("type") ?? "").toLowerCase();
  const dataId =
    payload?.data?.id?.toString() ??
    url.searchParams.get("data.id") ??
    url.searchParams.get("id");

  // Solo nos interesan eventos de pago.
  if (type && type !== "payment") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const signatureHeader = req.headers.get("x-signature");
  const requestId = req.headers.get("x-request-id");

  // Validar firma si hay secret configurado.
  if (process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim()) {
    const valid = validateWebhookSignature({
      signatureHeader,
      requestId,
      dataId: dataId ?? null,
    });
    if (!valid) {
      return NextResponse.json({ ok: false, message: "Firma inválida." }, { status: 401 });
    }
  } else {
    return NextResponse.json(
      { ok: false, message: "MERCADOPAGO_WEBHOOK_SECRET no configurado: no se aceptan webhooks." },
      { status: 503 }
    );
  }

  if (!dataId) {
    return NextResponse.json({ ok: false, message: "Falta data.id." }, { status: 400 });
  }

  try {
    const payment = await getPayment(dataId);
    const externalRef = String(payment?.external_reference ?? "").trim();
    if (!externalRef) {
      return NextResponse.json({ ok: true, ignored: true, reason: "sin external_reference" });
    }

    const admin = getSupabaseAdmin();
    const { data: order, error: oErr } = await admin
      .from("orders")
      .select("id, order_number, total_cents, payment_status, payment_transaction_ref, payment_paid_at, fulfillment_status, customer_name, customer_email, order_items(name, quantity, line_total_cents)")
      .eq("order_number", externalRef)
      .maybeSingle();

    if (oErr) throw new Error(oErr.message);
    if (!order) {
      return NextResponse.json({ ok: true, ignored: true, reason: "pedido no encontrado" });
    }

    const mpStatus = String(payment?.status ?? "");
    const mapped = mapPaymentStatus(mpStatus);
    const paymentId = String(payment?.id ?? dataId);
    const amountReceived = Math.round(Number(payment?.transaction_amount ?? 0) * 100);

    // Idempotencia: si ya procesamos este pago, no repetir.
    if (order.payment_transaction_ref === paymentId && order.payment_status === mapped) {
      return NextResponse.json({ ok: true, idempotent: true });
    }

    // Verificación de monto (evita pagos manipulados).
    const amountOk = amountReceived === (order.total_cents ?? 0);
    const finalStatus = amountOk ? mapped : "discrepancy";

    const patch: any = {
      payment_status: finalStatus,
      payment_transaction_ref: paymentId,
      payment_amount_paid_cents: amountReceived,
      payment_updated_by: "system:webhook",
      payment_updated_at: new Date().toISOString(),
    };
    if (finalStatus === "paid" && !order.payment_paid_at) {
      patch.payment_paid_at = new Date().toISOString();
      // Si estaba esperando pago, pasar a procesando.
      patch.fulfillment_status = "processing";
    }

    const { error: uErr } = await admin.from("orders").update(patch).eq("id", order.id);
    if (uErr) throw new Error(uErr.message);

    // Actividad
    await admin.from("order_activity_log").insert({
      order_id: order.id,
      actor: "system:webhook",
      event_type: "payment_webhook_processed",
      field: "payment_status",
      old_value: order.payment_status,
      new_value: finalStatus,
      metadata: {
        paymentId,
        mpStatus,
        amountReceived,
        expected: order.total_cents,
        amountOk,
      },
    });

    // Email de pago aprobado (solo si hay email y el pago quedó aprobado)
    if (finalStatus === "paid" && order.customer_email) {
      const items = (order.order_items ?? []).map((it: any) => ({
        name: it.name,
        quantity: it.quantity,
        subtotal: `$${((it.line_total_cents ?? 0) / 100).toLocaleString("es-AR")}`,
      }));
      const tpl = paymentApprovedEmail({
        orderNumber: order.order_number,
        customerName: order.customer_name || "Cliente",
        customerEmail: order.customer_email,
        total: `$${((order.total_cents ?? 0) / 100).toLocaleString("es-AR")}`,
        items,
      });
      void sendEmail({ to: order.customer_email, subject: tpl.subject, html: tpl.html }).catch(() => undefined);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("webhook mercadopago error", err);
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : "Error procesando webhook." },
      { status: 500 }
    );
  }
}

// Mercado Pago también hace GET para verificar el endpoint en algunos flujos.
export async function GET() {
  return NextResponse.json({ ok: true });
}