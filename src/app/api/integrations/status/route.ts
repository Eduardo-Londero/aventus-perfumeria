import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession, ADMIN_SESSION_COOKIE } from "@/lib/session";
import { hasEmailConfig } from "@/lib/server/emailService";
import { hasMercadoPagoConfig, hasWebhookSecret } from "@/lib/mercadopago";
import { hasAndreaniConfig, hasCorreoArgentinoConfig } from "@/lib/shipping/config";
import { hasSupabasePublicConfig } from "@/lib/supabaseClient";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const session = await verifyAdminSession(token);
  if (!session) {
    return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  }

  const integrations = [
    {
      id: "supabase",
      name: "Supabase (base de datos y auth)",
      configured: hasSupabasePublicConfig(),
      details: hasSupabasePublicConfig()
        ? "URL y anon key configuradas."
        : "Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    },
    {
      id: "mercadopago",
      name: "Mercado Pago",
      configured: hasMercadoPagoConfig(),
      details: hasMercadoPagoConfig()
        ? `Access token presente. Webhook secret: ${hasWebhookSecret() ? "configurado" : "FALTA (los pagos no se verificarán)"}`
        : "Falta MERCADOPAGO_ACCESS_TOKEN.",
    },
    {
      id: "email",
      name: "Email transaccional (Resend)",
      configured: hasEmailConfig(),
      details: hasEmailConfig()
        ? process.env.BREVO_API_KEY?.trim()
          ? "Brevo configurado."
          : "Resend configurado."
        : "Falta BREVO_API_KEY o RESEND_API_KEY (los emails no se enviarán).",
    },
    {
      id: "andreani",
      name: "Andreani (envíos)",
      configured: hasAndreaniConfig(),
      details: hasAndreaniConfig()
        ? "Credenciales configuradas. Cotización pendiente de implementación."
        : "Faltan ANDREANI_API_BASE y credenciales.",
    },
    {
      id: "correo_argentino",
      name: "Correo Argentino (envíos)",
      configured: hasCorreoArgentinoConfig(),
      details: hasCorreoArgentinoConfig()
        ? "Credenciales configuradas. Cotización pendiente de implementación."
        : "Faltan CORREO_ARGENTINO_API_BASE y CORREO_ARGENTINO_API_KEY.",
    },
    {
      id: "google_oauth",
      name: "Google OAuth (login social)",
      configured: true, // se configura en Supabase Dashboard, no por env
      details: "Configurado en Supabase Dashboard → Authentication → Providers → Google.",
    },
  ];

  return NextResponse.json({ ok: true, integrations });
}