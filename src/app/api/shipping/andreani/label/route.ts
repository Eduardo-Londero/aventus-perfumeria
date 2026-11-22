import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession, ADMIN_SESSION_COOKIE } from "@/lib/session";
import { andreaniProvider } from "@/lib/shipping/andreani";

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

  const trackingNumber = String(body?.trackingNumber ?? "").trim();
  if (!trackingNumber) {
    return NextResponse.json({ ok: false, message: "Falta trackingNumber." }, { status: 400 });
  }

  if (!andreaniProvider.isConfigured()) {
    return NextResponse.json({ ok: false, message: "Andreani no configurado." }, { status: 503 });
  }

  const result = await andreaniProvider.generateLabel!(trackingNumber, body?.tipo || "");
  if (!result.ok || !result.fileBase64) {
    return NextResponse.json({ ok: false, message: result.message || "No se pudo generar el rótulo." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    fileBase64: result.fileBase64,
    fileName: result.fileName || `${trackingNumber}.pdf`,
  });
}