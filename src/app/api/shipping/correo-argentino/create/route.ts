import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession, ADMIN_SESSION_COOKIE } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { correoArgentinoProvider } from "@/lib/shipping/correoArgentino";
import { getCorreoArgentinoConfig } from "@/lib/shipping/config";

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

  if (!correoArgentinoProvider.isConfigured()) {
    return NextResponse.json({ ok: false, message: "Correo Argentino no configurado." }, { status: 503 });
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

  const cfg = getCorreoArgentinoConfig();
  const customerName = order.customer_name || "Cliente";
  const nameParts = customerName.split(" ");
  const firstName = nameParts[0] || "Cliente";
  const lastName = nameParts.slice(1).join(" ") || "";

  const payload = {
    sellerId: "",
    senderData: {
      id: "1",
      businessName: process.env.SHIPPING_SENDER_NAME || "Aventus Perfumería",
      areaCodePhone: "",
      phoneNumber: process.env.SHIPPING_SENDER_PHONE || "",
      areaCodeCellphone: "",
      cellphoneNumber: process.env.SHIPPING_SENDER_PHONE || "",
      email: process.env.SHIPPING_SENDER_EMAIL || "",
      observation: "",
      address: {
        streetName: process.env.SHIPPING_SENDER_STREET || "",
        streetNumber: process.env.SHIPPING_SENDER_STREET_NUMBER || "",
        cityName: process.env.SHIPPING_SENDER_CITY || "",
        floor: "",
        department: "",
        state: process.env.SHIPPING_SENDER_PROVINCE || "T",
        zipCode: cfg.originPostalCode,
      },
    },
    shippingData: {
      name: customerName,
      areaCodePhone: "",
      phoneNumber: order.customer_phone || "",
      areaCodeCellphone: "",
      cellphoneNumber: order.customer_phone || "",
      email: order.customer_email || "",
      observation: order.customer_notes || "",
      address: {
        streetName: order.ship_street || "",
        streetNumber: "",
        cityName: order.ship_city || "",
        floor: "",
        department: "",
        state: order.ship_province || "",
        zipCode: order.ship_postal_code || "",
      },
    },
    parcels: (order.order_items ?? []).slice(0, 1).map((it: any) => ({
      dimensions: { height: "10", width: "10", depth: "10" },
      productWeight: String(Math.max(1, Math.round((it.quantity || 1) * 500))),
      productCategory: "Perfumería",
      declaredValue: String(Math.round((it.line_total_cents || 0) / 100)),
    })),
    deliveryType: order.delivery_method === "envio" ? "homeDelivery" : "agency",
    agencyId: "",
    saleDate: new Date().toISOString(),
    serviceType: "CP",
    shipmentClientId: order.order_number,
  };

  // Si no hay items, agregar un paquete por defecto
  if (payload.parcels.length === 0) {
    payload.parcels = [{
      dimensions: { height: "10", width: "10", depth: "10" },
      productWeight: "500",
      productCategory: "Perfumería",
      declaredValue: "0",
    }];
  }

  const result = await correoArgentinoProvider.createShipment!(payload);

  if (result.ok && result.trackingCode) {
    // Actualizar pedido con carrier y tracking
    await admin.from("orders").update({
      shipping_carrier: "Correo Argentino",
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
      metadata: { provider: "correo_argentino" },
    });
  }

  return NextResponse.json({ ok: result.ok, message: result.message, trackingCode: result.trackingCode });
}