import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { hasMercadoPagoConfig, createPreference } from "@/lib/mercadopago";

export async function POST(req: NextRequest) {
  if (!hasMercadoPagoConfig()) {
    return NextResponse.json(
      { ok: false, message: "Mercado Pago no está configurado en el servidor (falta MERCADOPAGO_ACCESS_TOKEN)." },
      { status: 503 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Body inválido." }, { status: 400 });
  }

  const orderNumber = String(body?.orderNumber ?? "").trim();
  const payerEmail = body?.payerEmail ? String(body.payerEmail).trim() : undefined;
  const rawItems = Array.isArray(body?.items) ? body.items : [];

  if (!orderNumber) {
    return NextResponse.json({ ok: false, message: "Falta orderNumber." }, { status: 400 });
  }
  if (rawItems.length === 0) {
    return NextResponse.json({ ok: false, message: "Faltan items." }, { status: 400 });
  }

  try {
    const admin = getSupabaseAdmin();
    // Reconstruir precios desde la DB (fuente de verdad).
    const ids = rawItems.map((i: any) => String(i.id));
    const { data: products, error } = await admin
      .from("products")
      .select("id, name, price_cents, is_active")
      .in("id", ids);
    if (error) throw new Error(error.message);

    const byId = new Map((products ?? []).map((p: any) => [p.id, p]));
    const items = rawItems.map((i: any) => {
      const p = byId.get(String(i.id));
      if (!p || !p.is_active) throw new Error(`Producto no disponible: ${i.id}`);
      const qty = Math.max(1, Math.floor(Number(i.quantity) || 1));
      return {
        id: String(p.id),
        title: String(p.name),
        quantity: qty,
        unit_price: (p.price_cents ?? 0) / 100,
      };
    });

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
    const notificationUrl = siteUrl ? `${siteUrl}/api/webhooks/mercadopago` : undefined;

    const pref = await createPreference({
      externalReference: orderNumber,
      items,
      payerEmail,
      notificationUrl,
    });

    // En modo prueba, redirigir al sandbox para poder usar usuarios/tarjetas de prueba.
    const isTest = (process.env.MERCADOPAGO_ACCESS_TOKEN || "").startsWith("TEST-");
    const redirectUrl = isTest && pref.sandbox_init_point ? pref.sandbox_init_point : pref.init_point;

    return NextResponse.json({ ok: true, ...pref, redirect_url: redirectUrl });
  } catch (err) {
    console.error("mercadopago preferences error", err);
    const message = err instanceof Error ? err.message : "Error creando preferencia.";
    const details = err instanceof Error ? err.stack : String(err);
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim() || "";
    return NextResponse.json(
      {
        ok: false,
        message,
        details,
        tokenInfo: {
          present: !!token,
          prefix: token ? token.slice(0, 12) : null,
          length: token.length,
        },
      },
      { status: 500 }
    );
  }
}