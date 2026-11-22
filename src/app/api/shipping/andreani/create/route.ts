import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession, ADMIN_SESSION_COOKIE } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { andreaniProvider } from "@/lib/shipping/andreani";
import { getAndreaniConfig } from "@/lib/shipping/config";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const session = await verifyAdminSession(token);
  if (!session) {
    return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Body inválido." }, { status: 400 });
  }

  const orderNumber = String(body?.orderNumber ?? "").trim();
  if (!orderNumber) {
    return NextResponse.json({ ok: false, message: "Falta orderNumber." }, { status: 400 });
  }

  if (!andreaniProvider.isConfigured()) {
    return NextResponse.json({ ok: false, message: "Andreani no configurado." }, { status: 503 });
  }

  const admin = getSupabaseAdmin();
  const { data: order, error } = await admin
    .from("orders")
    .select("*, order_items(*)")
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (error || !order) {
    return NextResponse.json({ ok: false, message: "Pedido no encontrado." }, { status: 404 });
  }

  const cfg = getAndreaniConfig();
  const customerName = order.customer_name || "Cliente";

  // Payload basado en la documentación de Andreani (v2 ordenes-de-envio).
  // Ajustar según la estructura real de tu contrato.
  const payload = {
    cliente: cfg.cliente,
    contrato: cfg.contrato,
    origen: {
      postal: {
        codigoPostal: cfg.originPostalCode,
        calle: process.env.SHIPPING_SENDER_STREET || "",
        numero: process.env.SHIPPING_SENDER_STREET_NUMBER || "",
        localidad: process.env.SHIPPING_SENDER_CITY || "",
        provincia: process.env.SHIPPING_SENDER_PROVINCE || "T",
      },
    },
    destino: {
      postal: {
        codigoPostal: order.ship_postal_code || "",
        calle: order.ship_street || "",
        numero: "",
        localidad: order.ship_city || "",
        provincia: order.ship_province || "",
      },
    },
    remitente: {
      nombre: process.env.SHIPPING_SENDER_NAME || "Aventus Perfumería",
      email: process.env.SHIPPING_SENDER_EMAIL || "",
      telefono: process.env.SHIPPING_SENDER_PHONE || "",
    },
    destinatario: {
      nombre: customerName,
      email: order.customer_email || "",
      telefono: order.customer_phone || "",
    },
    bultos: (order.order_items ?? []).slice(0, 1).map((it: any) => ({
      kilos: Math.max(0.1, (it.quantity || 1) * 0.5),
      valorDeclarado: Math.round((it.line_total_cents || 0) / 100),
      altoCm: 10,
      anchoCm: 10,
      largoCm: 10,
    })),
    ...(order.order_items?.length ? {} : {
      bultos: [{ kilos: 0.5, valorDeclarado: 0, altoCm: 10, anchoCm: 10, largoCm: 10 }],
    }),
  };

  const result = await andreaniProvider.createShipment!(payload);

  if (result.ok && result.trackingCode) {
    await admin.from("orders").update({
      shipping_carrier: "Andreani",
      shipping_tracking_code: result.trackingCode,
      shipping_status: "despachado",
      shipping_dispatched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", order.id);

    await admin.from("order_activity_log").insert({
      order_id: order.id,
      actor: session.sub || "admin",
      event_type: "shipping_created",
      field: "shipping_tracking_code",
      new_value: result.trackingCode,
      metadata: { provider: "andreani" },
    });
  }

  return NextResponse.json({ ok: result.ok, message: result.message, trackingCode: result.trackingCode });
}